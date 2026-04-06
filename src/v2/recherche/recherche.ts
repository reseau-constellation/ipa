import { ignorerNonDéfinis, suivreDeFonctionListe } from "@constl/utils-ipa";
import {
  cacheRechercheParN,
  cacheRechercheParProfondeur,
} from "../nébuleuse/cache.js";
import { moyenne } from "../utils.js";
import { stabiliser } from "../nébuleuse/utils.js";
import { EstimateurAsymptoteTemps, calculerIntersection } from "./utils.js";
import {
  COEFFICIENT_ASYMPTOTE_INTERSECTION_Y,
  MÉMOIRE_ESTIMATEUR_ASYMPTOTE,
  POIDS_SCORE_RÉSULTAT,
  PROFONDEUR_MINIMALE_RECHERCHE,
} from "./consts.js";
import type { Oublier, RetourRecherche, Suivi } from "../nébuleuse/types.js";
import type {
  InfoRésultat,
  RésultatObjectifRecherche,
  RésultatRecherche,
  SuivreConfianceRecherche,
  SuivreObjectifRecherche,
  SuivreQualitéRecherche,
} from "./types.js";
import type { InfoAuteur } from "../types.js";
import type { ServicesNécessairesCompte } from "../nébuleuse/services/compte/compte.js";
import type { ServiceRéseau } from "../nébuleuse/services/réseau/réseau.js";
import type { ServiceFavoris } from "../nébuleuse/services/favoris.js";

export type ServicesNécessairesRecherche = ServicesNécessairesCompte & {
  réseau: ServiceRéseau;
};

export class Recherche<S extends ServicesNécessairesRecherche> {
  service: <C extends keyof S>(service: C) => S[C];

  constructor({
    service,
  }: {
    service: <C extends keyof S>(service: C) => S[C];
  }) {
    this.service = service;
  }

