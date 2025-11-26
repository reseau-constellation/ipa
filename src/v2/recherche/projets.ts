import { cacheRechercheParN, cacheSuivi } from "../crabe/cache.js";
import { rechercherSelonId, rechercherTous } from "./fonctions/utils.js";
import { Recherche } from "./recherche.js";
import {
  rechercherProjetsSelonBd,
  rechercherProjetsSelonDescription,
  rechercherProjetsSelonIdBd,
  rechercherProjetsSelonIdMotClef,
  rechercherProjetsSelonIdVariable,
  rechercherProjetsSelonMotClef,
  rechercherProjetsSelonNom,
  rechercherProjetsSelonNomMotClef,
  rechercherProjetsSelonNomVariable,
  rechercherProjetsSelonTexte,
  rechercherProjetsSelonVariable,
} from "./fonctions/projets.js";
import type { InfoAuteur } from "../types.js";
import type { Constellation } from "../index.js";
import type { ServicesConstellation } from "../constellation.js";
import type { ServicesLibp2pCrabe } from "../crabe/services/libp2p/libp2p.js";
import type { Oublier, Suivi } from "../crabe/types.js";
import type { Projets } from "../projets.js";
import type {
  InfoRésultat,
  InfoRésultatTexte,
  InfoRésultatVide,
  SuivreObjectifRecherche,
  RetourFonctionRecherche,
  RésultatRecherche,
  InfoRésultatRecherche,
} from "./types.js";

export class RechercheProjets<
  L extends ServicesLibp2pCrabe,
> extends Recherche<L> {
  projets: Projets<L>;

  constructor({
    projets,
    constl,
    service,
  }: {
    projets: Projets<L>;
    constl: Constellation;
    service: <T extends keyof ServicesConstellation<L>>(
      service: T,
    ) => ServicesConstellation<L>[T];
  }) {
    super({ constl, service });
    this.projets = projets;
  }

  @cacheRechercheParN
  async tous({
    f,
    n,
    idCompte,
  }: {
    f: Suivi<RésultatRecherche<InfoRésultatVide>[]>;
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
    idProjet,
    f,
    n,
    idCompte,
  }: {
    idProjet: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherSelonId(idProjet),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonNom({
    nomProjet,
    f,
    n,
    idCompte,
  }: {
    nomProjet: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherProjetsSelonNom(nomProjet),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonDescr({
    descriptionProjet,
    f,
    n,
    idCompte,
  }: {
    descriptionProjet: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherProjetsSelonDescription(descriptionProjet),
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
      fObjectif: rechercherProjetsSelonIdVariable(idVariable),
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
      fObjectif: rechercherProjetsSelonNomVariable(nomVariable),
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
    f: Suivi<
      RésultatRecherche<
        InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
      >[]
    >;
    n?: number;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherProjetsSelonVariable(texte),
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
      fObjectif: rechercherProjetsSelonIdMotClef(idMotClef),
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
      fObjectif: rechercherProjetsSelonNomMotClef(nomMotClef),
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
    f: Suivi<
      RésultatRecherche<
        InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
      >[]
    >;
    n?: number;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherProjetsSelonMotClef(texte),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonIdBd({
    idBd,
    f,
    n,
    idCompte,
  }: {
    idBd: string;
    f: Suivi<RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherProjetsSelonIdBd(idBd),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonBd({
    texte,
    f,
    n,
    idCompte,
  }: {
    texte: string;
    f: Suivi<
      RésultatRecherche<
        InfoRésultatRecherche<
          | InfoRésultatTexte
          | InfoRésultatRecherche<InfoRésultatTexte>
          | InfoRésultatVide
        >
      >[]
    >;
    n?: number;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherProjetsSelonBd(texte),
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
        | InfoRésultatRecherche<
            | InfoRésultatTexte
            | InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
            | InfoRésultatVide
          >
        | InfoRésultatVide
      >[]
    >;
    n?: number;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherProjetsSelonTexte(texte),
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
    return await this.projets.suivreAuteurs({ idProjet: idObjet, f });
  }

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
        await this.projets.suivreProjets({ f, idCompte }),
      fQualité: async ({ idObjet, f: fSuiviQualité }) =>
        await this.projets.suivreScoreQualité({
          idProjet: idObjet,
          f: fSuiviQualité,
        }),
      fObjectif,
      idCompte,
    });
  }
}
