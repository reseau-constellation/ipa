import { FeedStore, KeyValueStore } from "orbit-db";

import ClientConstellation, {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  élémentBdListe,
} from "./client";
import ContrôleurConstellation from "./accès/cntrlConstellation";
import { règleVariableAvecId, règleVariable, règleCatégorie } from "./valid";
import { v4 as uuidv4 } from "uuid";

import { STATUT } from "./bds";

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

export default class Variables {
  client: ClientConstellation;
  idBd: string;

  constructor(client: ClientConstellation, id: string) {
    this.client = client;
    this.idBd = id;
  }

  async suivreVariables(
    f: schémaFonctionSuivi<string[]>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdListe<string>(this.idBd, f);
  }

  async créerVariable(catégorie: catégorieVariables): Promise<string> {
    const bdRacine = (await this.client.ouvrirBd(this.idBd)) as FeedStore;
    const idBdVariable = await this.client.créerBdIndépendante("kvstore", {
      adresseBd: undefined,
      premierMod: this.client.bdRacine!.id,
    });
    await bdRacine.add(idBdVariable);

    const bdVariable = (await this.client.ouvrirBd(
      idBdVariable
    )) as KeyValueStore;

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

    await bdVariable.set("unités", undefined);

    await this.établirStatut(idBdVariable, { statut: STATUT.ACTIVE });

    return idBdVariable;
  }

  async copierVariable(id: string): Promise<string> {
    const bdBase = (await this.client.ouvrirBd(id)) as KeyValueStore;
    const catégorie = await bdBase.get("catégorie");

    const idNouvelleBd = await this.créerVariable(catégorie);
    const bdNouvelle = (await this.client.ouvrirBd(
      idNouvelleBd
    )) as KeyValueStore;

    const idBdNoms = await bdBase.get("noms");
    const bdNoms = (await this.client.ouvrirBd(idBdNoms)) as KeyValueStore;
    const noms = ClientConstellation.obtObjetdeBdDic(bdNoms) as {
      [key: string]: string;
    };
    await this.ajouterNomsVariable(idNouvelleBd, noms);

    const idBdDescr = await bdBase.get("descriptions");
    const bdDescr = (await this.client.ouvrirBd(idBdDescr)) as KeyValueStore;
    const descriptions = ClientConstellation.obtObjetdeBdDic(bdDescr) as {
      [key: string]: string;
    };
    await this.ajouterDescriptionsVariable(idNouvelleBd, descriptions);

    const unités = await bdBase.get("unités");
    if (unités) await bdNouvelle.put("unités", unités);

    const idBdRègles = await bdBase.get("règles");
    const bdRègles = (await this.client.ouvrirBd(idBdRègles)) as FeedStore;
    const règles = ClientConstellation.obtÉlémentsDeBdListe(
      bdRègles
    ) as règleVariableAvecId[];

    await Promise.all(
      règles.map(async (r: règleVariableAvecId) => {
        await this.ajouterRègleVariable(idNouvelleBd, r.règle);
      })
    );

    const statut = (await bdBase.get("statut")) || STATUT.ACTIVE;
    await this.établirStatut(idNouvelleBd, { statut });

    return idNouvelleBd;
  }

  async ajouterNomsVariable(
    id: string,
    noms: { [key: string]: string }
  ): Promise<void> {
    const idBdNoms = await this.client.obtIdBd("noms", id, "kvstore");
    if (!idBdNoms) throw `Permission de modification refusée pour BD ${id}.`;

    const bdNoms = (await this.client.ouvrirBd(idBdNoms)) as KeyValueStore;
    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
  }

  async sauvegarderNomVariable(
    id: string,
    langue: string,
    nom: string
  ): Promise<void> {
    const idBdNoms = await this.client.obtIdBd("noms", id, "kvstore");
    if (!idBdNoms) throw `Permission de modification refusée pour BD ${id}.`;

    const bdNoms = (await this.client.ouvrirBd(idBdNoms)) as KeyValueStore;
    await bdNoms.set(langue, nom);
  }

  async effacerNomVariable(id: string, langue: string): Promise<void> {
    const idBdNoms = await this.client.obtIdBd("noms", id, "kvstore");
    if (!idBdNoms) throw `Permission de modification refusée pour BD ${id}.`;

    const bdNoms = (await this.client.ouvrirBd(idBdNoms)) as KeyValueStore;
    await bdNoms.del(langue);
  }

