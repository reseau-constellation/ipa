import { isElectronMain, isNode } from "wherearewe";

import { JSONSchemaType } from "ajv";
import { faisRien, suivreBdsDeFonctionListe  } from "@constl/utils-ipa";
import deepEqual from "deep-equal";
import deepcopy from "deepcopy";
import { cacheSuivi } from "@/décorateursCache.js";
import { ComposanteClientDic } from "./composanteClient.js";
import type { Constellation } from "@/client.js";
import type {
  RecursivePartial,
  schémaFonctionOublier,
  schémaFonctionSuivi,
} from "@/types.js";

export const TOUS = "TOUS" as const;
export const INSTALLÉ = "INSTALLÉ" as const;
export const AUCUN = "AUCUN" as const;

export const résoudreDéfauts = <T extends { [clef: string]: unknown }>(
  épingle: RecursivePartial<T>,
  défauts: T,
): T => {
  const copieDéfauts = deepcopy(défauts);
  for (const [clef, val] of Object.entries(épingle)) {
    if (typeof val === "string" || Array.isArray(val)) {
      copieDéfauts[clef as keyof T] = val as T[keyof T];
    } else {
      copieDéfauts[clef as keyof T] = résoudreDéfauts(
        val,
        copieDéfauts[clef] as { [clef: string]: unknown },
      ) as T[keyof T];
    }
  }
  return copieDéfauts;
};

export type typeDispositifs =
  | string
  | string[]
  | typeof TOUS
  | typeof INSTALLÉ
  | typeof AUCUN;

export type BooléenniserPropriétés<T extends object> = {
  [clef in keyof T]?: T[clef] extends object
    ? BooléenniserPropriétés<T[clef]>
    : boolean;
};

export type ÉpingleFavoris =
  | ÉpingleVariable
  | ÉpingleMotClef
  | ÉpingleBd
  | ÉpingleNuée
  | ÉpingleProjet
  | ÉpingleCompte
  | ÉpingleProfil;

export type BaseÉpingleFavoris = {
  base: typeDispositifs;
};

export type ÉpingleBd = BaseÉpingleFavoris & {
  type: "bd";
  données: {
    tableaux: typeDispositifs;
    fichiers: typeDispositifs;
  };
};

export type ÉpingleNuée = BaseÉpingleFavoris & {
  type: "nuée";
  données: ÉpingleBd;
};

export type ÉpingleVariable = BaseÉpingleFavoris & {
  type: "variable";
};

export type ÉpingleMotClef = BaseÉpingleFavoris & {
  type: "motClef";
};

export type ÉpingleProjet = BaseÉpingleFavoris & {
  type: "projet";
  bds: ÉpingleBd;
};

export type ÉpingleProfil = BaseÉpingleFavoris & {
  type: "profil";
  fichiers: typeDispositifs;
};

export type ÉpingleCompte = BaseÉpingleFavoris & {
  type: "compte";
  profil: ÉpingleProfil;
  favoris: typeDispositifs;
};

export type ÉpingleFavorisAvecId<T extends ÉpingleFavoris = ÉpingleFavoris> = {
  idObjet: string;
  épingle: T;
};

const schémaTypeDispositif: JSONSchemaType<typeDispositifs> = {
  type: ["string", "array"],
  anyOf: [
    {
      type: "string",
    },
    {
      type: "array",
      items: { type: "string" },
    },
  ],
  nullable: true,
};

const schémaÉpingleVariable: JSONSchemaType<ÉpingleVariable> = {
  type: "object",
  properties: {
    type: {
      type: "string",
      const: "variable",
    },
    base: schémaTypeDispositif,
  },
  required: ["type"],
};

const schémaÉpingleMotClef: JSONSchemaType<ÉpingleMotClef> = {
  type: "object",
  properties: {
    type: {
      type: "string",
      const: "motClef",
    },
    base: schémaTypeDispositif,
  },
  required: ["type"],
};

const schémaÉpingleBd: JSONSchemaType<ÉpingleBd> = {
  type: "object",
  properties: {
    type: {
      type: "string",
      const: "bd",
    },
    base: schémaTypeDispositif,
    données: {
      type: "object",
      properties: {
        fichiers: schémaTypeDispositif,
        tableaux: schémaTypeDispositif,
      },
      required: ["fichiers", "tableaux"],
    },
  },
  required: ["type", "base", "données"],
};

