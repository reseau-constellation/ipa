import { cacheRechercheParN } from "../crabe/cache.js";
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
import { Recherche } from "./recherche.js";
import type { Bds } from "../bds/bds.js";
import type { ServicesConstellation } from "../constellation.js";
import type { ServicesLibp2pCrabe } from "../crabe/services/libp2p/libp2p.js";
import type { Suivi } from "../crabe/types.js";
import type { Constellation } from "../index.js";
import type {
  RésultatRecherche,
  InfoRésultatTexte,
  RetourFonctionRecherche,
  InfoRésultatRecherche,
  InfoRésultatVide,
  InfoRésultat,
  SuivreObjectifRecherche,
} from "./types.js";

export class RechercheBds<L extends ServicesLibp2pCrabe> extends Recherche<L> {
  bds: Bds<L>;

  constructor({
    bds,
    constl,
    service,
  }: {
    bds: Bds<L>;
    constl: Constellation;
    service: <T extends keyof ServicesConstellation<L>>(
      service: T,
    ) => ServicesConstellation<L>[T];
  }) {
    super({ constl, service });
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
  }): Promise<RetourFonctionRecherche> {
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
  }): Promise<RetourFonctionRecherche> {
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
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherBdsSelonNom(nomBd),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonDescr({
    descrBd,
    f,
    n,
    idCompte,
  }: {
    descrBd: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherBdsSelonDescription(descrBd),
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
  }): Promise<RetourFonctionRecherche> {
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
  }): Promise<RetourFonctionRecherche> {
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
  }): Promise<RetourFonctionRecherche> {
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
  }): Promise<RetourFonctionRecherche> {
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
  }): Promise<RetourFonctionRecherche> {
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
  }): Promise<RetourFonctionRecherche> {
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
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherBdsSelonTexte(texte),
      idCompte,
    });
  }

  // Méthodes internes

  @cacheRechercheParN
  async selonObjectif<T extends InfoRésultat = InfoRésultat>({
    f,
    fObjectif,
    n,
    idCompte,
  }: {
    f: Suivi<RésultatRecherche<T>[]>;
    fObjectif: SuivreObjectifRecherche<T>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    return await this.rechercherObjets<T>({
      f,
      n,
      fRecherche: async ({ f, idCompte }) =>
        await this.bds.suivreBds({ f, idCompte }),
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