  async rechercher<T extends InfoRésultat = InfoRésultat>({
    f,
    n,
    fRecherche,
    fObjectif,
    fConfiance,
    fQualité,
  }: {
    f: Suivi<RésultatRecherche<T>[]>;
    n?: number;
    fRecherche: (args: {
      idCompte: string;
      f: Suivi<string[] | undefined>;
    }) => Promise<Oublier>;
    fObjectif: SuivreObjectifRecherche<T, S>;
    fConfiance: SuivreConfianceRecherche;
    fQualité: SuivreQualitéRecherche;
  }): Promise<RetourRecherche> {
    const réseau = this.service("réseau");

    type RésultatAvecProfondeur = {
      résultat: RésultatRecherche<T>;
      score: number;
      profondeur: number;
    };
    let résultats: RésultatAvecProfondeur[] = [];

    const fFinale = async () => {
      const résultatsOrdonnés = résultats.toSorted(
        (a, b) => b.score - a.score, // Ordre décroissant
      );
      const résultatsTroncés =
        n === undefined ? résultatsOrdonnés : résultatsOrdonnés.slice(0, n);
      const profondeurDésirée = actualiserEstimateurs(résultatsTroncés);
      await ajusterProfondeurStable(profondeurDésirée);

      await f(résultatsTroncés.map((r) => r.résultat));
    };

    // Estimateur sommes scores sur n éventuelles par profondeur
    const estimateursSommesScores: Map<number, EstimateurAsymptoteTemps> =
      new Map();

    const actualiserEstimateurs = (
      troncés: RésultatAvecProfondeur[],
    ): number => {
      const profondeurActuelle = Math.max(
        ...résultats.map((r) => r.profondeur),
      );

      for (let p = 0; p++; p <= profondeurActuelle) {
        let estimateur = estimateursSommesScores.get(p);
        if (!estimateur)
          estimateur = new EstimateurAsymptoteTemps({
            mémoire: MÉMOIRE_ESTIMATEUR_ASYMPTOTE,
          });
        estimateursSommesScores.set(p, estimateur);

        const sommeScoresP = troncés
          .filter((r) => r.profondeur <= p)
          .map((r) => r.score)
          .reduce((a, b) => a + b, 0);
        estimateur.ajouter(sommeScoresP);
      }

      // Profondeur nécessaire : p à 95% de l'asymptote profondeur - somme scores sur n
      const points: [number, number][] = [...estimateursSommesScores.entries()]
        .map(([p, estim]) => [p, estim.asymptote()])
        .filter((x): x is [number, number] => x[1] !== undefined);
      const estiméProfondeurNécessaire = calculerIntersection({
        p: COEFFICIENT_ASYMPTOTE_INTERSECTION_Y,
        points,
      });

      return Math.max(
        estiméProfondeurNécessaire ?? 0,
        PROFONDEUR_MINIMALE_RECHERCHE,
      );
    };

    const résoudreScore = ({
      résultat,
      confiance = 0,
      qualité = 0,
    }: {
      résultat: number;
      confiance?: number;
      qualité?: number;
    }): number => {
      const POIDS_RESTANT = (1 - POIDS_SCORE_RÉSULTAT) * 3;
      return moyenne([
        résultat * POIDS_SCORE_RÉSULTAT * 3,
        (confiance * POIDS_RESTANT) / 2,
        (qualité * POIDS_RESTANT) / 2,
      ]);
    };

    const fSuivreCompte = async ({
      id: idCompte,
      fSuivreBranche,
      branche,
    }: {
      id: string;
      fSuivreBranche: Suivi<RésultatAvecProfondeur[]>;
      branche: {
        idCompte: string;
        profondeur: number;
      };
    }): Promise<Oublier> => {
      return await suivreDeFonctionListe({
        fListe: async ({ fSuivreRacine }: { fSuivreRacine: Suivi<string[]> }) =>
          await fRecherche({ idCompte, f: ignorerNonDéfinis(fSuivreRacine) }),
        fBranche: async ({
          id: idObjet,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: Suivi<RésultatAvecProfondeur>;
        }) => {
          const info: {
            résultat?: RésultatObjectifRecherche<T>;
            confiance?: number;
            qualité?: number;
          } = {};
          const fFinaleBranche = async () => {
            if (info.résultat)
              return await fSuivreBranche({
                résultat: { id: idObjet, résultatObjectif: info.résultat },
                score: résoudreScore({
                  ...info,
                  résultat: info.résultat.score,
                }),
                profondeur: branche.profondeur,
              });
          };
          const oublierObjectif = await fObjectif({
            services: this.service,
            idObjet,
            f: async (résultat) => {
              info.résultat = résultat;
              await fFinaleBranche();
            },
          });
          const oublierConfiance = await fConfiance({
            idObjet,
            f: async (confiance) => {
              info.confiance = confiance;
              await fFinaleBranche();
            },
          });
          const oublierQualité = await fQualité({
            idObjet,
            f: async (qualité) => {
              info.qualité = qualité;
              await fFinaleBranche();
            },
          });
          return async () => {
            await oublierObjectif();
            await oublierConfiance();
            await oublierQualité();
          };
        },
        f: fSuivreBranche,
      });
    };

    const { profondeur, fOublier: oublierComptes } =
      await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: Suivi<{ idCompte: string; profondeur: number }[]>;
        }): Promise<{ fOublier: Oublier; profondeur: (p: number) => void }> => {
          const { oublier, profondeur: changerProfondeur } =
            await réseau.suivreComptesParProfondeur({
              f: (liste) =>
                fSuivreRacine(
                  liste
                    // On ignore les membres bloqués directement ou avec un score négatif
                    .filter(({ confiance }) => confiance >= 0)
                    .map(({ idCompte, profondeur }) => ({
                      idCompte: idCompte,
                      profondeur,
                    })),
                ),
              profondeur: PROFONDEUR_MINIMALE_RECHERCHE,
            });
          return { profondeur: changerProfondeur, fOublier: oublier };
        },
        fBranche: fSuivreCompte,
        fIdDeBranche: (x) => x.idCompte,
        f: (x: RésultatAvecProfondeur[]) => {
          résultats = x;
        },
      });

    const ajusterProfondeurStable = stabiliser(2000)(profondeur);

    const changerN = async (nouveauN: number) => {
      n = nouveauN;
      await fFinale();
    };

    return { oublier: oublierComptes, n: changerN };
  }
}

