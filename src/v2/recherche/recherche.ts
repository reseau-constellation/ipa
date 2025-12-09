import { ignorerNonDéfinis, suivreDeFonctionListe } from "@constl/utils-ipa";
import PQueue from "p-queue";
import {
  cacheRechercheParN,
  cacheRechercheParProfondeur,
} from "../crabe/cache.js";
import { moyenne } from "../utils.js";
import type { schémaRetourFonctionRechercheParProfondeur } from "@/types.js";
import type { Oublier, Suivi } from "../crabe/types.js";
import type {
  InfoRésultat,
  RetourFonctionRecherche,
  RésultatObjectifRecherche,
  RésultatRecherche,
  SuivreConfianceRecherche,
  SuivreObjectifRecherche,
  SuivreQualitéRecherche,
} from "./types.js";
import type { ServicesLibp2pCrabe } from "../crabe/services/libp2p/libp2p.js";
import type { ServicesConstellation } from "../constellation.js";
import type { Constellation } from "../index.js";
import type { InfoAuteur } from "../types.js";

export class Recherche<L extends ServicesLibp2pCrabe> {
  constl: Constellation;
  service: <T extends keyof ServicesConstellation<L>>(
    service: T,
  ) => ServicesConstellation<L>[T];

  constructor({
    constl,
    service,
  }: {
    constl: Constellation;
    service: <T extends keyof ServicesConstellation<L>>(
      service: T,
    ) => ServicesConstellation<L>[T];
  }) {
    this.constl = constl;
    this.service = service;
  }

  @cacheRechercheParN
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
    fObjectif: SuivreObjectifRecherche<T>;
    fConfiance: SuivreConfianceRecherche;
    fQualité: SuivreQualitéRecherche;
  }): Promise<RetourFonctionRecherche> {
    const réseau = this.service("réseau");

    const queue = new PQueue({ concurrency: 1 });

    const résoudreScore = ({
      résultat,
      confiance = 0,
      qualité = 0,
    }: {
      résultat: number;
      confiance?: number;
      qualité?: number;
    }): number => {
      return moyenne([résultat * 2, confiance * 0.5, qualité * 0.5]);
    };

    const fSuivreCompte = async ({
      idCompte,
      f,
    }: {
      idCompte: string;
      f: Suivi<{ résultat: RésultatObjectifRecherche<T>; score: number }[]>;
    }): Promise<Oublier> => {
      return await suivreDeFonctionListe({
        fListe: async ({ fSuivreRacine }: { fSuivreRacine: Suivi<string[]> }) =>
          await fRecherche({ idCompte, f: ignorerNonDéfinis(fSuivreRacine) }),
        fBranche: async ({
          id: idObjet,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: Suivi<{
            résultat: RésultatObjectifRecherche<T>;
            score: number;
          }>;
        }) => {
          const info: {
            résultat?: RésultatObjectifRecherche<T>;
            confiance?: number;
            qualité?: number;
          } = {};
          const fFinaleBranche = async () => {
            if (info.résultat)
              return await fSuivreBranche({
                résultat: info.résultat,
                score: résoudreScore({
                  ...info,
                  résultat: info.résultat.score,
                }),
              });
          };
          const oublierObjectif = await fObjectif({
            constl: this.constl,
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
        f,
      });
    };

    const { changerProfondeur, oublier: oublierComptes } =
      await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine;
        }): Promise<schémaRetourFonctionRechercheParProfondeur> =>
          await réseau.suivreComptesRéseauEtEnLigne({
            f: fSuivreRacine,
            profondeur,
          }),
        fBranche: fSuivreCompte,
        f: (
          résultats: {
            résultat: RésultatObjectifRecherche<T>;
            score: number;
          }[],
        ) => 1,
      });
    const changerN = async (nouveauN: number) => {};

    const oublier = async () => {
      oublierComptes();
      await queue.onIdle();
    };
    return { oublier, n: changerN };
  }
}

export abstract class RechercheObjets<
  L extends ServicesLibp2pCrabe,
> extends Recherche<L> {
  abstract suivreAuteursObjet({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: Suivi<InfoAuteur[]>;
  }): Promise<Oublier>;

  @cacheRechercheParN
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
    fObjectif: SuivreObjectifRecherche<T>;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
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
            constl: this.constl,
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
        const oublierFavoris = await this.constl.favoris.suivreFavoris({
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
      return await réseau.suivreConfiance({
        idCompte: idAuteur,
        f: fSuivreBranche,
      });
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
