import { isElectronMain, isNode } from "wherearewe";

import { JSONSchemaType } from "ajv";
import { suivreBdsDeFonctionListe } from "@constl/utils-ipa";
import { cacheSuivi } from "@/décorateursCache.js";
import { ComposanteClientDic } from "./composanteClient.js";
import { effacerPropriétésNonDéfinies } from "./utils.js";
import type { Constellation } from "@/client.js";
import type { schémaFonctionOublier, schémaFonctionSuivi } from "@/types.js";

export type typeDispositifs = string | string[] | "TOUS" | "INSTALLÉ" | "AUCUN";

export interface épingleDispositif {
  idObjet: string;
  bd: boolean;
  fichiers: boolean;
  récursif: boolean;
}

export type ÉpingleFavoris =
  | ÉpingleVariable
  | ÉpingleMotClef
  | ÉpingleBd
  | ÉpingleNuée
  | ÉpingleProjet
  | ÉpingleCompte;

export type BaseÉpingleFavoris = {
  base?: typeDispositifs;
};

export type ÉpingleBd = BaseÉpingleFavoris & {
  type: "bd";
  fichiersBase?: typeDispositifs;
  données?: {
    tableaux?: typeDispositifs;
    fichiers?: typeDispositifs;
  };
};

export type ÉpingleNuée = BaseÉpingleFavoris & {
  type: "nuée";
  fichiersBase?: typeDispositifs;
  données?: ÉpingleBd;
};

export type ÉpingleVariable = BaseÉpingleFavoris & {
  type: "variable";
};

export type ÉpingleMotClef = BaseÉpingleFavoris & {
  type: "motClef";
};

export type ÉpingleProjet = BaseÉpingleFavoris & {
  type: "projet";
  fichiersBase?: typeDispositifs;
  bds?: ÉpingleBd;
};

export type ÉpingleCompte = BaseÉpingleFavoris & {
  type: "compte";
  fichiersBase?: typeDispositifs;
  favoris?: {
    base?: typeDispositifs;
  };
  bds?: {
    base?: typeDispositifs;
  };
};

export type ÉpingleFavorisAvecId<T extends ÉpingleFavoris = ÉpingleFavoris> = {
  idObjet: string;
  épingle: T;
};

type structureBdFavoris = { [idObjet: string]: ÉpingleFavoris };
const schémaBdPrincipale: JSONSchemaType<structureBdFavoris> = {
  type: "object",
  additionalProperties: {
    type: "object",
    properties: {
      dispositifs: {
        anyOf: [
          {
            type: "array",
            items: { type: "string" },
          },
          { type: "string" },
        ],
      },
      dispositifsFichiers: {
        type: ["array", "string"],
        anyOf: [
          {
            type: "array",
            items: { type: "string" },
            nullable: true,
          },
          {
            type: "string",
            nullable: true,
          },
        ],
        nullable: true,
      },
      récursif: { type: "boolean" },
    },
    required: ["dispositifs", "récursif"],
  },
  required: [],
};

export class Favoris extends ComposanteClientDic<structureBdFavoris> {
  _promesseInit: Promise<void>;
  oublierÉpingler?: schémaFonctionOublier;

  constructor({ client }: { client: Constellation }) {
    super({ client, clef: "favoris", schémaBdPrincipale });

    this._promesseInit = this._épinglerFavoris();
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
      switch (branche.épingle.type) {
        case "motClef":
          return await this.client.motsClefs.suivreRésolutionÉpingle({
            épingle: branche as ÉpingleFavorisAvecId<ÉpingleMotClef>,
            f: fSuivreBranche,
          });
        case "variable":
          return await this.client.variables.suivreRésolutionÉpingle({
            épingle: branche as ÉpingleFavorisAvecId<ÉpingleVariable>,
            f: fSuivreBranche,
          });
        case "bd":
          return await this.client.bds.suivreRésolutionÉpingle({
            épingle: branche as ÉpingleFavorisAvecId<ÉpingleBd>,
            f: fSuivreBranche,
          });
        case "projet":
          return await this.client.projets.suivreRésolutionÉpingle({
            épingle: branche as ÉpingleFavorisAvecId<ÉpingleProjet>,
            f: fSuivreBranche,
          });
        case "nuée":
          return await this.client.nuées.suivreRésolutionÉpingle({
            épingle: branche as ÉpingleFavorisAvecId<ÉpingleNuée>,
            f: fSuivreBranche,
          });
        case "compte":
          return await this.client.suivreRésolutionÉpingle({
            épingle: branche as ÉpingleFavorisAvecId<ÉpingleCompte>,
            f: fSuivreBranche,
          });

        default:
          throw new Error(String(branche));
      }
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

    const élément = effacerPropriétésNonDéfinies(épingle);
    await bd.put(idObjet, élément);

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
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<ÉpingleFavoris | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({
      f: (favoris) => f(favoris[idObjet]),
    });
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
    if (this.oublierÉpingler) await this.oublierÉpingler();
  }
}
