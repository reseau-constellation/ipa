import { ignorerNonDéfinis } from "@constl/utils-ipa";
import { cacheRechercheParN, cacheSuivi } from "../nébuleuse/cache.js";
import { rechercherSelonId, rechercherTous } from "./fonctions/utils.js";
import { RechercheObjets } from "./recherche.js";
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
import type { ServicesNécessairesRechercheProjets } from "./fonctions/projets.js";
import type { InfoAuteur } from "../types.js";
import type { Oublier, RetourRecherche, Suivi } from "../nébuleuse/types.js";
import type { Projets } from "../projets.js";
import type {
  InfoRésultat,
  InfoRésultatTexte,
  InfoRésultatVide,
  SuivreObjectifRecherche,
  RésultatRecherche,
  InfoRésultatRecherche,
  AccesseurService,
} from "./types.js";

export class RechercheProjets extends RechercheObjets<ServicesNécessairesRechercheProjets> {
  constructor({
    service,
  }: {
    projets: Projets;
    service: AccesseurService<ServicesNécessairesRechercheProjets>;
  }) {
    super({ service });
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
    idProjet,
    f,
    n,
    idCompte,
  }: {
    idProjet: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
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
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherProjetsSelonNom(nomProjet),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonDescription({
    descriptionProjet,
    f,
    n,
    idCompte,
  }: {
    descriptionProjet: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
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
  }): Promise<RetourRecherche> {
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
  }): Promise<RetourRecherche> {
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
  }): Promise<RetourRecherche> {
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
  }): Promise<RetourRecherche> {
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
  }): Promise<RetourRecherche> {
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
  }): Promise<RetourRecherche> {
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
  }): Promise<RetourRecherche> {
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
  }): Promise<RetourRecherche> {
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
  }): Promise<RetourRecherche> {
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
    return await this.service("projets").suivreAuteurs({
      idProjet: idObjet,
      f,
    });
  }

  async selonObjectif<T extends InfoRésultat = InfoRésultat>({
    f,
    fObjectif,
    n,
    idCompte,
  }: {
    f: Suivi<RésultatRecherche<T>[]>;
    fObjectif: SuivreObjectifRecherche<T, ServicesNécessairesRechercheProjets>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.rechercherObjets<T>({
      f,
      n,
      fRecherche: async ({ f, idCompte }) =>
        await this.service("projets").suivreProjets({
          f: ignorerNonDéfinis(f),
          idCompte,
        }),
      fQualité: async ({ idObjet, f: fSuiviQualité }) =>
        await this.service("projets").suivreScoreQualité({
          idProjet: idObjet,
          f: fSuiviQualité,
        }),
      fObjectif,
      idCompte,
    });
  }
}
