import { v4 as uuidv4 } from "uuid";

import ClientConstellation from "@/client.js";
import type { default as ContrôleurConstellation } from "@/accès/cntrlConstellation.js";
import type {
  règleVariableAvecId,
  règleVariable,
  règleCatégorie,
} from "@/valid.js";

import type { objRôles } from "@/accès/types.js";
import type { dicTrads } from "@/utils/types.js";
import { cacheSuivi } from "@/décorateursCache.js";

import {
  TYPES_STATUT,
  schémaFonctionSuivi,
  schémaFonctionOublier,
  schémaStatut,
} from "@/utils/index.js";
import { ComposanteClientListe } from "./composanteClient.js";
import { JSONSchemaType } from "ajv";

export type catégorieBaseVariables =
  | "numérique"
  | "horoDatage"
  | "intervaleTemps"
  | "chaîne"
  | "chaîneNonTraductible"
  | "booléen"
  | "géojson"
  | "vidéo"
  | "audio"
  | "image"
  | "fichier";

export type catégorieVariables =
  | {
      type: "simple";
      catégorie: catégorieBaseVariables;
    }
  | {
      type: "liste";
      catégorie: catégorieBaseVariables;
    };

export type structureBdVariable = {
  type: string,
  catégorie: catégorieVariables,
  noms: string,
  descriptions: string,
  règles: string,
  statut: schémaStatut
};

const schémaStructureBdVariable: JSONSchemaType<structureBdVariable> = {
  type: "object",
  properties: {
    type: {type: "string"},
    catégorie: {
      type: "object",
      properties: {
        catégorie: {type: "string"},
        type: {type: "string"}
      },
      required: ["catégorie", "type"]
    },
    noms: {type: "string"},
    descriptions: {type: "string"},
    règles: {type: "string"},
    statut: {
      type: "object",
      properties: {
        idNouvelle: {type: "string", nullable: true},
        statut: {type: "string"},
      },
      required: ['statut']
    },
  },
  required: ["type", "catégorie", "statut"]
}

export default class Variables extends ComposanteClientListe<string> {

  constructor({ client }: { client: ClientConstellation }) {
    super({client, clef: "variables"})
  }

  async épingler() {
    await this.client.épingles?.épinglerBd({
      id: await this.obtIdBd(),
      récursif: false,
      fichiers: false,
    });
  }

  @cacheSuivi
  async suivreVariables({
    f,
    idBdVariables,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idBdVariables?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({ idBd: idBdVariables, f });
  }

  async créerVariable({
    catégorie,
  }: {
    catégorie: catégorieVariables | catégorieBaseVariables;
  }): Promise<string> {
    const idBdVariable = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès: {
        address: undefined,
        premierMod: this.client.bdCompte!.id,
      },
    });
    await this.ajouterÀMesVariables({ id: idBdVariable });

    const { bd: bdVariable, fOublier: fOublierVariable } =
      await this.client.ouvrirBd({
        id: idBdVariable,
        type: 'keyvalue',
        schéma: schémaStructureBdVariable
      });

    const accès = bdVariable.access as unknown as ContrôleurConstellation;
    const optionsAccès = { address: accès.address };

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

    await bdVariable.set(
      "catégorie",
      this.standardiserCatégorieVariable(catégorie)
    );

    await this.établirStatut({
      id: idBdVariable,
      statut: { statut: TYPES_STATUT.ACTIVE },
    });

    fOublierVariable();

