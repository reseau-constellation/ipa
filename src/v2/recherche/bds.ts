import { ignorerNonDéfinis } from "@constl/utils-ipa";
import { cacheRechercheParN, cacheSuivi } from "../nébuleuse/cache.js";
import {
  rechercherBdsSelonDescription,
  rechercherBdsSelonIdMotClef,
  rechercherBdsSelonIdVariable,
  rechercherBdsSelonMotClef,
  rechercherBdsSelonNom,
  rechercherBdsSelonNomMotClef,
  rechercherBdsSelonNomVariable,
  rechercherBdsSelonTexte,
  rechercherBdsSelonVariable,
} from "./fonctions/bds.js";
import { rechercherSelonId, rechercherTous } from "./fonctions/utils.js";
import { RechercheObjets } from "./recherche.js";
import type { ServicesNécessairesRechercheBds } from "./fonctions/bds.js";
import type { Bds } from "../bds/bds.js";
import type { Oublier, RetourRecherche, Suivi } from "../nébuleuse/types.js";
import type {
  RésultatRecherche,
  InfoRésultatTexte,
  InfoRésultatRecherche,
  InfoRésultatVide,
  InfoRésultat,
  SuivreObjectifRecherche,
  AccesseurService,
} from "./types.js";
import type { InfoAuteur } from "../types.js";

export class RechercheBds extends RechercheObjets<ServicesNécessairesRechercheBds> {
  bds: Bds;

  constructor({
    bds,
    service,
  }: {
    bds: Bds;
    service: AccesseurService<ServicesNécessairesRechercheBds>;
  }) {
    super({ service });
    this.bds = bds;
  }

  @cacheRechercheParN
  async toutes({
    f,
    n,
    idCompte,
  }: {
    f: Suivi<RésultatRecherche<InfoRésultatTexte | InfoRésultatVide>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherTous(),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonId({
    idBd,
    f,
    n,
    idCompte,
  }: {
    idBd: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherSelonId(idBd),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonNom({
    nomBd,
    f,
    n,
    idCompte,
  }: {
    nomBd: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherBdsSelonNom(nomBd),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonDescription({
    descriptionBd,
    f,
    n,
    idCompte,
  }: {
    descriptionBd: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherBdsSelonDescription(descriptionBd),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonIdMotClef({
    idMotClef,
    f,
    n,
    idCompte,
  }: {
    idMotClef: string;
    f: Suivi<RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherBdsSelonIdMotClef(idMotClef),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonIdVariable({
    idVariable,
    f,
    n,
    idCompte,
  }: {
    idVariable: string;
    f: Suivi<RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherBdsSelonIdVariable(idVariable),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonNomMotClef({
    nomMotClef,
    f,
    n,
    idCompte,
  }: {
    nomMotClef: string;
    f: Suivi<RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherBdsSelonNomMotClef(nomMotClef),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonNomVariable({
    nomVariable,
    f,
    n,
    idCompte,
  }: {
    nomVariable: string;
    f: Suivi<RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherBdsSelonNomVariable(nomVariable),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonMotClef({
    texte,
    f,
    n,
    idCompte,
  }: {
    texte: string;
    f: Suivi<RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherBdsSelonMotClef(texte),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonVariable({
    texte,
    f,
    n,
    idCompte,
  }: {
    texte: string;
    f: Suivi<RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherBdsSelonVariable(texte),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonTexte({
    texte,
    f,
    n,
    idCompte,
  }: {
    texte: string;
    f: Suivi<
      RésultatRecherche<
        | InfoRésultatTexte
        | InfoRésultatRecherche<InfoRésultatTexte>
        | InfoRésultatVide
      >[]
    >;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherBdsSelonTexte(texte),
      idCompte,
    });
  }

  // Méthodes internes

  @cacheSuivi
  async suivreAuteursObjet({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: Suivi<InfoAuteur[]>;
  }): Promise<Oublier> {
    return await this.bds.suivreAuteurs({ idBd: idObjet, f });
  }

  @cacheRechercheParN
  async selonObjectif<T extends InfoRésultat = InfoRésultat>({
    f,
    fObjectif,
    n,
    idCompte,
  }: {
    f: Suivi<RésultatRecherche<T>[]>;
    fObjectif: SuivreObjectifRecherche<T, ServicesNécessairesRechercheBds>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.rechercherObjets<T>({
      f,
      n,
      fRecherche: async ({ f, idCompte }) =>
        await this.bds.suivreBds({ f: ignorerNonDéfinis(f), idCompte }),
      fQualité: async ({ idObjet, f: fSuiviQualité }) =>
        await this.bds.suivreScoreQualité({
          idBd: idObjet,
          f: (score) => fSuiviQualité(score.total),
        }),
      fObjectif,
      idCompte,
    });
  }
}
