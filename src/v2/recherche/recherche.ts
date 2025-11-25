import { ignorerNonDéfinis, suivreDeFonctionListe } from "@constl/utils-ipa";
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
      f: (objets: string[] | undefined) => void;
    }) => Promise<Oublier>;
    fQualité: SuivreQualitéRecherche;
    fObjectif: SuivreObjectifRecherche<T>;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    if (idCompte) {
      return await suivreDeFonctionListe({
        fListe: async ({ fSuivreRacine }: { fSuivreRacine: Suivi<string[]> }) =>
          await fRecherche({
            idCompte,
            f: ignorerNonDéfinis(fSuivreRacine),
          }),
        fBranche: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: Suivi<RésultatRecherche<T>>;
        }): Promise<Oublier> =>
          await fObjectifFinal({
            constl: this.constl,
            id,
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

      // Il y a probablement une meilleure façon de faire ça, mais pour l'instant ça passe

      return await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (éléments: string[]) => Promise<void>;
        }): Promise<schémaRetourFonctionRechercheParN> => {
          return {
            fOublier: await fRechercheLesMiens(fSuivreRacine),
            fChangerN: () => Promise.resolve(),
          }; // À faire : implémenter fChangerN ?
        },
        f,
        fBranche,
      });
    } else {
      return await this.rechercher({
        f,
        n,
        fRecherche,
        fObjectif,
        fConfiance: async ({ idObjet, f }) =>
          await this.suivreConfianceAuteurs({ idObjet, f }),
        fQualité,
      });
    }
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
      fSuivreRacine: (auteurs: string[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreAuteursObjet({
        idObjet: idItem,
        clef,
        f: async (auteurs: infoAuteur[]) => {
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
      fSuivreBranche: schémaFonctionSuivi<number>;
    }): Promise<schémaFonctionOublier> => {
      const { fOublier } = await this.suivreConfianceMonRéseauPourMembre({
        idCompte: idAuteur,
        f: fSuivreBranche,
        profondeur: 4,
      });
      return fOublier;
    };

    const fFinale = async (confiances: number[]) => {
      const confiance = confiances.reduce((a, b) => a + b, 0);
      await f(confiance);
    };

    const fRéduction = (branches: number[]) => branches.flat();

    return await suivreDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
      fRéduction,
    });
  }
}
