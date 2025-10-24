import { JSONSchemaType } from "ajv";
import { TypedNested, typedNested } from "@constl/bohr-db";
import { faisRien } from "@constl/utils-ipa";
import { toObject } from "@orbitdb/nested-db";
import { v4 as uuidv4 } from "uuid";
import { cacheSuivi } from "@/décorateursCache.js";
import { Constellation, ServicesConstellation } from "./constellation.js";
import { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import { ServiceDonnéesNébuleuse } from "./crabe/services/services.js";
import { schémaStatutDonnées, schémaTraducsTexte } from "./schémas.js";
import { PartielRécursif, StatutDonnées, TraducsTexte } from "./types.js";
import { Oublier, Suivi } from "./crabe/types.js";
import {
  BaseÉpingleFavoris,
  TOUS_DISPOSITIFS,
  résoudreDéfauts,
  ÉpingleFavorisAvecIdBooléennisée,
} from "./favoris.js";
import { mapÀObjet } from "./crabe/utils.js";
import { RègleCatégorie, RègleVariable, RègleVariableAvecId } from "./valid.js";

// Types structure

export type StructureVariable = {
  type: "variable";
  noms: TraducsTexte;
  descriptions: TraducsTexte;
  catégorie: CatégorieVariables;
  unités: string;
  règles: { [idRègle: string]: RègleVariable };
  statut: StatutDonnées;
};

export const schémaVariable: JSONSchemaType<
  PartielRécursif<StructureVariable>
> = {
  type: "object",
  properties: {
    type: { type: "string", nullable: true },
    noms: schémaTraducsTexte,
    descriptions: schémaTraducsTexte,
    catégorie: {
      type: "object",
      properties: {
        catégorie: { type: "string", nullable: true },
        type: { type: "string", nullable: true },
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
          typeRègle: { type: "string", nullable: true },
          détails: {
            type: "object",
            nullable: true,
            required: [],
            additionalProperties: true,
          },
        },
        required: [],
      },
      nullable: true,
      required: [],
    },
    statut: schémaStatutDonnées,
  },
  required: [],
};

export type CatégorieBaseVariables =
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

export type CatégorieVariables =
  | {
      type: "simple";
      catégorie: CatégorieBaseVariables;
    }
  | {
      type: "liste";
      catégorie: CatégorieBaseVariables;
    };

// Types épingles

export type ÉpingleVariable = BaseÉpingleFavoris & {
  type: "variable";
};

// Types service

export type StructureServiceVariables = {
  [variable: string]: null;
};

export const schémaServiceVariables: JSONSchemaType<
  PartielRécursif<StructureServiceVariables>
> = {
  type: "object",
  additionalProperties: {
    type: "null",
    nullable: true,
  },
  required: [],
};

const standardiserCatégorieVariable = (
  catégorie: CatégorieBaseVariables | CatégorieVariables,
): CatégorieVariables => {
  return typeof catégorie === "string"
    ? { type: "simple", catégorie }
    : catégorie;
};

export class Variables<
  L extends ServicesLibp2pCrabe,
> extends ServiceDonnéesNébuleuse<
  "variable",
  StructureServiceVariables,
  L,
  ServicesConstellation
