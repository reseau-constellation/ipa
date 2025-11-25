import { profil } from "@/index.js";
import { cacheRechercheParN } from "../crabe/cache.js";
import { rechercherProfilsSelonNom, rechercherProfilsSelonImage, rechercherProfilsSelonCourriel, rechercherProfilsSelonTexte } from "./fonctions/profils.js";
import { rechercherSelonId, rechercherTous } from "./fonctions/utils.js";
import { Recherche } from "./recherche.js";
import type { ServicesConstellation } from "../constellation.js";
import type { ServicesLibp2pCrabe } from "../crabe/services/libp2p/libp2p.js";
import type { Profil } from "../crabe/services/profil.js";
import type { Suivi } from "../crabe/types.js";
import type { Constellation } from "../index.js";
import type { RésultatRecherche, InfoRésultatVide, RetourFonctionRecherche, InfoRésultat, SuivreObjectifRecherche, InfoRésultatTexte } from "./types.js";

export class RechercheProfils<
  L extends ServicesLibp2pCrabe,
> extends Recherche<L> {
  profils: Profil<L>;

  constructor({
    profils,
    constl,
    service,
  }: {
    profils: Profil<L>;
    constl: Constellation;
    service: <T extends keyof ServicesConstellation<L>>(
      service: T,
    ) => ServicesConstellation<L>[T];
  }) {
    super({ constl, service });
    this.profils = profils;
  }

  @cacheRechercheParN
  async tous({
    f,
    n,
  }: {
    f: Suivi<RésultatRecherche<InfoRésultatVide>[]>;
    n?: number;
  }): Promise<RetourFonctionRecherche> {
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
  }): Promise<RetourFonctionRecherche> {
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
  }): Promise<RetourFonctionRecherche> {
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
  }): Promise<RetourFonctionRecherche> {
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
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: profil.rechercherProfilsSelonActivité(),
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
  }): Promise<RetourFonctionRecherche> {
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
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherProfilsSelonTexte(texte),
    });
  }

  // Méthodes internes

  @cacheRechercheParN
  async selonObjectif<T extends InfoRésultat = InfoRésultat>({
    f,
    fObjectif,
    n,
  }: {
    f: Suivi<RésultatRecherche<T>[]>;
    fObjectif: SuivreObjectifRecherche<T>;
    n?: number;
  }): Promise<RetourFonctionRecherche> {
    const réseau = this.service("réseau");

    return await this.rechercher<T>({
      f,
      n,
      fRecherche: async ({ f }) =>
        await réseau.rechercherMembres({ f }),
      fQualité: async ({ idObjet, f: fSuiviQualité }) =>
        await this.profils.suivreScoreQualité({
          idProjet: idObjet,
          f: fSuiviQualité,
        }),
      fObjectif,
      fConfiance,
    });
  }
}