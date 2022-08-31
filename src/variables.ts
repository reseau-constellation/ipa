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

  constructor({ client, id }: { client: ClientConstellation; id: string }) {
    this.client = client;
    this.idBd = id;
  }

  async suivreVariables({
    f,
    idBdVariables,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idBdVariables?: string;
  }): Promise<schémaFonctionOublier> {
    idBdVariables = idBdVariables || this.idBd;
    return await this.client.suivreBdListe<string>({ id: idBdVariables, f });
  }

  async créerVariable({
    catégorie,
  }: {
    catégorie: catégorieVariables;
  }): Promise<string> {
    const idBdVariable = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès: {
        adresseBd: undefined,
        premierMod: this.client.bdCompte!.id,
      },
    });
    await this.ajouterÀMesVariables({ id: idBdVariable });

    const { bd: bdVariable, fOublier: fOublierVariable } =
      await this.client.ouvrirBd<KeyValueStore<typeÉlémentsBdVariable>>({
        id: idBdVariable,
      });

    const accès = bdVariable.access as unknown as ContrôleurConstellation;
    const optionsAccès = { adresseBd: accès.adresseBd };

    await bdVariable.set("type", "variable");

    const idBdNoms = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdVariable.set("noms", idBdNoms);

    const idBdDescr = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdVariable.set("descriptions", idBdDescr);

    const idBdRègles = await this.client.créerBdIndépendante({
      type: "feed",
      optionsAccès,
    });
    await bdVariable.set("règles", idBdRègles);

    await bdVariable.set("catégorie", catégorie);

    await this.établirStatut({
      id: idBdVariable,
      statut: { statut: TYPES_STATUT.ACTIVE },
    });

    fOublierVariable();

    return idBdVariable;
  }

  async ajouterÀMesVariables({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<FeedStore<string>>({
      id: this.idBd,
    });
    await bd.add(id);
    fOublier();
  }

  async enleverDeMesVariables({ id }: { id: string }): Promise<void> {
    const { bd: bdRacine, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >({ id: this.idBd });
    await this.client.effacerÉlémentDeBdListe({ bd: bdRacine, élément: id });
    fOublier();
  }

  async copierVariable({ id }: { id: string }): Promise<string> {
    const { bd: bdBase, fOublier: fOublierBase } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdVariable>
    >({ id });
    const catégorie = bdBase.get("catégorie") as catégorieVariables;

    const idNouvelleBd = await this.créerVariable({ catégorie });
    const { bd: bdNouvelle, fOublier: fOublierNouvelle } =
      await this.client.ouvrirBd<KeyValueStore<typeÉlémentsBdVariable>>({
        id: idNouvelleBd,
      });

    const idBdNoms = bdBase.get("noms") as string;
    const { bd: bdNoms, fOublier: fOublierBdNoms } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    const noms = ClientConstellation.obtObjetdeBdDic({ bd: bdNoms }) as {
      [key: string]: string;
    };
    await this.ajouterNomsVariable({ id: idNouvelleBd, noms });

    const idBdDescr = bdBase.get("descriptions") as string;
    const { bd: bdDescr, fOublier: fOublierBdDescr } =
      await this.client.ouvrirBd<KeyValueStore<string>>({ id: idBdDescr });
    const descriptions = ClientConstellation.obtObjetdeBdDic({
      bd: bdDescr,
    }) as {
      [key: string]: string;
    };
    await this.ajouterDescriptionsVariable({ id: idNouvelleBd, descriptions });

    const unités = bdBase.get("unités");
    if (unités) await bdNouvelle.put("unités", unités);

    const idBdRègles = bdBase.get("règles") as string;
    const { bd: bdRègles, fOublier: fOublierBdRègles } =
      await this.client.ouvrirBd<FeedStore<règleVariableAvecId>>({
        id: idBdRègles,
      });
    const règles = ClientConstellation.obtÉlémentsDeBdListe({
      bd: bdRègles,
    }) as règleVariableAvecId[];

    await Promise.all(
      règles.map(async (r: règleVariableAvecId) => {
        await this.ajouterRègleVariable({
          idVariable: idNouvelleBd,
          règle: r.règle,
        });
      })
    );

    const statut = (bdBase.get("statut") as schémaStatut) || {
      statut: TYPES_STATUT.ACTIVE,
    };
    await this.établirStatut({ id: idNouvelleBd, statut });

    fOublierBase();
    fOublierNouvelle();
    fOublierBdNoms();
    fOublierBdDescr();
    fOublierBdRègles();

    return idNouvelleBd;
  }

  async inviterAuteur({
    idVariable,
    idBdCompteAuteur,
    rôle,
  }: {
    idVariable: string;
    idBdCompteAuteur: string;
    rôle: keyof objRôles;
  }): Promise<void> {
    await this.client.donnerAccès({
      idBd: idVariable,
      identité: idBdCompteAuteur,
      rôle,
    });
  }

  async ajouterNomsVariable({
    id,
    noms,
  }: {
    id: string;
    noms: dicTrads;
  }): Promise<void> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: id,
      type: "kvstore",
    });
    if (!idBdNoms) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
    fOublier();
  }

  async sauvegarderNomVariable({
    id,
    langue,
    nom,
  }: {
    id: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: id,
      type: "kvstore",
    });
    if (!idBdNoms) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    await bdNoms.set(langue, nom);
    fOublier();
  }

  async effacerNomVariable({
    id,
    langue,
  }: {
    id: string;
    langue: string;
  }): Promise<void> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: id,
      type: "kvstore",
    });
    if (!idBdNoms) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    await bdNoms.del(langue);
    fOublier();
  }

  async ajouterDescriptionsVariable({
    id,
    descriptions,
  }: {
    id: string;
    descriptions: dicTrads;
  }): Promise<void> {
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: id,
      type: "kvstore",
    });
    if (!idBdDescr) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdDescr });
    for (const lng in descriptions) {
      await bdDescr.set(lng, descriptions[lng]);
    }
    fOublier();
  }

  async sauvegarderDescrVariable({
    id,
    langue,
    description,
  }: {
    id: string;
    langue: string;
    description: string;
  }): Promise<void> {
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: id,
      type: "kvstore",
    });
    if (!idBdDescr) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdDescr });
    await bdDescr.set(langue, description);

    fOublier();
  }

  async effacerDescrVariable({
    id,
    langue,
  }: {
    id: string;
    langue: string;
  }): Promise<void> {
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: id,
      type: "kvstore",
    });
    if (!idBdDescr) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdDescr });
    await bdDescr.del(langue);

    fOublier();
  }

  async sauvegarderCatégorieVariable({
    idVariable,
    catégorie,
  }: {
    idVariable: string;
    catégorie: catégorieVariables;
  }): Promise<void> {
    const { bd: bdVariable, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdVariable>
    >({ id: idVariable });
    await bdVariable.set("catégorie", catégorie);

    fOublier();
  }

  async sauvegarderUnitésVariable({
    idVariable,
    idUnité,
  }: {
    idVariable: string;
    idUnité: string;
  }): Promise<void> {
    const { bd: bdVariable, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdVariable>
    >({ id: idVariable });
    await bdVariable.set("unités", idUnité);

    fOublier();
  }

  async ajouterRègleVariable({
    idVariable,
    règle,
    idRègle,
  }: {
    idVariable: string;
    règle: règleVariable;
    idRègle?: string;
  }): Promise<string> {
    const idBdRègles = await this.client.obtIdBd({
      nom: "règles",
      racine: idVariable,
      type: "feed",
    });
    if (!idBdRègles) {
      throw `Permission de modification refusée pour variable ${idVariable}.`;
    }

    idRègle = idRègle || uuidv4();
    const règleAvecId: règleVariableAvecId = {
      id: idRègle,
      règle,
    };
    const { bd: bdRègles, fOublier } = await this.client.ouvrirBd<
      FeedStore<règleVariableAvecId>
    >({ id: idBdRègles });
    await bdRègles.add(règleAvecId);

    fOublier();

    return idRègle;
  }

  async effacerRègleVariable({
    idVariable,
    idRègle,
  }: {
    idVariable: string;
    idRègle: string;
  }): Promise<void> {
    const idBdRègles = await this.client.obtIdBd({
      nom: "règles",
      racine: idVariable,
      type: "feed",
    });
    if (!idBdRègles) {
      throw `Permission de modification refusée pour variable ${idVariable}.`;
    }
    const { bd: bdRègles, fOublier } = await this.client.ouvrirBd<
      FeedStore<règleVariableAvecId>
    >({ id: idBdRègles });

    await this.client.effacerÉlémentDeBdListe({
      bd: bdRègles,
      élément: (é) => é.payload.value.id === idRègle,
    });

    fOublier();
  }

  async modifierRègleVariable({
    idVariable,
    règleModifiée,
    idRègle,
  }: {
    idVariable: string;
    règleModifiée: règleVariable;
    idRègle: string;
  }): Promise<void> {
    await this.effacerRègleVariable({ idVariable, idRègle });
    await this.ajouterRègleVariable({
      idVariable,
      règle: règleModifiée,
      idRègle,
    });
  }

  async suivreNomsVariable({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({ id, clef: "noms", f });
  }

  async suivreDescrVariable({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({ id, clef: "descriptions", f });
  }

  async suivreCatégorieVariable({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<catégorieVariables>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id,
      f: async (bd: KeyValueStore<typeÉlémentsBdVariable>) => {
        const catégorie = bd.get("catégorie") as catégorieVariables;
        f(catégorie);
      },
    });
  }

  async suivreUnitésVariable({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<string>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id,
      f: async (bd: KeyValueStore<string>) => {
        const unités = bd.get("unités");
        f(unités);
      },
    });
  }

  async suivreRèglesVariable({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<règleVariableAvecId[]>;
  }): Promise<schémaFonctionOublier> {
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
    const fOublierCatégorie = await this.suivreCatégorieVariable({
      id,
      f: fSuivreCatégorie,
    });

    const fSuivreRèglesPropres = (rgls: règleVariableAvecId[]) => {
      règles.propres = rgls;
      fFinale();
    };
    const fOublierRèglesPropres =
      await this.client.suivreBdListeDeClef<règleVariableAvecId>({
        id,
        clef: "règles",
        f: fSuivreRèglesPropres,
      });

    const fOublier = () => {
      fOublierCatégorie();
      fOublierRèglesPropres();
    };
    return fOublier;
  }

  async suivreQualitéVariable({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<number>;
  }): Promise<schémaFonctionOublier> {
    const rés: {
      noms: { [key: string]: string };
      descr: { [key: string]: string };
      règles: règleVariableAvecId<règleVariable>[];
      unités?: string;
      catégorie?: catégorieVariables;
    } = {
      noms: {},
      descr: {},
      règles: [],
    };
    const fFinale = () => {
      const scores = [
        Object.keys(rés.noms).length ? 1 : 0,
        Object.keys(rés.descr).length ? 1 : 0,
      ];
      if (rés.catégorie === "numérique") {
        scores.push(rés.unités ? 1 : 0);
      }
      if (rés.catégorie === "numérique" || rés.catégorie === "catégorique") {
        scores.push(rés.règles.length >= 1 ? 1 : 0);
      }
      const qualité = scores.reduce((a, b) => a + b, 0) / scores.length;
      f(qualité);
    };
    const oublierNoms = await this.suivreNomsVariable({
      id,
      f: (noms) => {
        rés.noms = noms;
        fFinale();
      },
    });

    const oublierDescr = await this.suivreDescrVariable({
      id,
      f: (descr) => {
        rés.descr = descr;
        fFinale();
      },
    });

    const oublierUnités = await this.suivreUnitésVariable({
      id,
      f: (unités) => {
        rés.unités = unités;
        fFinale();
      },
    });

    const oublierCatégorie = await this.suivreCatégorieVariable({
      id,
      f: (catégorie) => {
        rés.catégorie = catégorie;
        fFinale();
      },
    });

    const oublierRègles = await this.suivreRèglesVariable({
      id,
      f: (règles) => {
        rés.règles = règles;
        fFinale();
      },
    });

    const fOublier = () => {
      oublierNoms();
      oublierDescr();
      oublierUnités();
      oublierCatégorie();
      oublierRègles();
    };

    return fOublier;
  }

  async établirStatut({
    id,
    statut,
  }: {
    id: string;
    statut: schémaStatut;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdVariable>
    >({ id });
    await bd.set("statut", statut);
    fOublier();
  }

  async marquerObsolète({
    id,
    idNouvelle,
  }: {
    id: string;
    idNouvelle?: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdVariable>
    >({ id });
    bd.set("statut", { statut: TYPES_STATUT.OBSOLÈTE, idNouvelle });
    fOublier();
  }

  async effacerVariable({ id }: { id: string }): Promise<void> {
    // Effacer l'entrée dans notre liste de variables
    await this.enleverDeMesVariables({ id });

    // Effacer la variable elle-même
    const optionsAccès = await this.client.obtOpsAccès({ idBd: id });
    for (const clef in ["noms", "descriptions", "règles"]) {
      const idBd = await this.client.obtIdBd({
        nom: clef,
        racine: id,
        optionsAccès,
      });
      if (idBd) await this.client.effacerBd({ id: idBd });
    }
    await this.client.effacerBd({ id });
  }
}