  async ajouterDescriptionsVariable(
    id: string,
    descriptions: { [key: string]: string }
  ): Promise<void> {
    const idBdDescr = await this.client.obtIdBd("descriptions", id, "kvstore");
    if (!idBdDescr) throw `Permission de modification refusée pour BD ${id}.`;

    const bdDescr = (await this.client.ouvrirBd(idBdDescr)) as KeyValueStore;
    for (const lng in descriptions) {
      await bdDescr.set(lng, descriptions[lng]);
    }
  }

  async sauvegarderDescrVariable(
    id: string,
    langue: string,
    nom: string
  ): Promise<void> {
    const idBdDescr = await this.client.obtIdBd("descriptions", id, "kvstore");
    if (!idBdDescr) throw `Permission de modification refusée pour BD ${id}.`;

    const bdDescr = (await this.client.ouvrirBd(idBdDescr)) as KeyValueStore;
    await bdDescr.set(langue, nom);
  }

  async effacerDescrVariable(id: string, langue: string): Promise<void> {
    const idBdDescr = await this.client.obtIdBd("descriptions", id, "kvstore");
    if (!idBdDescr) throw `Permission de modification refusée pour BD ${id}.`;

    const bdDescr = (await this.client.ouvrirBd(idBdDescr)) as KeyValueStore;
    await bdDescr.del(langue);
  }

  async sauvegarderCatégorieVariable(
    id: string,
    catégorie: catégorieVariables
  ): Promise<void> {
    const bdVariable = (await this.client.ouvrirBd(id)) as KeyValueStore;
    await bdVariable.set("catégorie", catégorie);
  }

  async sauvegarderUnitésVariable(
    idVariable: string,
    idUnité: string
  ): Promise<void> {
    const bdVariable = (await this.client.ouvrirBd(
      idVariable
    )) as KeyValueStore;
    await bdVariable.set("unités", idUnité);
  }

  async ajouterRègleVariable(
    idVariable: string,
    règle: règleVariable
  ): Promise<string> {
    const idBdRègles = await this.client.obtIdBd("règles", idVariable, "feed");
    if (!idBdRègles)
      throw `Permission de modification refusée pour variable ${idVariable}.`;

    const id = uuidv4();
    const règleAvecId: règleVariableAvecId = {
      id,
      règle,
    };
    const bdRègles = (await this.client.ouvrirBd(idBdRègles)) as FeedStore;
    await bdRègles.add(règleAvecId);
    return id;
  }

  async effacerRègleVariable(
    idVariable: string,
    idRègle: string
  ): Promise<void> {
    const idBdRègles = await this.client.obtIdBd("règles", idVariable, "feed");
    if (!idBdRègles)
      throw `Permission de modification refusée pour variable ${idVariable}.`;
    const bdRègles = (await this.client.ouvrirBd(idBdRègles)) as FeedStore;

    const entrées =
      ClientConstellation.obtÉlémentsDeBdListe<règleVariableAvecId>(
        bdRègles,
        false
      );
    const entrée = entrées.find((e) => e.payload.value.id === idRègle);
    if (entrée) await bdRègles.remove(entrée.hash);
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
    return await this.client.suivreBd(id, async (bd) => {
      const catégorie = await (bd as KeyValueStore).get("catégorie");
      f(catégorie);
    });
  }

  async suivreUnitésVariable(
    id: string,
    f: schémaFonctionSuivi<string>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd(id, async (bd) => {
      const catégorie = await (bd as KeyValueStore).get("unités");
      f(catégorie);
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

  async établirStatut(
    id: string,
    statut: { statut: string; idNouvelle?: string }
  ): Promise<void> {
    const bd = (await this.client.ouvrirBd(id)) as KeyValueStore;
    await bd.set("statut", statut);
  }

  async marquerObsolète(id: string, idNouvelle?: string): Promise<void> {
    const bd = (await this.client.ouvrirBd(id)) as KeyValueStore;
    bd.set("statut", { statut: STATUT.OBSOLÈTE, idNouvelle });
  }

  async effacerVariable(id: string): Promise<void> {
    // Effacer l'entrée dans notre liste de variables
    const bdRacine = (await this.client.ouvrirBd(this.idBd)) as FeedStore;
    const entrée = bdRacine
      .iterator({ limit: -1 })
      .collect()
      .find((e: élémentBdListe<string>) => e.payload.value === id);
    await bdRacine.remove(entrée.hash);
    await this.client.effacerBd(id);
  }
}
