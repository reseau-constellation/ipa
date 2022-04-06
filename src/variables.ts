import FeedStore from "orbit-db-feedstore";
import KeyValueStore from "orbit-db-kvstore";
import { v4 as uuidv4 } from "uuid";

import ClientConstellation from "./client";
import ContrôleurConstellation from "./accès/cntrlConstellation";
import { règleVariableAvecId, règleVariable, règleCatégorie } from "./valid";

import { objRôles } from "@/accès/types";
import { dicTrads } from "@/utils/types";

import {
  TYPES_STATUT,
  schémaFonctionSuivi,
  schémaFonctionOublier,
  schémaStatut,
} from "@/utils";

export type catégorieVariables =
  | "numérique"
  | "horoDatage"
  | "intervaleTemps"
  | "chaîne"
  | "catégorique"
  | "booléen"
  | "géojson"
  | "vidéo"
  | "audio"
  | "photo"
  | "fichier";

export type typeÉlémentsBdVariable = string | schémaStatut;

export default class Variables {
  client: ClientConstellation;
  idBd: string;

  constructor(client: ClientConstellation, id: string) {
    this.client = client;
    this.idBd = id;
  }

  async suivreVariables(
    f: schémaFonctionSuivi<string[]>,
    idBdVariables?: string
  ): Promise<schémaFonctionOublier> {
    idBdVariables = idBdVariables || this.idBd;
    return await this.client.suivreBdListe<string>(idBdVariables, f);
  }

  async créerVariable(catégorie: catégorieVariables): Promise<string> {
    const idBdVariable = await this.client.créerBdIndépendante("kvstore", {
      adresseBd: undefined,
      premierMod: this.client.bdCompte!.id,
    });
    await this.ajouterÀMesVariables(idBdVariable);

    const { bd: bdVariable, fOublier: fOublierVariable } =
      await this.client.ouvrirBd<KeyValueStore<typeÉlémentsBdVariable>>(
        idBdVariable
      );

    const accès = bdVariable.access as unknown as ContrôleurConstellation;
    const optionsAccès = { adresseBd: accès.adresseBd };

    const idBdNoms = await this.client.créerBdIndépendante(
      "kvstore",
      optionsAccès
    );
    await bdVariable.set("noms", idBdNoms);

    const idBdDescr = await this.client.créerBdIndépendante(
      "kvstore",
      optionsAccès
    );
    await bdVariable.set("descriptions", idBdDescr);

    const idBdRègles = await this.client.créerBdIndépendante(
      "feed",
      optionsAccès
    );
    await bdVariable.set("règles", idBdRègles);

    await bdVariable.set("catégorie", catégorie);

    await this.établirStatut(idBdVariable, { statut: TYPES_STATUT.ACTIVE });

    fOublierVariable();

    return idBdVariable;
  }

