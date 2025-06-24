import { v4 as uuidv4 } from "uuid";

import { JSONSchemaType } from "ajv";
import { Constellation } from "@/client.js";
import { cacheSuivi } from "@/décorateursCache.js";
import {
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaStatut,
} from "@/types.js";
import { ComposanteClientListe } from "./services.js";
import {
  TOUS,
  résoudreDéfauts,
  ÉpingleFavorisAvecId,
  ÉpingleVariable,
} from "./favoris.js";
import type {
  règleCatégorie,
  règleVariable,
  règleVariableAvecId,
} from "@/valid.js";

import type { objRôles } from "@/accès/types.js";
import type { RecursivePartial, TraducsNom } from "@/types.js";

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

const schémaBdPrincipale: JSONSchemaType<string> = {
  type: "string",
};

export type structureBdVariable = {
  type: string;
  catégorie: Partial<catégorieVariables>;
  noms: TraducsNom;
  unités?: string;
  descriptions: TraducsNom;
  règles: structureBdRèglesVariable;
  statut: Partial<schémaStatut>;
};

const schémaStructureBdVariable: JSONSchemaType<Partial<structureBdVariable>> =
  {
    type: "object",
    properties: {
      type: { type: "string", nullable: true },
      catégorie: {
        type: "object",
        properties: {
          catégorie: { type: "string", nullable: true },
          type: { type: "string", nullable: true },
        },
        required: [],
        nullable: true,
      },
      noms: {
        type: "object",
        additionalProperties: {
          type: "string",
        },
        required: [],
        nullable: true,
      },
      descriptions: {
        type: "object",
        additionalProperties: {
          type: "string",
        },
        required: [],
        nullable: true,
      },
      unités: { type: "string", nullable: true },
      règles: {
        type: "object",
        additionalProperties: {
          type: "object",
          properties: {
            typeRègle: { type: "string" },
            détails: {
              type: "object",
              required: [],
              additionalProperties: true,
            },
          },
          required: ["détails", "typeRègle"],
        },
        required: [],
        nullable: true,
      },
      statut: {
        type: "object",
        properties: {
          idNouvelle: { type: "string", nullable: true },
          statut: { type: "string", nullable: true },
        },
        required: [],
        nullable: true,
      },
    },
    required: [],
  };

export type structureBdRèglesVariable = { [idRègle: string]: règleVariable };
export const schémaBdRèglesVariable: JSONSchemaType<structureBdRèglesVariable> =
  {
    type: "object",
    additionalProperties: {
      type: "object",
      properties: {
        typeRègle: { type: "string" },
        détails: {
          type: "object",
          required: [],
          additionalProperties: true,
        },
      },
      required: ["détails", "typeRègle"],
    },
    required: [],
  };