export type ServicesNécessairesRechercheObjets =
  ServicesNécessairesRecherche & { favoris: ServiceFavoris };

export abstract class RechercheObjets<
  S extends ServicesNécessairesRechercheObjets,
> extends Recherche<S> {
  abstract suivreAuteursObjet({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: Suivi<InfoAuteur[]>;
  }): Promise<Oublier>;

  async rechercherObjets<T extends InfoRésultat = InfoRésultat>({
    f,
    n,
    fRecherche,
    fQualité,
    fObjectif,
    idCompte,
  }: {
    f: Suivi<RésultatRecherche<T>[]>;
    n?: number;
    fRecherche: (args: {
      idCompte: string;
      f: Suivi<string[]>;
    }) => Promise<Oublier>;
    fQualité: SuivreQualitéRecherche;
    fObjectif: SuivreObjectifRecherche<T, S>;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    const serviceFavoris = this.service("favoris");

    if (idCompte) {
      const { fOublier, changerN } = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: Suivi<string[]>;
        }) => {
          const fOublier = await fRecherche({
            idCompte,
            f: ignorerNonDéfinis(fSuivreRacine),
          });
          // À faire : implémenter fChangerN ?
          const changerN = async (_n: number) => {};
          return { fOublier, changerN };
        },
        fBranche: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: Suivi<RésultatRecherche<T>>;
        }): Promise<Oublier> =>
          await fObjectif({
            services: this.service,
            idObjet: id,
            f: async (résultat) => {
              if (résultat)
                return await fSuivreBranche({
                  id,
                  résultatObjectif: résultat,
                });
            },
          }),
        f,
      });

      return { oublier: fOublier, n: changerN };
    } else {
      const fRechercheAvecFavoris = async ({
        idCompte,
        f,
      }: {
        idCompte: string;
        f: Suivi<string[]>;
      }) => {
        const résultats: { favoris?: string[]; propres?: string[] } = {};
        const fFinale = async () => {
          return await f([
            ...new Set([
              ...(résultats.propres || []),
              ...(résultats.favoris || []),
            ]),
          ]);
        };
        const oublierRecherche = await fRecherche({
          idCompte,
          f: async (propres) => {
            résultats.propres = propres;
            await fFinale();
          },
        });
        const oublierFavoris = await serviceFavoris.suivreFavoris({
          idCompte,
          f: async (favoris) => {
            résultats.favoris = favoris?.map((fav) => fav.idObjet);
            await fFinale();
          },
        });
        return async () => {
          await oublierRecherche();
          await oublierFavoris();
        };
      };

      return await this.rechercher({
        f,
        n,
        fRecherche: fRechercheAvecFavoris,
        fObjectif,
        fConfiance: async ({ idObjet, f }) =>
          await this.suivreConfianceAuteurs({ idObjet, f }),
        fQualité,
      });
    }
  }

  @cacheRechercheParProfondeur
  async suivreConfianceAuteurs({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: Suivi<number>;
  }): Promise<Oublier> {
    const réseau = this.service("réseau");

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: Suivi<string[]>;
    }): Promise<Oublier> => {
      return await this.suivreAuteursObjet({
        idObjet,
        f: async (auteurs: InfoAuteur[]) => {
          const idsAuteurs = auteurs
            .filter((a) => a.accepté)
            .map((a) => a.idCompte);
          return await fSuivreRacine(idsAuteurs);
        },
      });
    };

    const fBranche = async ({
      id: idAuteur,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: Suivi<number>;
    }): Promise<Oublier> => {
      const { oublier } = await réseau.suivreConfianceCompte({
        idCompte: idAuteur,
        f: ignorerNonDéfinis(fSuivreBranche),
      });
      return oublier;
    };

    const fFinale = async (confiances: number[]) => {
      const confiance = confiances.reduce((a, b) => a + b, 0);
      await f(confiance / (confiances.length || 1));
    };

    const fRéduction = (branches: number[]) => branches.flat();

    return await suivreDeFonctionListe({
      f: fFinale,
      fListe,
      fBranche,
      fRéduction,
    });
  }
}
