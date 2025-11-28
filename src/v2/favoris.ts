import deepEqual from "deep-equal";
import { faisRien, suivreDeFonctionListe } from "@constl/utils-ipa";
import { isElectronMain, isNode } from "wherearewe";
import { cacheSuivi } from "./crabe/cache.js";
import { ServiceDonnéesNébuleuse } from "./crabe/services/services.js";
import { ajouterProtocoleOrbite, extraireEmpreinte } from "./utils.js";
import type { JSONSchemaType } from "ajv";
import type { PartielRécursif } from "./types.js";
import type { Constellation, ServicesConstellation } from "./constellation.js";
import type { Oublier, Suivi } from "./crabe/types.js";
import type { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";

// Types épingles

export const TOUS_DISPOSITIFS = "TOUS" as const;
export const DISPOSITIFS_INSTALLÉS = "INSTALLÉS" as const;
export const AUCUN_DISPOSITIF = "AUCUN" as const;

export type DispositifsÉpingle =
  | string
  | string[]
  | typeof TOUS_DISPOSITIFS
  | typeof DISPOSITIFS_INSTALLÉS
  | typeof AUCUN_DISPOSITIF;

export type BaseÉpingleFavoris = {
  type: string;
  base: DispositifsÉpingle;
};

export type ÉpingleFavorisAvecId<
  T extends BaseÉpingleFavoris = BaseÉpingleFavoris,
> = {
  idObjet: string;
  épingle: T;
};

export type BooléenniserÉpingle<T extends BaseÉpingleFavoris> =
  BooléenniserPropriétés<Omit<T, "type">> & { type: T["type"] };

export type ÉpingleFavorisAvecIdBooléennisée<
  T extends BaseÉpingleFavoris = BaseÉpingleFavoris,
> = {
  idObjet: string;
  épingle: BooléenniserÉpingle<T>;
};

export type BooléenniserPropriétés<T extends object> = {
  [clef in keyof T]?: T[clef] extends object
    ? BooléenniserPropriétés<T[clef]>
    : boolean;
};

export const résoudreDéfauts = <T extends { [clef: string]: unknown }>(
  épingle: PartielRécursif<T>,
  défauts: T,
): T => {
  const copieDéfauts = structuredClone(défauts);
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

// Type résolveur

export type Résolveur<T extends BaseÉpingleFavoris = BaseÉpingleFavoris> = (args: {
  épingle: ÉpingleFavorisAvecIdBooléennisée<T>;
  f: Suivi<Set<string>>;
}) => Promise<Oublier>;

// Structure données

const schémaÉpingleFavoris: JSONSchemaType<
  PartielRécursif<BaseÉpingleFavoris>
> = {
  type: "object",
  properties: {
    type: { type: "string", nullable: true },
    base: {
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
    },
  },
  required: [],
};

type StructureServiceFavoris = { [idObjet: string]: BaseÉpingleFavoris };

const SchémaServiceFavoris: JSONSchemaType<
  PartielRécursif<StructureServiceFavoris>
> = {
  type: "object",
  additionalProperties: schémaÉpingleFavoris,
  required: [],
};

export class Favoris extends ServiceDonnéesNébuleuse<
  "favoris",
  StructureServiceFavoris,
  ServicesLibp2pCrabe,
  ServicesConstellation,
  { oublier: Oublier }
> {
  résolveurs: Map<string, Résolveur>;

  constructor({ nébuleuse }: { nébuleuse: Constellation }) {
    super({
      clef: "favoris",
      nébuleuse,
      dépendances: ["compte", "épingles"],
      options: {
        schéma: SchémaServiceFavoris,
      },
    });
    this.résolveurs = new Map();
  }

  async démarrer(): Promise<{ oublier: Oublier }> {
    const épingles = this.service("épingles");

    const fFinale = async (
      résolutions: { idObjet: string; épingles: string[] }[],
    ) => {
      return await épingles.épingler({
        idRequête: "favoris",
        épingles: new Set(résolutions.map((r) => r.épingles).flat()),
      });
    };

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (
        éléments: PartielRécursif<ÉpingleFavorisAvecId>[],
      ) => Promise<void>;
    }) => {
      return await this.suivreBd({
        f: (x) => {
          return fSuivreRacine(
            Object.entries(x || {}).map(([idObjet, épingle]) => ({
              idObjet,
              épingle,
            })),
          );
        },
      });
    };
    const fBranche = async ({
      fSuivreBranche,
      branche,
    }: {
      fSuivreBranche: Suivi<Set<string>>;
      branche: PartielRécursif<ÉpingleFavorisAvecId>;
    }) => {
      if (branche.idObjet && branche.épingle?.type)
        return await this.suivreRésolutionÉpingle({
          épingle: branche,
          f: fSuivreBranche,
        });
      return faisRien;
    };
    const fIdDeBranche = (b: PartielRécursif<ÉpingleFavorisAvecId>) =>
      b.idObjet;

    const oublier = await suivreDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
      fIdDeBranche,
    });

    this.estDémarré = { oublier };
    return await super.démarrer();
  }

  async fermer(): Promise<void> {
    const { oublier } = await this.démarré();

    await oublier();
    return await super.fermer();
  }

  async inscrireRésolution<T extends BaseÉpingleFavoris>({
    clef,
    résolution,
  }: {
    clef: string;
    résolution: Résolveur<T>;
  }): Promise<void> {
    this.résolveurs.set(clef, résolution as Résolveur);
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
    ignorer,
  }: {
    épingle: ÉpingleFavorisAvecId;
    f: Suivi<Set<string>>;
    ignorer?: Set<string>;
  }): Promise<Oublier> {
    // Éviter boucles infinies entre compte et favoris
    ignorer = ignorer || new Set<string>();
    if (ignorer.has(épingle.idObjet)) return faisRien;
    ignorer.add(épingle.idObjet);

    const compte = this.service("compte");
    const ceDispositif = await compte.obtIdDispositif();

    const résolveur = this.résolveurs.get(épingle.épingle.type);
    if (!résolveur) {
      const journal = this.service("journal");
      await journal.écrire(
        `Résolveur pour épingle de type ${épingle.épingle.type} non disponible. Cet objet ne sera pas épinglé.`,
      );

      // On épingle la racine de l'objet ; c'est tout ce qu'on peut faire dans ce cas.
      await f(new Set([épingle.idObjet]));
      return faisRien;
    }

    const épingleBooléennisée = this.résoudreÉpinglesSurDispositif({
      épingle: épingle.épingle,
      ceDispositif,
    });
    return await résolveur({
      f,
      épingle: {
        idObjet: ajouterProtocoleOrbite(épingle.idObjet),
        épingle: épingleBooléennisée,
      },
    });
  }

  // Fonctionalités

  async épinglerFavori({
    idObjet,
    épingle,
  }: {
    idObjet: string;
    épingle: BaseÉpingleFavoris;
  }): Promise<void> {
    const bd = await this.bd();

    const existant = await bd.get(extraireEmpreinte(idObjet));
    if (!deepEqual(existant, épingle))
      await bd.put(extraireEmpreinte(idObjet), épingle);
  }

  async désépinglerFavori({ idObjet }: { idObjet: string }): Promise<void> {
    const bd = await this.bd();
    await bd.del(extraireEmpreinte(idObjet));
  }

  @cacheSuivi
  async suivreFavoris({
    f,
    idCompte,
  }: {
    f: Suivi<ÉpingleFavorisAvecId[] | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    const fFinale = async (
      favoris?: PartielRécursif<{ [key: string]: BaseÉpingleFavoris }>,
    ) => {
      if (!favoris) return await f(undefined);

      const favorisFinaux = Object.entries(favoris).map(
        ([empreinte, épingle]) => {
          return {
            idObjet: ajouterProtocoleOrbite(empreinte),
            épingle,
          };
        },
      );
      await f(favorisFinaux);
    };

    return await this.suivreBd({
      idCompte,
      f: fFinale,
    });
  }

  @cacheSuivi
  async suivreÉtatFavori({
    idObjet,
    f,
    idCompte,
  }: {
    idObjet: string;
    f: Suivi<PartielRécursif<BaseÉpingleFavoris> | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    const empreinte = extraireEmpreinte(idObjet);
    return await this.suivreBd({
      f: (favoris) => f(favoris ? favoris[empreinte] : undefined),
      idCompte,
    });
  }

  estÉpingléSurDispositif({
    dispositifs,
    ceDispositif,
    idDispositif,
  }: {
    dispositifs: DispositifsÉpingle;
    ceDispositif: string;
    idDispositif?: string;
  }): boolean {
    idDispositif = idDispositif || ceDispositif;

    if (dispositifs === "AUCUN") {
      return false;
    } else if (dispositifs === "TOUS") {
      return true;
    } else if (dispositifs === "INSTALLÉ") {
      if (idDispositif === ceDispositif) {
        return isNode || isElectronMain;
      } else {
        // En réalité, inconnu. Mais on ne peut pas magiquement deviner la plateforme d'un autre paire.
        return false;
      }
    } else if (typeof dispositifs === "string") {
      return dispositifs === idDispositif;
    } else {
      return dispositifs.includes(idDispositif);
    }
  }

  @cacheSuivi
  async suivreEstÉpingléSurDispositif({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: Suivi<BooléenniserPropriétés<BaseÉpingleFavoris> | undefined>;
  }): Promise<Oublier> {
    return await this.suivreBd({
      f: async (favoris) => {
        if (favoris?.[idObjet])
          await f(
            this.résoudreÉpinglesSurDispositif({
              épingle: favoris[idObjet],
            }),
          );
        else await f(undefined);
      },
    });
  }

  résoudreÉpinglesSurDispositif<T extends BaseÉpingleFavoris>({
    épingle,
    ceDispositif,
    idDispositif,
  }: {
    épingle: T;
    ceDispositif: string;
    idDispositif?: string;
  }): BooléenniserÉpingle<T> {
    const résultat = Object.fromEntries([
      ["type", épingle.type],
      ...Object.entries(épingle)
        .filter(([clef, _val]) => clef !== "type")
        .map(([clef, val]) => {
          if (Array.isArray(val) || typeof val === "string") {
            const x = [
              clef,
              this.estÉpingléSurDispositif({
                dispositifs: val,
                idDispositif,
                ceDispositif,
              }),
            ];
            return x;
          } else {
            const x = [
              clef,
              this.résoudreÉpinglesSurDispositif({
                épingle: val,
                idDispositif,
                ceDispositif,
              }),
            ];
            return x;
          }
        }),
    ]) as BooléenniserÉpingle<T>;
    return résultat;
  }
}