> {
  constructor({ nébuleuse }: { nébuleuse: Constellation }) {
    super({
      clef: "variable",
      nébuleuse,
      dépendances: ["compte", "orbite"],
      options: {
        schéma: schémaServiceVariables,
      },
    });
  }

  @cacheSuivi
  async suivreVariables({
    f,
    idCompte,
  }: {
    f: Suivi<string[] | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    return await this.suivreBd({
      idCompte,
      f: async (variables) =>
        await f(variables ? Object.keys(variables) : undefined),
    });
  }

  async créerVariable({
    catégorie,
    épingler = true,
  }: {
    catégorie: CatégorieVariables | CatégorieBaseVariables;
    épingler?: boolean;
  }): Promise<string> {
    const compte = this.service("compte");
    const { bd, oublier: oublierBd } = await compte.créerObjet({
      type: "nested",
    });
    const idVariable = bd.address;
    await oublierBd();
    const { variable, oublier } = await this.ouvrirVariable({ idVariable });

    await this.ajouterÀMesVariables({ idVariable });

    if (épingler) await this.épinglerVariable({ idVariable });

    await variable.put("type", "variable");
    await variable.set("catégorie", standardiserCatégorieVariable(catégorie));

    await oublier();
    return idVariable;
  }

  async ajouterÀMesVariables({
    idVariable,
  }: {
    idVariable: string;
  }): Promise<void> {
    const bd = await this.bd();
    await bd.put(idVariable, null);
  }

  async enleverDeMesVariables({
    idVariable,
  }: {
    idVariable: string;
  }): Promise<void> {
    const bd = await this.bd();
    await bd.del(idVariable);
  }

  async ouvrirVariable({
    idVariable,
  }: {
    idVariable: string;
  }): Promise<{ variable: TypedNested<StructureVariable>; oublier: Oublier }> {
    const { bd, oublier } = await this.service("orbite").ouvrirBd({
      id: idVariable,
      type: "nested",
    });
    return {
      variable: typedNested<StructureVariable>({
        db: bd,
        schema: schémaVariable,
      }),
      oublier,
    };
  }

  async copierVariable({
    idVariable,
  }: {
    idVariable: string;
  }): Promise<string> {
    const { variable, oublier } = await this.ouvrirVariable({ idVariable });

    const catégorie = mapÀObjet(await variable.get("catégorie"));
    if (!catégorie)
      throw new Error("Catégorie manquante pour la variable originale.");

    const idNouvelleVariable = await this.créerVariable({ catégorie });
    const { variable: nouvelleVariable, oublier: oublierNouvelleVariable } =
      await this.ouvrirVariable({ idVariable: idNouvelleVariable });

    const noms = mapÀObjet(await variable.get("noms"));
    if (noms)
      await this.sauvegarderNomsVariable({
        idVariable: idNouvelleVariable,
        noms,
      });

    const descriptions = mapÀObjet(await variable.get("descriptions"));
    if (descriptions)
      await this.sauvegarderDescriptionsVariable({
        idVariable: idNouvelleVariable,
        descriptions,
      });

    const unités = await variable.get("unités");
    if (unités) await nouvelleVariable.put("unités", unités);

    const règles = mapÀObjet(await variable.get("règles"));
    if (règles) {
      await Promise.allSettled(
        Object.entries(règles).map(async ([id, r]) => {
          await this.ajouterRègleVariable({
            idVariable: idNouvelleVariable,
            règle: r,
            idRègle: id,
          });
        }),
      );
    }

    const statut = mapÀObjet(await variable.get("statut")) || {
      statut: "active",
    };
    await this.sauvegarderStatut({ idVariable: idNouvelleVariable, statut });

    await oublier();
    await oublierNouvelleVariable();

    return idNouvelleVariable;
  }

  async effacerVariable({ idVariable }: { idVariable: string }): Promise<void> {
    // Effacer l'entrée dans notre liste de variables
    await this.enleverDeMesVariables({ idVariable });
    await this.service("favoris").désépinglerFavori({ idObjet: idVariable });

    // Effacer la variable elle-même
    await this.service("orbite").effacerBd({ id: idVariable });
  }

  // Accèss

  async confirmerPermission({
    idVariable,
  }: {
    idVariable: string;
  }): Promise<void> {
    const compte = this.service("compte");

    if (!(await compte.permission({ idObjet: idVariable })))
      throw new Error(
        `Permission de modification refusée pour la variable ${idVariable}.`,
      );
  }

  // Épingler

  async épinglerVariable({
    idVariable,
    options = {},
  }: {
    idVariable: string;
    options?: PartielRécursif<ÉpingleVariable>;
  }) {
    const épingle: ÉpingleVariable = résoudreDéfauts(options, {
      type: "variable",
      base: TOUS_DISPOSITIFS,
    });
    // On court-circuite `this.service("favoris")`
    const favoris = this.nébuleuse.services["favoris"];
    await favoris.épinglerFavori({ idObjet: idVariable, épingle });
  }

  async suivreÉpingleVariable({
    idVariable,
    f,
    idCompte,
  }: {
    idVariable: string;
    f: Suivi<PartielRécursif<ÉpingleVariable> | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    // On court-circuite `this.service("favoris")`
    const favoris = this.nébuleuse.services["favoris"];

    return await favoris.suivreÉtatFavori({
      idObjet: idVariable,
      f: async (épingle) => {
        await f(
          épingle?.type === "variable"
            ? (épingle as PartielRécursif<ÉpingleVariable>)
            : undefined,
        );
      },
      idCompte,
    });
  }

  async désépinglerVariable({
    idVariable,
  }: {
    idVariable: string;
  }): Promise<void> {
    // On court-circuite `this.service("favoris")`
    const favoris = this.nébuleuse.services["favoris"];

    await favoris.désépinglerFavori({ idObjet: idVariable });
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisAvecIdBooléennisée<ÉpingleVariable>;
    f: Suivi<Set<string>>;
  }): Promise<Oublier> {
    await f(new Set(épingle.épingle.base ? [épingle.idObjet] : []));

    return faisRien;
  }

  // Noms

  async sauvegarderNomsVariable({
    idVariable,
    noms,
  }: {
    idVariable: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idVariable });

    const { variable, oublier } = await this.ouvrirVariable({
      idVariable,
    });

    for (const lng in noms) {
      await variable.set(`noms/${lng}`, noms[lng]);
    }

    await oublier();
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
    await this.confirmerPermission({ idVariable });

    const { variable, oublier } = await this.ouvrirVariable({
      idVariable,
    });

    await variable.set(`noms/${langue}`, nom);
    await oublier();
  }

  async effacerNomVariable({
    idVariable,
    langue,
  }: {
    idVariable: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idVariable });
    const { variable, oublier } = await this.ouvrirVariable({
      idVariable,
    });
    await variable.del(`noms/${langue}`);

    await oublier();
  }

  @cacheSuivi
  async suivreNomsVariable({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: Suivi<TraducsTexte | undefined>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idVariable,
      type: "nested",
      schéma: schémaVariable,
      f: (variable) => f(toObject(variable).noms),
    });
  }

  // Descriptions

  async sauvegarderDescriptionsVariable({
    idVariable,
    descriptions,
  }: {
    idVariable: string;
    descriptions: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idVariable });
    const { variable, oublier } = await this.ouvrirVariable({
      idVariable,
    });
    for (const lng in descriptions) {
      await variable.set(`descriptions/${lng}`, descriptions[lng]);
    }
    await oublier();
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
    await this.confirmerPermission({ idVariable });
    const { variable, oublier } = await this.ouvrirVariable({
      idVariable,
    });
    await variable.set(`noms/${langue}`, description);
    await oublier();
  }

  async effacerDescriptionVariable({
    idVariable,
    langue,
  }: {
    idVariable: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idVariable });
    const { variable, oublier } = await this.ouvrirVariable({
      idVariable,
    });
    await variable.del(`noms/${langue}`);
    await oublier();
  }

  @cacheSuivi
  async suivreDescriptionsVariable({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: Suivi<{ [key: string]: string }>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idVariable,
      type: "nested",
      schéma: schémaVariable,
      f: (variable) => f(toObject(variable).noms),
    });
  }

  // Catégories

  async sauvegarderCatégorieVariable({
    idVariable,
    catégorie,
  }: {
    idVariable: string;
    catégorie: CatégorieVariables | CatégorieBaseVariables;
  }): Promise<void> {
    const { variable, oublier } = await this.ouvrirVariable({ idVariable });
    await variable.put({
      catégorie: standardiserCatégorieVariable(catégorie),
    });

    await oublier();
  }

  @cacheSuivi
  async suivreCatégorieVariable({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: Suivi<CatégorieVariables | undefined>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");

    return await orbite.suivreDonnéesBd({
      id: idVariable,
      type: "nested",
      schéma: schémaVariable,
      f: async (variable) => {
        const catégorie = mapÀObjet(variable.get("catégorie"));
        await f(
          catégorie ? standardiserCatégorieVariable(catégorie) : undefined,
        );
      },
    });
  }

  // Unités

  async sauvegarderUnitésVariable({
    idVariable,
    idUnité,
  }: {
    idVariable: string;
    idUnité: string;
  }): Promise<void> {
    const { variable, oublier } = await this.ouvrirVariable({ idVariable });

    await variable.set("unités", idUnité);

    await oublier();
  }

  @cacheSuivi
  async suivreUnitésVariable({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: Suivi<string | undefined>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idVariable,
      type: "nested",
      schéma: schémaVariable,
      f: async (variable) => {
        const unités = variable.get("unités");
        await f(unités);
      },
    });
  }

  // Règles

  async ajouterRègleVariable({
    idVariable,
    règle,
    idRègle,
  }: {
    idVariable: string;
    règle: RègleVariable;
    idRègle?: string;
  }): Promise<string> {
    await this.confirmerPermission({ idVariable });

    idRègle = idRègle || uuidv4();

    const { variable, oublier } = await this.ouvrirVariable({ idVariable });
    await variable.put({ règles: { idRègle: règle } });

    await oublier();

    return idRègle;
  }

  async effacerRègleVariable({
    idVariable,
    idRègle,
  }: {
    idVariable: string;
    idRègle: string;
  }): Promise<void> {
    await this.confirmerPermission({ idVariable });

    const { variable, oublier } = await this.ouvrirVariable({ idVariable });
    await variable.del(`règles/${idRègle}`);

    await oublier();
  }

  async modifierRègleVariable({
    idVariable,
    règleModifiée,
    idRègle,
  }: {
    idVariable: string;
    règleModifiée: RègleVariable;
    idRègle: string;
  }): Promise<void> {
    const { variable, oublier } = await this.ouvrirVariable({ idVariable });
    await variable.put(`règles/${idRègle}`, règleModifiée);

    await oublier();
  }

  @cacheSuivi
  async suivreRèglesVariable({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: Suivi<RègleVariableAvecId[]>;
  }): Promise<Oublier> {
    const règles: {
      catégorie: { [id: string]: RègleVariable };
      propres: { [id: string]: RègleVariable };
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

    const oublierCatégorie = await this.suivreCatégorieVariable({
      idVariable,
      f: async (catégorie) => {
        if (catégorie) {
          const règleCat: { [id: string]: RègleCatégorie } = {
            [uuidv4()]: {
              typeRègle: "catégorie",
              détails: { catégorie },
            },
          };
          règles.catégorie = règleCat;
        } else {
          règles.catégorie = {};
        }
        await fFinale();
      },
    });

    const oublierRèglesPropres = await this.service("orbite").suivreDonnéesBd({
      id: idVariable,
      type: "nested",
      schéma: schémaVariable,
      f: async (variable) => {
        règles.propres = mapÀObjet(variable.get("règles")) || {};
        await fFinale();
      },
    });

    return async () => {
      await oublierCatégorie();
      await oublierRèglesPropres();
    };
  }

  // Statut

  async sauvegarderStatut({
    idVariable,
    statut,
  }: {
    idVariable: string;
    statut: StatutDonnées;
  }): Promise<void> {
    const { variable, oublier } = await this.ouvrirVariable({ idVariable });
    await variable.set("statut", statut);

    await oublier();
  }

  // Qualité
  @cacheSuivi
  async suivreQualitéVariable({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: Suivi<number>;
  }): Promise<Oublier> {
    const info: {
      noms?: { [key: string]: string };
      descr?: { [key: string]: string };
      règles?: RègleVariableAvecId<RègleVariable>[];
      unités?: string | null;
      catégorie?: CatégorieVariables;
    } = {};

    const fFinale = async () => {
      const { noms, descr, catégorie, unités, règles } = info;
      const scores = [
        noms && Object.keys(noms).length ? 1 : 0,
        descr && Object.keys(descr).length ? 1 : 0,
      ];
      if (catégorie?.catégorie === "numérique") {
        scores.push(unités ? 1 : 0);
        scores.push(règles && règles.length >= 1 ? 1 : 0);
      }
      const qualité = scores.reduce((a, b) => a + b, 0) / scores.length;
      await f(qualité);
    };
    const oublierNoms = await this.suivreNomsVariable({
      idVariable,
      f: async (noms) => {
        info.noms = noms;
        await fFinale();
      },
    });

    const oublierDescr = await this.suivreDescriptionsVariable({
      idVariable,
      f: async (descr) => {
        info.descr = descr;
        await fFinale();
      },
    });

    const oublierUnités = await this.suivreUnitésVariable({
      idVariable,
      f: async (unités) => {
        info.unités = unités;
        await fFinale();
      },
    });

    const oublierCatégorie = await this.suivreCatégorieVariable({
      idVariable,
      f: async (catégorie) => {
        info.catégorie = catégorie;
        await fFinale();
      },
    });

    const oublierRègles = await this.suivreRèglesVariable({
      idVariable,
      f: async (règles) => {
        info.règles = règles;
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
}