  async ajouterÀMesVariables(id: string): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<FeedStore<string>>(
      this.idBd
    );
    await bd.add(id);
    fOublier();
  }

  async enleverDeMesVariables(id: string): Promise<void> {
    const { bd: bdRacine, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >(this.idBd);
    await this.client.effacerÉlémentDeBdListe(bdRacine, id);
    fOublier();
  }

  async copierVariable(id: string): Promise<string> {
    const { bd: bdBase, fOublier: fOublierBase } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdVariable>
    >(id);
    const catégorie = bdBase.get("catégorie") as catégorieVariables;

    const idNouvelleBd = await this.créerVariable(catégorie);
    const { bd: bdNouvelle, fOublier: fOublierNouvelle } =
      await this.client.ouvrirBd<KeyValueStore<typeÉlémentsBdVariable>>(
        idNouvelleBd
      );

    const idBdNoms = bdBase.get("noms") as string;
    const { bd: bdNoms, fOublier: fOublierBdNoms } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdNoms);
    const noms = ClientConstellation.obtObjetdeBdDic(bdNoms) as {
      [key: string]: string;
    };
    await this.ajouterNomsVariable(idNouvelleBd, noms);

    const idBdDescr = bdBase.get("descriptions") as string;
    const { bd: bdDescr, fOublier: fOublierBdDescr } =
      await this.client.ouvrirBd<KeyValueStore<string>>(idBdDescr);
    const descriptions = ClientConstellation.obtObjetdeBdDic(bdDescr) as {
      [key: string]: string;
    };
    await this.ajouterDescriptionsVariable(idNouvelleBd, descriptions);

    const unités = bdBase.get("unités");
    if (unités) await bdNouvelle.put("unités", unités);

    const idBdRègles = bdBase.get("règles") as string;
    const { bd: bdRègles, fOublier: fOublierBdRègles } =
      await this.client.ouvrirBd<FeedStore<règleVariableAvecId>>(idBdRègles);
    const règles = ClientConstellation.obtÉlémentsDeBdListe(
      bdRègles
    ) as règleVariableAvecId[];

    await Promise.all(
      règles.map(async (r: règleVariableAvecId) => {
        await this.ajouterRègleVariable(idNouvelleBd, r.règle);
      })
    );

    const statut = (bdBase.get("statut") as schémaStatut) || {
      statut: TYPES_STATUT.ACTIVE,
    };
    await this.établirStatut(idNouvelleBd, statut);

    fOublierBase();
    fOublierNouvelle();
    fOublierBdNoms();
    fOublierBdDescr();
    fOublierBdRègles();

    return idNouvelleBd;
  }

  async inviterAuteur(
    idVariable: string,
    idBdCompteAuteur: string,
    rôle: keyof objRôles
  ): Promise<void> {
    await this.client.donnerAccès(idVariable, idBdCompteAuteur, rôle);
  }

  async ajouterNomsVariable(id: string, noms: dicTrads): Promise<void> {
    const idBdNoms = await this.client.obtIdBd("noms", id, "kvstore");
    if (!idBdNoms) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdNoms);
    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
    fOublier();
  }

  async sauvegarderNomVariable(
    id: string,
    langue: string,
    nom: string
  ): Promise<void> {
    const idBdNoms = await this.client.obtIdBd("noms", id, "kvstore");
    if (!idBdNoms) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdNoms);
    await bdNoms.set(langue, nom);
    fOublier();
  }

  async effacerNomVariable(id: string, langue: string): Promise<void> {
    const idBdNoms = await this.client.obtIdBd("noms", id, "kvstore");
    if (!idBdNoms) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdNoms);
    await bdNoms.del(langue);
    fOublier();
  }

  async ajouterDescriptionsVariable(
    id: string,
    descriptions: dicTrads
  ): Promise<void> {
    const idBdDescr = await this.client.obtIdBd("descriptions", id, "kvstore");
    if (!idBdDescr) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdDescr);
    for (const lng in descriptions) {
      await bdDescr.set(lng, descriptions[lng]);
    }
    fOublier();
  }

  async sauvegarderDescrVariable(
    id: string,
    langue: string,
    nom: string
  ): Promise<void> {
    const idBdDescr = await this.client.obtIdBd("descriptions", id, "kvstore");
    if (!idBdDescr) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdDescr);
    await bdDescr.set(langue, nom);

    fOublier();
  }

  async effacerDescrVariable(id: string, langue: string): Promise<void> {
    const idBdDescr = await this.client.obtIdBd("descriptions", id, "kvstore");
    if (!idBdDescr) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdDescr);
    await bdDescr.del(langue);

    fOublier();
  }

  async sauvegarderCatégorieVariable(
    idVariable: string,
    catégorie: catégorieVariables
  ): Promise<void> {
    const { bd: bdVariable, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdVariable>
    >(idVariable);
    await bdVariable.set("catégorie", catégorie);

    fOublier();
  }

  async sauvegarderUnitésVariable(
    idVariable: string,
    idUnité: string
  ): Promise<void> {
    const { bd: bdVariable, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdVariable>
    >(idVariable);
    await bdVariable.set("unités", idUnité);

    fOublier();
  }

  async ajouterRègleVariable(
    idVariable: string,
    règle: règleVariable
  ): Promise<string> {
    const idBdRègles = await this.client.obtIdBd("règles", idVariable, "feed");
    if (!idBdRègles) {
      throw `Permission de modification refusée pour variable ${idVariable}.`;
    }

    const id = uuidv4();
    const règleAvecId: règleVariableAvecId = {
      id,
      règle,
    };
    const { bd: bdRègles, fOublier } = await this.client.ouvrirBd<
      FeedStore<règleVariableAvecId>
    >(idBdRègles);
    await bdRègles.add(règleAvecId);

    fOublier();

    return id;
  }

  async effacerRègleVariable(
    idVariable: string,
    idRègle: string
  ): Promise<void> {
    const idBdRègles = await this.client.obtIdBd("règles", idVariable, "feed");
    if (!idBdRègles) {
      throw `Permission de modification refusée pour variable ${idVariable}.`;
    }
    const { bd: bdRègles, fOublier } = await this.client.ouvrirBd<
      FeedStore<règleVariableAvecId>
    >(idBdRègles);

    await this.client.effacerÉlémentDeBdListe(
      bdRègles,
      (é) => é.payload.value.id === idRègle
    );

    fOublier();
  }

  async suivreNomsVariable(
    id: string,
    f: schémaFonctionSuivi<{ [key: string]: string }>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef(id, "noms", f);
  }

  async suivreDescrVariable(
    id: string,
    f: schémaFonctionSuivi<{ [key: string]: string }>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef(id, "descriptions", f);
  }

  async suivreCatégorieVariable(
    id: string,
    f: schémaFonctionSuivi<catégorieVariables>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd(
      id,
      async (bd: KeyValueStore<typeÉlémentsBdVariable>) => {
        const catégorie = bd.get("catégorie") as catégorieVariables;
        f(catégorie);
      }
    );
  }

  async suivreUnitésVariable(
    id: string,
    f: schémaFonctionSuivi<string>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd(id, async (bd: KeyValueStore<string>) => {
      const unités = bd.get("unités");
      f(unités);
    });
  }

  async suivreRèglesVariable(
    id: string,
    f: schémaFonctionSuivi<règleVariableAvecId[]>
  ): Promise<schémaFonctionOublier> {
    const règles: {
      catégorie: règleVariableAvecId[];
      propres: règleVariableAvecId[];
    } = {
      catégorie: [],
      propres: [],
    };
    const fFinale = () => {
      f([...règles.catégorie, ...règles.propres]);
    };

    const fSuivreCatégorie = (catégorie: catégorieVariables) => {
      const règleCat: règleVariableAvecId<règleCatégorie> = {
        id: uuidv4(),
        règle: {
          typeRègle: "catégorie",
          détails: { catégorie },
        },
      };
      règles.catégorie = [règleCat];
      fFinale();
    };
    const fOublierCatégorie = await this.suivreCatégorieVariable(
      id,
      fSuivreCatégorie
    );

    const fSuivreRèglesPropres = (rgls: règleVariableAvecId[]) => {
      règles.propres = rgls;
      fFinale();
    };
    const fOublierRèglesPropres =
      await this.client.suivreBdListeDeClef<règleVariableAvecId>(
        id,
        "règles",
        fSuivreRèglesPropres
      );

    const fOublier = () => {
      fOublierCatégorie();
      fOublierRèglesPropres();
    };
    return fOublier;
  }

  async établirStatut(id: string, statut: schémaStatut): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdVariable>
    >(id);
    await bd.set("statut", statut);
    fOublier();
  }

  async marquerObsolète(id: string, idNouvelle?: string): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdVariable>
    >(id);
    bd.set("statut", { statut: TYPES_STATUT.OBSOLÈTE, idNouvelle });
    fOublier();
  }

  async effacerVariable(id: string): Promise<void> {
    // Effacer l'entrée dans notre liste de variables
    await this.enleverDeMesVariables(id);

    // Effacer la variable elle-même
    const optionsAccès = await this.client.obtOpsAccès(id);
    for (const clef in ["noms", "descriptions", "règles"]) {
      const idBd = await this.client.obtIdBd(clef, id, undefined, optionsAccès);
      if (idBd) await this.client.effacerBd(idBd);
    }
    await this.client.effacerBd(id);
  }
}