export class Variables extends ComposanteClientListe<string> {
  constructor({ client }: { client: Constellation }) {
    super({ client, clef: "variables", schémaBdPrincipale });
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisAvecId<ÉpingleVariable>;
    f: schémaFonctionSuivi<Set<string>>;
  }): Promise<schémaFonctionOublier> {
    const épinglerBase = await this.client.favoris.estÉpingléSurDispositif({
      dispositifs: épingle.épingle.base || "TOUS",
    });
    const fOublier = await this.client.suivreBd({
      id: épingle.idObjet,
      type: "nested",
      schéma: schémaStructureBdVariable,
      f: async (bd) => {
        try {
          const contenuBd = await bd.allAsJSON();
          return await f(
            new Set(
              épinglerBase
                ? ([
                    épingle.idObjet,
                    contenuBd.descriptions,
                    contenuBd.noms,
                    contenuBd.règles,
                  ].filter((x) => !!x) as string[])
                : [],
            ),
          );
        } catch {
          return; // Si la structure n'est pas valide.
        }
      },
    });
    return fOublier;
  }

  @cacheSuivi
  async suivreVariables({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({ idCompte, f });
  }

  async créerVariable({
    catégorie,
    épingler = true,
  }: {
    catégorie: catégorieVariables | catégorieBaseVariables;
    épingler?: boolean;
  }): Promise<string> {
    const idVariable = await this.client.créerBdIndépendante({
      type: "nested",
      optionsAccès: {
        address: undefined,
        write: await this.client.obtIdCompte(),
      },
    });
    await this.ajouterÀMesVariables({ idVariable: idVariable });
    if (épingler) await this.épinglerVariable({ idVariable });

    const { bd: bdVariable, fOublier: fOublierVariable } =
      await this.client.ouvrirBdTypée({
        id: idVariable,
        type: "nested",
        schéma: schémaStructureBdVariable,
      });

    await bdVariable.set(
      "catégorie",
      this.standardiserCatégorieVariable(catégorie),
    );

    await this.établirStatut({
      id: idVariable,
      statut: { statut: "active" },
    });

    fOublierVariable();

    return idVariable;
  }

  async ajouterÀMesVariables({
    idVariable,
  }: {
    idVariable: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.obtBd();
    await bd.add(idVariable);
    await fOublier();
  }

  async enleverDeMesVariables({
    idVariable,
  }: {
    idVariable: string;
  }): Promise<void> {
    const { bd: bdRacine, fOublier } = await this.obtBd();
    await bdRacine.del(idVariable);
    await fOublier();
  }

  async épinglerVariable({
    idVariable,
    options = {},
  }: {
    idVariable: string;
    options?: RecursivePartial<ÉpingleVariable>;
  }) {
    const épingle: ÉpingleVariable = résoudreDéfauts(options, {
      type: "variable",
      base: TOUS,
    });
    await this.client.favoris.épinglerFavori({ idObjet: idVariable, épingle });
  }

  async suivreÉpingleVariable({
    idVariable,
    f,
    idCompte,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<ÉpingleVariable | undefined>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.client.favoris.suivreÉtatFavori({
      idObjet: idVariable,
      f: async (épingle) => {
        if (épingle?.type === "variable") await f(épingle);
        else await f(undefined);
      },
      idCompte,
    });
  }

  async copierVariable({
    idVariable,
  }: {
    idVariable: string;
  }): Promise<string> {
    const { bd: bdBase, fOublier: fOublierBase } =
      await this.client.ouvrirBdTypée({
        id: idVariable,
        type: "nested",
        schéma: schémaStructureBdVariable,
      });
    const catégorie = (await bdBase.get("catégorie")) as
      | catégorieVariables
      | catégorieBaseVariables;

    const idNouvelleBd = await this.créerVariable({ catégorie });
    const { bd: bdNouvelle, fOublier: fOublierNouvelle } =
      await this.client.ouvrirBdTypée({
        id: idNouvelleBd,
        type: "nested",
        schéma: schémaStructureBdVariable,
      });

    const noms = await bdBase.get("noms");
    if (noms)
      await this.sauvegarderNomsVariable({ idVariable: idNouvelleBd, noms });

    const descriptions = await bdBase.get("descriptions");
    if (descriptions)
      await this.sauvegarderDescriptionsVariable({
        idVariable: idNouvelleBd,
        descriptions,
      });

    const unités = await bdBase.get("unités");
    if (unités) await bdNouvelle.put("unités", unités);

    const règles = await bdBase.get("règles");
    if (règles) {
      await Promise.allSettled(
        Object.entries(règles).map(async ([id, r]) => {
          await this.ajouterRègleVariable({
            idVariable: idNouvelleBd,
            règle: r,
            idRègle: id,
          });
        }),
      );
    }

    const statut = ((await bdBase.get("statut")) as schémaStatut) || {
      statut: "active",
    };
    await this.établirStatut({ id: idNouvelleBd, statut });

    await Promise.allSettled([fOublierBase(), fOublierNouvelle()]);

    return idNouvelleBd;
  }

  async _confirmerPermission({
    idVariable,
  }: {
    idVariable: string;
  }): Promise<void> {
    if (!(await this.client.permission({ idObjet: idVariable })))
      throw new Error(
        `Permission de modification refusée pour la variable ${idVariable}.`,
      );
  }

  async inviterAuteur({
    idVariable,
    idCompteAuteur,
    rôle,
  }: {
    idVariable: string;
    idCompteAuteur: string;
    rôle: keyof objRôles;
  }): Promise<void> {
    await this.client.donnerAccès({
      idBd: idVariable,
      identité: idCompteAuteur,
      rôle,
    });
  }

  async sauvegarderNomsVariable({
    idVariable,
    noms,
  }: {
    idVariable: string;
    noms: TraducsNom;
  }): Promise<void> {
    await this._confirmerPermission({ idVariable });

    const { bd: bdVariable, fOublier } = await this.client.ouvrirBdTypée({
      id: idVariable,
      type: "nested",
      schéma: schémaStructureBdVariable,
    });
    for (const lng in noms) {
      await bdVariable.set(`noms/${lng}`, noms[lng]);
    }
    await fOublier();
  }

  async sauvegarderNomVariable({
    idVariable,
    langue,
    nom,
  }: {
    idVariable: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    await this._confirmerPermission({ idVariable });

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBdTypée({
      id: idVariable,
      type: "nested",
      schéma: schémaStructureBdVariable,
    });

    await bdNoms.put(`noms/${langue}`, nom);
    await fOublier();
  }

  async effacerNomVariable({
    idVariable,
    langue,
  }: {
    idVariable: string;
    langue: string;
  }): Promise<void> {
    await this._confirmerPermission({ idVariable });

    const { bd: bdVariable, fOublier } = await this.client.ouvrirBdTypée({
      id: idVariable,
      type: "nested",
      schéma: schémaStructureBdVariable,
    });

    await bdVariable.del(`noms/${langue}`);
    await fOublier();
  }

  async sauvegarderDescriptionsVariable({
    idVariable,
    descriptions,
  }: {
    idVariable: string;
    descriptions: TraducsNom;
  }): Promise<void> {
    await this._confirmerPermission({ idVariable });

    const { bd: bdVariable, fOublier } = await this.client.ouvrirBdTypée({
      id: idVariable,
      type: "nested",
      schéma: schémaStructureBdVariable,
    });
    for (const lng in descriptions) {
      await bdVariable.set(`descriptions/${lng}`, descriptions[lng]);
    }
    await fOublier();
  }

  async sauvegarderDescriptionVariable({
    idVariable,
    langue,
    description,
  }: {
    idVariable: string;
    langue: string;
    description: string;
  }): Promise<void> {
    await this._confirmerPermission({ idVariable });

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBdTypée({
      id: idVariable,
      type: "nested",
      schéma: schémaStructureBdVariable,
    });
    await bdDescr.set(`descriptions/${langue}`, description);

    await fOublier();
  }

  async effacerDescriptionVariable({
    idVariable,
    langue,
  }: {
    idVariable: string;
    langue: string;
  }): Promise<void> {
    await this._confirmerPermission({ idVariable });

    const { bd: bdVariable, fOublier } = await this.client.ouvrirBdTypée({
      id: idVariable,
      type: "nested",
      schéma: schémaStructureBdVariable,
    });
    await bdVariable.del(`descriptions/${langue}`);

    await fOublier();
  }

  async sauvegarderCatégorieVariable({
    idVariable,
    catégorie,
  }: {
    idVariable: string;
    catégorie: catégorieVariables | catégorieBaseVariables;
  }): Promise<void> {
    const { bd: bdVariable, fOublier } = await this.client.ouvrirBdTypée({
      id: idVariable,
      type: "nested",
      schéma: schémaStructureBdVariable,
    });
    await bdVariable.putNested({
      catégorie: this.standardiserCatégorieVariable(catégorie),
    });

    await fOublier();
  }

  standardiserCatégorieVariable(
    catégorie: catégorieBaseVariables | catégorieVariables,
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
    const { bd: bdVariable, fOublier } = await this.client.ouvrirBdTypée({
      id: idVariable,
      type: "nested",
      schéma: schémaStructureBdVariable,
    });
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
    await this._confirmerPermission({ idVariable });

    idRègle = idRègle || uuidv4();

    const { bd: bdVariable, fOublier } = await this.client.ouvrirBdTypée({
      id: idVariable,
      type: "nested",
      schéma: schémaStructureBdVariable,
    });
    await bdVariable.putNested({ règles: { idRègle: règle } });

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
    await this._confirmerPermission({ idVariable });

    const { bd: bdVariable, fOublier } = await this.client.ouvrirBdTypée({
      id: idVariable,
      type: "nested",
      schéma: schémaStructureBdVariable,
    });
    await bdVariable.del(`règles/${idRègle}`);

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
    idVariable,
    f,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idVariable,
      type: "nested",
      schéma: schémaStructureBdVariable,
      f: async (bd) => {
        const noms = await bd.get("noms");
        await f(noms || {});
      },
    });
  }

  @cacheSuivi
  async suivreDescriptionsVariable({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idVariable,
      type: "nested",
      schéma: schémaStructureBdVariable,
      f: async (bd) => {
        const desciptions = await bd.get("descriptions");
        await f(desciptions || {});
      },
    });
  }

  @cacheSuivi
  async suivreCatégorieVariable({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<catégorieVariables>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idVariable,
      type: "nested",
      schéma: schémaStructureBdVariable,
      f: async (bd) => {
        const catégorie = await bd.get("catégorie");
        if (catégorie && catégorie.catégorie && catégorie.type)
          await f(
            this.standardiserCatégorieVariable(catégorie as catégorieVariables),
          );
      },
    });
  }

  @cacheSuivi
  async suivreUnitésVariable({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<string | null>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idVariable,
      type: "nested",
      schéma: schémaStructureBdVariable,
      f: async (bd) => {
        const unités = await bd.get("unités");
        await f(unités || null);
      },
    });
  }

  @cacheSuivi
  async suivreRèglesVariable({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<règleVariableAvecId[]>;
  }): Promise<schémaFonctionOublier> {
    const règles: {
      catégorie: { [id: string]: règleVariable };
      propres: { [id: string]: règleVariable };
    } = {
      catégorie: {},
      propres: {},
    };
    const fFinale = async () => {
      await f(
        Object.entries(Object.assign({}, règles.catégorie, règles.propres)).map(
          ([id, r]) => ({
            id,
            règle: r,
          }),
        ),
      );
    };

    const fSuivreCatégorie = async (catégorie: catégorieVariables) => {
      const règleCat: { [id: string]: règleCatégorie } = {
        [uuidv4()]: {
          typeRègle: "catégorie",
          détails: { catégorie },
        },
      };
      règles.catégorie = règleCat;
      await fFinale();
    };
    const fOublierCatégorie = await this.suivreCatégorieVariable({
      idVariable,
      f: fSuivreCatégorie,
    });

    const fSuivreRèglesPropres = async (rgls: {
      [id: string]: règleVariable;
    }) => {
      règles.propres = rgls;
      await fFinale();
    };
    const fOublierRèglesPropres = await this.client.suivreBdDicDeClef({
      id: idVariable,
      clef: "règles",
      schéma: schémaBdRèglesVariable,
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
    idVariable,
    f,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<number>;
  }): Promise<schémaFonctionOublier> {
    const rés: {
      noms: { [key: string]: string };
      descr: { [key: string]: string };
      règles: règleVariableAvecId<règleVariable>[];
      unités?: string | null;
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
      idVariable,
      f: async (noms) => {
        rés.noms = noms;
        await fFinale();
      },
    });

    const oublierDescr = await this.suivreDescriptionsVariable({
      idVariable,
      f: async (descr) => {
        rés.descr = descr;
        await fFinale();
      },
    });

    const oublierUnités = await this.suivreUnitésVariable({
      idVariable,
      f: async (unités) => {
        rés.unités = unités;
        await fFinale();
      },
    });

    const oublierCatégorie = await this.suivreCatégorieVariable({
      idVariable,
      f: async (catégorie) => {
        rés.catégorie = catégorie;
        await fFinale();
      },
    });

    const oublierRègles = await this.suivreRèglesVariable({
      idVariable,
      f: async (règles) => {
        rés.règles = règles;
        await fFinale();
      },
    });

    const fOublier = async () => {
      await Promise.allSettled([
        oublierNoms(),
        oublierDescr(),
        oublierUnités(),
        oublierCatégorie(),
        oublierRègles(),
      ]);
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
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id,
      type: "nested",
      schéma: schémaStructureBdVariable,
    });
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
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id,
      type: "nested",
      schéma: schémaStructureBdVariable,
    });
    bd.putNested({ statut: { statut: "obsolète", idNouvelle } });
    await fOublier();
  }

  async effacerVariable({ idVariable }: { idVariable: string }): Promise<void> {
    // Effacer l'entrée dans notre liste de variables
    await this.enleverDeMesVariables({ idVariable });
    await this.client.favoris.désépinglerFavori({ idObjet: idVariable });

    await this.client.effacerBd({ id: idVariable });
  }
}
