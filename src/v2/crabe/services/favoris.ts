import deepEqual from "deep-equal";
import { faisRien, suivreDeFonctionListe } from "@constl/utils-ipa";
import { isElectronMain, isNode } from "wherearewe";
import { cacheRechercheParN, cacheSuivi } from "../cache.js";
import { ajouterProtocoleOrbite, extraireEmpreinte } from "../../utils.js";
import { ServiceDonnéesNébuleuse } from "./services.js";
import type { Nébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import type { JSONSchemaType } from "ajv";
import type { PartielRécursif } from "../../types.js";
import type { Oublier, Suivi } from "../types.js";
import type { ServicesLibp2pCrabe } from "./libp2p/libp2p.js";
import type { ServicesCrabe } from "../crabe.js";
import type { ServicesNécessairesOrbite } from "./orbite/orbite.js";
import { RetourFonctionRecherche } from "@/v2/recherche/types.js";

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

export type ÉpingleFavoris<T extends BaseÉpingleFavoris = BaseÉpingleFavoris> =
  {
    type: string;
    épingle?: PartielRécursif<T>;
  };

export type BaseÉpingleFavoris = {
  base: DispositifsÉpingle;
};

export type ÉpingleFavorisAvecId<
  T extends BaseÉpingleFavoris = BaseÉpingleFavoris,
> = {
  idObjet: string;
  épingle: ÉpingleFavoris<T>;
};

export type BooléenniserÉpingle<T extends ÉpingleFavoris> = {
  type: T["type"];
  épingle: T["épingle"] extends object
    ? PartielRécursif<BooléenniserPropriétés<T["épingle"]>>
    : undefined;
};

export type ÉpingleFavorisBooléenniséeAvecId<
  T extends ÉpingleFavoris = ÉpingleFavoris,
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

export type Résolveur<T extends ÉpingleFavoris = ÉpingleFavoris> = (args: {
  épingle: ÉpingleFavorisBooléenniséeAvecId<T>;
  f: Suivi<Set<string>>;
}) => Promise<Oublier>;

// Structure données

const schémaÉpingleFavoris: JSONSchemaType<PartielRécursif<ÉpingleFavoris>> = {
  type: "object",
  properties: {
    type: { type: "string", nullable: true },
    épingle: {
      type: "object",
      properties: {
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
      additionalProperties: true,
      nullable: true,
    },
  },
  required: [],
};

type StructureServiceFavoris = { [idObjet: string]: ÉpingleFavoris };

const SchémaServiceFavoris: JSONSchemaType<
  PartielRécursif<StructureServiceFavoris>
> = {
  type: "object",
  additionalProperties: schémaÉpingleFavoris,
  required: [],
};

// Fonctions

const typeÉpinglePrésent = (
  épingle?: PartielRécursif<ÉpingleFavoris>,
): épingle is ÉpingleFavoris => {
  return épingle?.type !== undefined;
};

export class ServiceFavoris<
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> extends ServiceDonnéesNébuleuse<
  "favoris",
  StructureServiceFavoris,
  ServicesLibp2pCrabe,
  ServicesCrabe,
  { oublier: Oublier }
> {
  résolveurs: Map<string, Résolveur>;

  constructor({
    nébuleuse,
  }: {
    nébuleuse: Nébuleuse<ServicesNécessairesOrbite<L>>;
  }) {
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
      fSuivreRacine: (éléments: ÉpingleFavorisAvecId[]) => Promise<void>;
    }) => {
      return await this.suivreBd({
        f: (x) => {
          return fSuivreRacine(
            Object.entries(x || {})
              .map(([idObjet, épingle]) => {
                if (typeÉpinglePrésent(épingle))
                  return {
                    idObjet,
                    épingle,
                  };
                return undefined;
              })
              .filter(
                (x): x is { idObjet: string; épingle: ÉpingleFavoris } => !!x,
              ),
          );
        },
      });
    };

    const fBranche = async ({
      fSuivreBranche,
      branche,
    }: {
      fSuivreBranche: Suivi<Set<string>>;
      branche: ÉpingleFavorisAvecId;
    }) => {
      if (branche.idObjet && branche.épingle?.type)
        return await this.suivreRésolutionÉpingle({
          épingle: branche,
          f: fSuivreBranche,
        });
      return faisRien;
    };

    const fIdDeBranche = (b: ÉpingleFavorisAvecId<BaseÉpingleFavoris>) =>
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

  async inscrireRésolution<T extends ÉpingleFavoris>({
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

    const épingleBooléennisée = await this.résoudreÉpinglesSurDispositif({
      épingle: épingle.épingle,
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
    épingle: ÉpingleFavoris;
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
      favoris?: PartielRécursif<{ [key: string]: ÉpingleFavoris }> | null,
    ) => {
      if (!favoris) return await f(undefined);

      const favorisFinaux: ÉpingleFavorisAvecId[] = Object.entries(favoris)
        .map(([empreinte, épingle]) => {
          if (typeÉpinglePrésent(épingle))
            return {
              idObjet: ajouterProtocoleOrbite(empreinte),
              épingle,
            };
          return undefined;
        })
        .filter((x): x is ÉpingleFavorisAvecId => !!x);
      await f(favorisFinaux);
    };

    return await this.suivreBd({
      idCompte,
      f: fFinale,
    });
  }

  @cacheRechercheParN
  async rechercherFavoris({
    idObjet,
    f,
  }: {
    idObjet: string;
    f;
  }): Promise<RetourFonctionRecherche> {}

  async estÉpingléSurDispositif({
    dispositifs,
    idDispositif,
  }: {
    dispositifs: DispositifsÉpingle;
    idDispositif?: string;
  }): Promise<boolean> {
    const ceDispositif = await this.service("compte").obtIdDispositif();
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
    idDispositif,
  }: {
    idObjet: string;
    f: Suivi<BooléenniserÉpingle<ÉpingleFavoris> | undefined>;
    idDispositif?: string;
  }): Promise<Oublier> {
    return await this.suivreBd({
      f: async (favoris) => {
        const favorisObjet = favoris?.[idObjet];
        if (typeÉpinglePrésent(favorisObjet))
          await f(
            await this.résoudreÉpinglesSurDispositif({
              épingle: favorisObjet,
              idDispositif,
            }),
          );
        else await f(undefined);
      },
    });
  }

  async résoudreÉpinglesSurDispositif<T extends BaseÉpingleFavoris>({
    épingle,
    idDispositif,
  }: {
    épingle: ÉpingleFavoris<T>;
    idDispositif?: string;
  }): Promise<BooléenniserÉpingle<ÉpingleFavoris<T>>> {
    const résultat = Object.fromEntries([
      ["type", épingle.type],
      ...(
        await Promise.all(
          Object.entries(épingle.épingle || {}).map(async ([clef, val]) => {
            if (Array.isArray(val) || typeof val === "string") {
              return [
                clef,
                await this.estÉpingléSurDispositif({
                  dispositifs: val,
                  idDispositif,
                }),
              ];
            } else {
              if (typeÉpinglePrésent(val as PartielRécursif<ÉpingleFavoris>))
                return [
                  clef,
                  await this.résoudreÉpinglesSurDispositif({
                    épingle: val,
                    idDispositif,
                  }),
                ];
              return undefined;
            }
          }),
        )
      ).filter((x): x is [string, BooléenniserÉpingle<ÉpingleFavoris>] => !!x),
    ]) as BooléenniserÉpingle<ÉpingleFavoris<T>>;
    return résultat;
  }
}
