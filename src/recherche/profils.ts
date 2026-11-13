import { faisRien, ignorerNonDéfinis } from "@constl/utils-ipa";
import { cacheRechercheParN } from "../nébuleuse/cache.js";
import {
  rechercherProfilsSelonNom,
  rechercherProfilsSelonImage,
  rechercherProfilsSelonCourriel,
  rechercherProfilsSelonTexte,
  rechercherProfilsSelonActivité,
} from "./fonctions/profils.js";
import { rechercherSelonId, rechercherTous } from "./fonctions/utils.js";
import { Recherche } from "./recherche.js";
import type { ServicesNécessairesRechercheProfils } from "./fonctions/profils.js";
import type { Oublier, RetourRecherche, Suivi } from "../nébuleuse/types.js";
import type {
  RésultatRecherche,
  InfoRésultatVide,
  InfoRésultat,
  SuivreObjectifRecherche,
  InfoRésultatTexte,
  AccesseurService,
} from "./types.js";

export class RechercheProfils extends Recherche<ServicesNécessairesRechercheProfils> {
  constructor({
    service,
  }: {
    service: AccesseurService<ServicesNécessairesRechercheProfils>;
  }) {
    super({ service });
  }

  @cacheRechercheParN
  async tous({
    f,
    n,
  }: {
    f: Suivi<RésultatRecherche<InfoRésultatVide>[]>;
    n?: number;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherTous(),
    });
  }

  @cacheRechercheParN
  async selonId({
    idCompte,
    f,
    n,
  }: {
    idCompte: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherSelonId(idCompte),
    });
  }

  @cacheRechercheParN
  async selonNom({
    nom,
    f,
    n,
  }: {
    nom: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherProfilsSelonNom(nom),
    });
  }

  @cacheRechercheParN
  async selonImage({
    image,
    f,
    n,
  }: {
    image: Uint8Array;
    f: Suivi<RésultatRecherche<InfoRésultatVide>[]>;
    n?: number;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherProfilsSelonImage(image),
    });
  }

  @cacheRechercheParN
  async selonActivité({
    f,
    n,
  }: {
    f: Suivi<RésultatRecherche<InfoRésultatVide>[]>;
    n?: number;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherProfilsSelonActivité(),
    });
  }

  @cacheRechercheParN
  async selonCourriel({
    courriel,
    f,
    n,
  }: {
    courriel: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherProfilsSelonCourriel(courriel),
    });
  }

  @cacheRechercheParN
  async selonTexte({
    texte,
    f,
    n,
  }: {
    texte: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte | InfoRésultatVide>[]>;
    n?: number;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherProfilsSelonTexte(texte),
    });
  }

  // Méthodes internes

  async selonObjectif<T extends InfoRésultat = InfoRésultat>({
    f,
    fObjectif,
    n,
  }: {
    f: Suivi<RésultatRecherche<T>[]>;
    fObjectif: SuivreObjectifRecherche<T, ServicesNécessairesRechercheProfils>;
    n?: number;
  }): Promise<RetourRecherche> {
    const réseau = this.service("réseau");

    const fConfiance = async ({
      idObjet,
      f: fSuivi,
    }: {
      idObjet: string;
      f: Suivi<number>;
    }) => {
      const { oublier } = await réseau.suivreConfianceCompte({
        idCompte: idObjet,
        f: ignorerNonDéfinis(fSuivi),
      });
      return oublier;
    };

    const fQualité = async ({
      idObjet,
      f,
    }: {
      idObjet: string;
      f: Suivi<number>;
    }): Promise<Oublier> => {
      const fRechercherSelonActivité = rechercherProfilsSelonActivité();
      return await fRechercherSelonActivité({
        services: this.service,
        idObjet,
        f: async (résultat) => {
          await f(résultat?.score || 0);
        },
      });
    };

    return await this.rechercher<T>({
      f,
      n,
      fRecherche: async ({ idCompte, f: fSuivi }): Promise<Oublier> => {
        await fSuivi([idCompte]);
        return faisRien; // Rien à faire parce que nous ne recherchons que le compte
      },
      fQualité,
      fObjectif,
      fConfiance,
    });
  }
}