const schémaÉpingleNuée: JSONSchemaType<ÉpingleNuée> = {
  type: "object",
  properties: {
    type: {
      type: "string",
      const: "nuée",
    },
    base: schémaTypeDispositif,
    données: schémaÉpingleBd,
  },
  required: ["type", "base", "données"],
};

const schémaÉpingleProjet: JSONSchemaType<ÉpingleProjet> = {
  type: "object",
  properties: {
    type: {
      type: "string",
      const: "projet",
    },
    base: schémaTypeDispositif,
    bds: schémaÉpingleBd,
  },
  required: ["type", "base", "bds"],
};

const schémaÉpingleProfil: JSONSchemaType<ÉpingleProfil> = {
  type: "object",
  properties: {
    type: {
      type: "string",
      const: "profil",
    },
    base: schémaTypeDispositif,
    fichiers: schémaTypeDispositif,
  },
  required: ["type", "base", "fichiers"],
};

const schémaÉpingleCompte: JSONSchemaType<ÉpingleCompte> = {
  type: "object",
  properties: {
    type: {
      type: "string",
      const: "compte",
    },
    base: schémaTypeDispositif,
    profil: schémaÉpingleProfil,
    favoris: schémaTypeDispositif,
  },
  required: ["type", "base", "favoris", "profil"],
};

const schémaÉpingleFavoris: JSONSchemaType<ÉpingleFavoris> = {
  anyOf: [
    schémaÉpingleVariable,
    schémaÉpingleMotClef,
    schémaÉpingleBd,
    schémaÉpingleNuée,
    schémaÉpingleProjet,
    schémaÉpingleCompte,
    schémaÉpingleProfil,
  ],
};

type structureBdFavoris = { [idObjet: string]: ÉpingleFavoris };
const schémaBdPrincipale: JSONSchemaType<structureBdFavoris> = {
  type: "object",
  additionalProperties: schémaÉpingleFavoris,
  required: [],
};

export class Favoris extends ComposanteClientDic<structureBdFavoris> {
  _promesseInit: Promise<void>;
  oublierÉpingler?: schémaFonctionOublier;

