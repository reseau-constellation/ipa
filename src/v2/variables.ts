import {
  faisRien,
} from "@constl/utils-ipa";
import { v4 as uuidv4 } from "uuid";
import { cacheSuivi } from "./crabe/cache.js";
import { schémaStatutDonnées, schémaTraducsTexte } from "./schémas.js";
import { TOUS_DISPOSITIFS, résoudreDéfauts } from "./crabe/services/favoris.js";
import { mapÀObjet } from "./crabe/utils.js";
import { RechercheVariables } from "./recherche/variables.js";
import { ObjetConstellation } from "./objets.js";
import type { Rôle } from "./crabe/services/compte/accès/index.js";
import type { Constellation } from "./constellation.js";
import type { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import type {
  InfoAuteur,
  PartielRécursif,
  StatutDonnées,
  TraducsTexte,
} from "./types.js";
import type { Oublier, Suivi } from "./crabe/types.js";
import type {
  BaseÉpingleFavoris,
  ÉpingleFavorisBooléenniséeAvecId,
} from "./crabe/services/favoris.js";
import type { TypedNested } from "@constl/bohr-db";
import type { JSONSchemaType } from "ajv";
import type {
  RègleCatégorie,
  RègleVariable,
  RègleVariableAvecId,
} from "./règles.js";

// Types structure

export type StructureVariable = {
  type: "variable";
  noms: TraducsTexte;
  descriptions: TraducsTexte;
  catégorie: CatégorieVariable;
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
          type: { type: "string", nullable: true },
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

export type CatégorieVariable =
  | {
      type: "simple";
      catégorie: CatégorieBaseVariables;
    }
  | {
      type: "liste";
      catégorie: CatégorieBaseVariables;
    };

// Types épingles

export type ÉpingleVariable = {
  type: "variable";
  épingle: ContenuÉpingleVariable;
};

export type ContenuÉpingleVariable = BaseÉpingleFavoris;

const standardiserCatégorieVariable = (
  catégorie: CatégorieBaseVariables | CatégorieVariable,
): CatégorieVariable => {
  return typeof catégorie === "string"
    ? { type: "simple", catégorie }
    : catégorie;
};

export class Variables<
  L extends ServicesLibp2pCrabe,
> extends ObjetConstellation<"variables", StructureVariable, L> {
  recherche: RechercheVariables<L>;
  schémaObjet = schémaVariable;

  constructor({ nébuleuse }: { nébuleuse: Constellation }) {
    super({
      clef: "variable",
      nébuleuse,
      dépendances: ["compte", "orbite"],
    });

    this.recherche = new RechercheVariables<L>({
      variables: this,
      constl: this.nébuleuse,
      service: (clef) => this.service(clef),
    });

    const favoris = this.service("favoris");
    favoris.inscrireRésolution({
      clef: "variable",
      résolution: this.suivreRésolutionÉpingle.bind(this),
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
    return await this.suivreObjets({ f, idCompte });
  }

  async créerVariable({
    catégorie,
    épingler = true,
  }: {
    catégorie: CatégorieVariable | CatégorieBaseVariables;
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

    if (épingler) await this.épingler({ idVariable });

    await variable.put("type", "variable");
    await variable.set("catégorie", standardiserCatégorieVariable(catégorie));

    await oublier();
    return this.ajouterProtocole(idVariable);
  }

  async ajouterÀMesVariables({
    idVariable,
  }: {
    idVariable: string;
  }): Promise<void> {
    await this.ajouterÀMesObjets({ idObjet: idVariable });
  }

  async enleverDeMesVariables({
    idVariable,
  }: {
    idVariable: string;
  }): Promise<void> {
    await this.enleverDeMesObjets({ idObjet: idVariable });
  }

  async ouvrirVariable({
    idVariable,
  }: {
    idVariable: string;
  }): Promise<{ variable: TypedNested<StructureVariable>; oublier: Oublier }> {
    const { objet: variable, oublier } = await this.ouvrirObjet({
      idObjet: idVariable,
    });
    return { variable, oublier };
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
      await this.sauvegarderNoms({
        idVariable: idNouvelleVariable,
        noms,
      });

    const descriptions = mapÀObjet(await variable.get("descriptions"));
    if (descriptions)
      await this.sauvegarderDescriptions({
        idVariable: idNouvelleVariable,
        descriptions,
      });

    const unités = await variable.get("unités");
    if (unités) await nouvelleVariable.put("unités", unités);

    const règles = mapÀObjet(await variable.get("règles"));
    if (règles) {
      await Promise.allSettled(
        Object.entries(règles).map(async ([id, r]) => {
          await this.ajouterRègle({
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
    await this.sauvegarderStatut({
      idVariable: idNouvelleVariable,
      statut,
    });

    await oublier();
    await oublierNouvelleVariable();

    return idNouvelleVariable;
  }

  async effacerVariable({ idVariable }: { idVariable: string }): Promise<void> {
    // Effacer l'entrée dans notre liste de variables
    await this.enleverDeMesVariables({ idVariable });

    await this.service("favoris").désépinglerFavori({
      idObjet: this.àIdOrbite(idVariable),
    });

    // Effacer la variable elle-même
    await this.service("orbite").effacerBd({ id: this.àIdOrbite(idVariable) });
  }

  // Accèss

  async inviterAuteur({
    idVariable,
    idCompte,
    rôle,
  }: {
    idVariable: string;
    idCompte: string;
    rôle: Rôle;
  }): Promise<void> {
    const compte = this.service("compte");

    return await compte.donnerAccèsObjet({
      idObjet: this.àIdOrbite(idVariable),
      identité: idCompte,
      rôle,
    });
  }

  async suivreAuteurs({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: Suivi<InfoAuteur[]>;
  }): Promise<Oublier> {
    return this.suivreAuteursObjet({ idObjet: idVariable, f });
  }

  async confirmerPermission({
    idVariable,
  }: {
    idVariable: string;
  }): Promise<void> {
    const compte = this.service("compte");

    if (!(await compte.permission({ idObjet: this.àIdOrbite(idVariable) })))
      throw new Error(
        `Permission de modification refusée pour la variable ${idVariable}.`,
      );
  }

  // Épingler

  async épingler({
    idVariable,
    options = {},
  }: {
    idVariable: string;
    options?: PartielRécursif<ContenuÉpingleVariable>;
  }) {
    const épingle: ContenuÉpingleVariable = résoudreDéfauts(options, {
      base: TOUS_DISPOSITIFS,
    });
    const favoris = this.service("favoris");
    await favoris.épinglerFavori({
      idObjet: idVariable,
      épingle: { type: "variable", épingle },
    });
  }

  async suivreÉpingle({
    idVariable,
    f,
    idCompte,
  }: {
    idVariable: string;
    f: Suivi<ÉpingleVariable | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    const favoris = this.service("favoris");

    return await favoris.suivreFavoris({
      idCompte,
      f: async (épingles) => {
        const épingleVariable = épingles?.find(({ idObjet, épingle }) => {
          return idObjet === this.àIdOrbite(idVariable) &&
            épingle.type === "variable"
            ? épingle
            : undefined;
        }) as ÉpingleVariable | undefined;
        await f(épingleVariable);
      },
    });
  }

  async désépingler({ idVariable }: { idVariable: string }): Promise<void> {
    const favoris = this.service("favoris");

    await favoris.désépinglerFavori({ idObjet: this.àIdOrbite(idVariable) });
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisBooléenniséeAvecId<ÉpingleVariable>;
    f: Suivi<Set<string>>;
  }): Promise<Oublier> {
    await f(new Set(épingle.épingle.épingle.base ? [épingle.idObjet] : []));

    return faisRien;
  }

  // Noms

  async sauvegarderNoms({
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

  async sauvegarderNom({
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

  async effacerNom({
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
  async suivreNoms({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: Suivi<TraducsTexte | undefined>;
  }): Promise<Oublier> {
    return await this.suivreObjet({
      idObjet: idVariable,
      f: (variable) => f(variable.noms || {}),
    });
  }

  // Descriptions

  async sauvegarderDescriptions({
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

  async sauvegarderDescription({
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

  async effacerDescription({
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
  async suivreDescriptions({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: Suivi<{ [key: string]: string }>;
  }): Promise<Oublier> {
    return await this.suivreObjet({
      idObjet: idVariable,
      f: (variable) => f(variable.descriptions || {}),
    });
  }

  // Catégories

  async sauvegarderCatégorie({
    idVariable,
    catégorie,
  }: {
    idVariable: string;
    catégorie: CatégorieVariable | CatégorieBaseVariables;
  }): Promise<void> {
    const { variable, oublier } = await this.ouvrirVariable({ idVariable });
    await variable.put({
      catégorie: standardiserCatégorieVariable(catégorie),
    });

    await oublier();
  }

  @cacheSuivi
  async suivreCatégorie({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: Suivi<CatégorieVariable | undefined>;
  }): Promise<Oublier> {
    return await this.suivreObjet({
      idObjet: idVariable,
      f: async (variable) => {
        const catégorie = variable["catégorie"];
        await f(
          catégorie ? standardiserCatégorieVariable(catégorie) : undefined,
        );
      },
    });
  }

  // Unités

  async sauvegarderUnités({
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
  async suivreUnités({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: Suivi<string | undefined>;
  }): Promise<Oublier> {
    return this.suivreObjet({
      idObjet: idVariable,
      f: async (variable) => await f(variable["unités"]),
    });
  }

  // Règles

  async ajouterRègle({
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

  async effacerRègle({
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

  async modifierRègle({
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
  async suivreRègles({
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

    const oublierCatégorie = await this.suivreCatégorie({
      idVariable,
      f: async (catégorie) => {
        if (catégorie) {
          const règleCat: { [id: string]: RègleCatégorie } = {
            [uuidv4()]: {
              type: "catégorie",
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

    const oublierRèglesPropres = await this.suivreObjet({
      idObjet: idVariable,
      f: async (variable) => {
        règles.propres = variable.règles || {};
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

  async suivreStatut({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: Suivi<StatutDonnées | null>;
  }): Promise<Oublier> {
    return await this.suivreObjet({
      idObjet: idVariable,
      f: async (variable) => await f(variable.statut),
    });
  }

  // Qualité
  @cacheSuivi
  async suivreScoreQualité({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: Suivi<number>;
  }): Promise<Oublier> {
    const info: {
      noms?: { [key: string]: string };
      descriptions?: { [key: string]: string };
      règles?: RègleVariableAvecId<RègleVariable>[];
      unités?: string | null;
      catégorie?: CatégorieVariable;
    } = {};

    const fFinale = async () => {
      const { noms, descriptions, catégorie, unités, règles } = info;
      const scores = [
        noms && Object.keys(noms).length ? 1 : 0,
        descriptions && Object.keys(descriptions).length ? 1 : 0,
      ];
      if (catégorie?.catégorie === "numérique") {
        scores.push(unités ? 1 : 0);
        scores.push(règles && règles.length >= 1 ? 1 : 0);
      }
      const qualité = scores.reduce((a, b) => a + b, 0) / scores.length;
      await f(qualité);
    };
    const oublierNoms = await this.suivreNoms({
      idVariable,
      f: async (noms) => {
        info.noms = noms;
        await fFinale();
      },
    });

    const oublierDescr = await this.suivreDescriptions({
      idVariable,
      f: async (descriptions) => {
        info.descriptions = descriptions;
        await fFinale();
      },
    });

    const oublierUnités = await this.suivreUnités({
      idVariable,
      f: async (unités) => {
        info.unités = unités;
        await fFinale();
      },
    });

    const oublierCatégorie = await this.suivreCatégorie({
      idVariable,
      f: async (catégorie) => {
        info.catégorie = catégorie;
        await fFinale();
      },
    });

    const oublierRègles = await this.suivreRègles({
      idVariable,
      f: async (règles) => {
        info.règles = règles;
        await fFinale();
      },
    });

    const oublier = async () => {
      await Promise.allSettled([
        oublierNoms(),
        oublierDescr(),
        oublierUnités(),
        oublierCatégorie(),
        oublierRègles(),
      ]);
    };

    return oublier;
  }
}