    return idBdVariable;
  }

  async ajouterÀMesVariables({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<string>({
      id: await this.obtIdBd(),
      type: "feed",
    });
    await bd.add(id);
    await fOublier();
  }

  async enleverDeMesVariables({ id }: { id: string }): Promise<void> {
    const { bd: bdRacine, fOublier } = await this.client.ouvrirBd<string>({ 
      id: await this.obtIdBd(),
      type: "feed"
    });
    await this.client.effacerÉlémentDeBdListe({ bd: bdRacine, élément: id });
    await fOublier();
  }

  async copierVariable({ id }: { id: string }): Promise<string> {
    const { bd: bdBase, fOublier: fOublierBase } = await this.client.ouvrirBd({ 
      id, type: "keyvalue", schéma: schémaStructureBdVariable 
    });
    const catégorie = bdBase.get("catégorie") as
      | catégorieVariables
      | catégorieBaseVariables;

    const idNouvelleBd = await this.créerVariable({ catégorie });
    const { bd: bdNouvelle, fOublier: fOublierNouvelle } =
      await this.client.ouvrirBd({
        id: idNouvelleBd, type: "keyvalue", schéma: schémaStructureBdVariable 
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
    if (!idBdNoms)
      throw new Error(`Permission de modification refusée pour BD ${id}.`);

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
    await fOublier();
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
    if (!idBdNoms)
      throw new Error(`Permission de modification refusée pour BD ${id}.`);

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    await bdNoms.set(langue, nom);
    await fOublier();
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
    if (!idBdNoms)
      throw new Error(`Permission de modification refusée pour BD ${id}.`);

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    await bdNoms.del(langue);
    await fOublier();
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
    if (!idBdDescr)
      throw new Error(`Permission de modification refusée pour BD ${id}.`);

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdDescr });
    for (const lng in descriptions) {
      await bdDescr.set(lng, descriptions[lng]);
    }
    await fOublier();
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
    if (!idBdDescr)
      throw new Error(`Permission de modification refusée pour BD ${id}.`);

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdDescr });
    await bdDescr.set(langue, description);

    await fOublier();
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
    if (!idBdDescr)
      throw new Error(`Permission de modification refusée pour BD ${id}.`);

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdDescr });
    await bdDescr.del(langue);

    await fOublier();
  }

  async sauvegarderCatégorieVariable({
    idVariable,
    catégorie,
  }: {
    idVariable: string;
    catégorie: catégorieVariables | catégorieBaseVariables;
  }): Promise<void> {
    const { bd: bdVariable, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdVariable>
    >({ id: idVariable });
    await bdVariable.set(
      "catégorie",
      this.standardiserCatégorieVariable(catégorie)
    );

    await fOublier();
  }

  standardiserCatégorieVariable(
    catégorie: catégorieBaseVariables | catégorieVariables
  ): catégorieVariables {
    return typeof catégorie === "string"
      ? { type: "simple", catégorie }
      : catégorie;
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

    await fOublier();
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
      throw new Error(
        `Permission de modification refusée pour variable ${idVariable}.`
      );
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

    await fOublier();

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
      throw new Error(
        `Permission de modification refusée pour variable ${idVariable}.`
      );
    }
    const { bd: bdRègles, fOublier } = await this.client.ouvrirBd<
      FeedStore<règleVariableAvecId>
    >({ id: idBdRègles });

    await this.client.effacerÉlémentDeBdListe({
      bd: bdRègles,
      élément: (é) => é.payload.value.id === idRègle,
    });

    await fOublier();
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

  @cacheSuivi
  async suivreNomsVariable({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({ id, clef: "noms", f });
  }

  @cacheSuivi
  async suivreDescrVariable({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({ id, clef: "descriptions", f });
  }

  @cacheSuivi
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
        if (catégorie) await f(this.standardiserCatégorieVariable(catégorie));
      },
    });
  }

  @cacheSuivi
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
        await f(unités);
      },
    });
  }

  @cacheSuivi
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
    const fFinale = async () => {
      await f([...règles.catégorie, ...règles.propres]);
    };

    const fSuivreCatégorie = async (catégorie: catégorieVariables) => {
      const règleCat: règleVariableAvecId<règleCatégorie> = {
        id: uuidv4(),
        règle: {
          typeRègle: "catégorie",
          détails: { catégorie },
        },
      };
      règles.catégorie = [règleCat];
      await fFinale();
    };
    const fOublierCatégorie = await this.suivreCatégorieVariable({
      id,
      f: fSuivreCatégorie,
    });

    const fSuivreRèglesPropres = async (rgls: règleVariableAvecId[]) => {
      règles.propres = rgls;
      await fFinale();
    };
    const fOublierRèglesPropres =
      await this.client.suivreBdListeDeClef<règleVariableAvecId>({
        id,
        clef: "règles",
        f: fSuivreRèglesPropres,
      });

    const fOublier = async () => {
      await fOublierCatégorie();
      await fOublierRèglesPropres();
    };
    return fOublier;
  }

  @cacheSuivi
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
    const fFinale = async () => {
      const scores = [
        Object.keys(rés.noms).length ? 1 : 0,
        Object.keys(rés.descr).length ? 1 : 0,
      ];
      if (rés.catégorie?.catégorie === "numérique") {
        scores.push(rés.unités ? 1 : 0);
      }
      if (rés.catégorie?.catégorie === "numérique") {
        scores.push(rés.règles.length >= 1 ? 1 : 0);
      }
      const qualité = scores.reduce((a, b) => a + b, 0) / scores.length;
      await f(qualité);
    };
    const oublierNoms = await this.suivreNomsVariable({
      id,
      f: async (noms) => {
        rés.noms = noms;
        await fFinale();
      },
    });

    const oublierDescr = await this.suivreDescrVariable({
      id,
      f: async (descr) => {
        rés.descr = descr;
        await fFinale();
      },
    });

    const oublierUnités = await this.suivreUnitésVariable({
      id,
      f: async (unités) => {
        rés.unités = unités;
        await fFinale();
      },
    });

    const oublierCatégorie = await this.suivreCatégorieVariable({
      id,
      f: async (catégorie) => {
        rés.catégorie = catégorie;
        await fFinale();
      },
    });

    const oublierRègles = await this.suivreRèglesVariable({
      id,
      f: async (règles) => {
        rés.règles = règles;
        await fFinale();
      },
    });

    const fOublier = async () => {
      await oublierNoms();
      await oublierDescr();
      await oublierUnités();
      await oublierCatégorie();
      await oublierRègles();
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
    await fOublier();
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
    await fOublier();
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