  constructor({ client }: { client: Constellation }) {
    super({ client, clef: "favoris", schémaBdPrincipale });

    this._promesseInit = this._épinglerFavoris();
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
    ignorer,
  }: {
    épingle: ÉpingleFavorisAvecId;
    f: schémaFonctionSuivi<Set<string>>;
    ignorer?: Set<string>;
  }): Promise<schémaFonctionOublier> {
    // Éviter boucles infinies entre compte et favoris
    ignorer = ignorer || new Set<string>();
    if (ignorer.has(épingle.idObjet)) return faisRien;
    ignorer.add(épingle.idObjet);

    switch (épingle.épingle.type) {
      case "motClef":
        return await this.client.motsClefs.suivreRésolutionÉpingle({
          épingle: épingle as ÉpingleFavorisAvecId<ÉpingleMotClef>,
          f,
        });
      case "variable":
        return await this.client.variables.suivreRésolutionÉpingle({
          épingle: épingle as ÉpingleFavorisAvecId<ÉpingleVariable>,
          f,
        });
      case "bd":
        return await this.client.bds.suivreRésolutionÉpingle({
          épingle: épingle as ÉpingleFavorisAvecId<ÉpingleBd>,
          f,
        });
      case "projet":
        return await this.client.projets.suivreRésolutionÉpingle({
          épingle: épingle as ÉpingleFavorisAvecId<ÉpingleProjet>,
          f,
        });
      case "nuée":
        return await this.client.nuées.suivreRésolutionÉpingle({
          épingle: épingle as ÉpingleFavorisAvecId<ÉpingleNuée>,
          f,
        });
      case "compte":
        return await this.client.suivreRésolutionÉpingle({
          épingle: épingle as ÉpingleFavorisAvecId<ÉpingleCompte>,
          f,
          ignorer,
        });

      default:
        throw new Error(String(épingle));
    }
  }

  async _épinglerFavoris() {
    const fFinale = async (
      résolutions: { idObjet: string; épingles: string[] }[],
    ) => {
      return await this.client.épingles.épingler({
        idRequête: "favoris",
        épingles: new Set(résolutions.map((r) => r.épingles).flat()),
      });
    };

    const fListe = async (
      fSuivreRacine: (éléments: ÉpingleFavorisAvecId[]) => Promise<void>,
    ) => {
      return await this.suivreBdPrincipale({
        f: (x) =>
          fSuivreRacine(
            Object.entries(x).map(([idObjet, épingle]) => ({
              idObjet,
              épingle,
            })),
          ),
      });
    };
    const fBranche = async (
      _id: string,
      fSuivreBranche: schémaFonctionSuivi<Set<string>>,
      branche: ÉpingleFavorisAvecId<ÉpingleFavoris>,
    ) => {
      return await this.suivreRésolutionÉpingle({
        épingle: branche,
        f: fSuivreBranche,
      });
    };
    const fIdBdDeBranche = (b: ÉpingleFavorisAvecId) => b.idObjet;
    const fCode = (b: ÉpingleFavorisAvecId) => b.idObjet;

    const fOublier = await suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
      fIdBdDeBranche,
      fCode,
    });

    this.oublierÉpingler = fOublier;
  }

  @cacheSuivi
  async suivreFavoris({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<ÉpingleFavorisAvecId[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (favoris: { [key: string]: ÉpingleFavoris }) => {
      const favorisFinaux = Object.entries(favoris).map(
        ([idObjet, épingle]) => {
          return {
            idObjet,
            épingle,
          };
        },
      );
      await f(favorisFinaux);
    };

    return await this.suivreBdPrincipale({
      idCompte,
      f: fFinale,
    });
  }

  async épinglerFavori({
    idObjet,
    épingle,
  }: {
    idObjet: string;
    épingle: ÉpingleFavoris;
  }): Promise<void> {
    const { bd, fOublier } = await this.obtBd();

    const existant = bd.get(idObjet);
    if (!deepEqual(existant, épingle)) await bd.put(idObjet, épingle);

    await fOublier();
  }

  async désépinglerFavori({ idObjet }: { idObjet: string }): Promise<void> {
    const { bd, fOublier } = await this.obtBd();
    await bd.del(idObjet);
    await fOublier();
  }

  @cacheSuivi
  async suivreÉtatFavori({
    idObjet,
    f,
    idCompte,
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<ÉpingleFavoris | undefined>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({
      f: (favoris) => f(favoris[idObjet]),
      idCompte,
    });
  }

  @cacheSuivi
  async suivreEstÉpingléSurDispositif({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<BooléenniserPropriétés<ÉpingleFavoris> | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({
      f: async (favoris) => {
        if (favoris[idObjet])
          await f(
            await this.résoudreÉpinglesSurDispositif({
              épingle: favoris[idObjet],
            }),
          );
        else await f(undefined);
      },
    });
  }

  async résoudreÉpinglesSurDispositif<T extends ÉpingleFavoris>({
    épingle,
    idDispositif,
  }: {
    épingle: T;
    idDispositif?: string;
  }): Promise<BooléenniserPropriétés<T>> {
    const résultat = Object.fromEntries(
      await Promise.all(
        Object.entries(épingle)
          .filter(([clef, _val]) => clef !== "type")
          .map(async ([clef, val]) => {
            if (Array.isArray(val) || typeof val === "string") {
              const x = [
                clef,
                await this.estÉpingléSurDispositif({
                  dispositifs: val,
                  idDispositif,
                }),
              ];
              return x;
            } else {
              const x = [
                clef,
                await this.résoudreÉpinglesSurDispositif({
                  épingle: val,
                  idDispositif,
                }),
              ];
              return x;
            }
          }),
      ),
    ) as BooléenniserPropriétés<T>;
    return résultat;
  }

  async estÉpingléSurDispositif({
    dispositifs,
    idDispositif,
  }: {
    dispositifs: typeDispositifs;
    idDispositif?: string;
  }): Promise<boolean> {
    const ceDispositif = await this.client.obtIdDispositif();

    idDispositif = idDispositif || ceDispositif;

    if (dispositifs === "AUCUN") {
      return false;
    } else if (dispositifs === "TOUS") {
      return true;
    } else if (dispositifs === "INSTALLÉ") {
      if (idDispositif === ceDispositif) {
        return isNode || isElectronMain;
      } else {
        return false; // En réalité, inconnu. Mais on ne peut pas magiquement deviner la plateforme d'un autre paire.
      }
    } else if (typeof dispositifs === "string") {
      return dispositifs === idDispositif;
    } else {
      return dispositifs.includes(idDispositif);
    }
  }

  async fermer(): Promise<void> {
    await this._promesseInit;
    if (this.oublierÉpingler) await this.oublierÉpingler();
  }
}
