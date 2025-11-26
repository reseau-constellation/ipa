import {
  ignorerNonDéfinis,
  suivreDeFonctionListe,
  suivreFonctionImbriquée,
} from "@constl/utils-ipa";
import PQueue from "p-queue";
import {
  cacheRechercheParN,
  cacheRechercheParProfondeur,
} from "../crabe/cache.js";
import type { Oublier, Suivi } from "../crabe/types.js";
import type {
  InfoRésultat,
  RetourFonctionRecherche,
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

    const fSuivreCompte = async () => {};
    const { changerProfondeur, oublier: oublierComptes } =
      await réseau.suivreComptesRéseauEtEnLigne({
        f: fSuivreCompte,
        profondeur,
      });
    const changerN = async (nouveauN: number) => {};

    const oublier = async () => {
      oublierComptes();
      await queue.onIdle();
    };
    return { oublier, n: changerN };
  }

}

export abstract class RechercheObjets<L extends ServicesLibp2pCrabe> extends Recherche<L> {

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
