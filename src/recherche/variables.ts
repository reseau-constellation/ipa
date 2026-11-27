import { ignorerNonDéfinis } from "@constl/utils-ipa";
import { cacheRechercheParN, cacheSuivi } from "../nébuleuse/cache.ts";
import { rechercherSelonId, rechercherTous } from "./fonctions/utils.ts";
import { RechercheObjets } from "./recherche.ts";
import {
  rechercherVariablesSelonDescription,
  rechercherVariablesSelonNom,
  rechercherVariablesSelonTexte,
} from "./fonctions/variables.ts";
import type { ServicesNécessairesRechercheVariables } from "./fonctions/variables.ts";

import type { Oublier, RetourRecherche, Suivi } from "@constl/interface";
import type { SuivreObjectifRecherche, AccesseurService } from "./types.ts";
import type {
  RésultatRecherche,
  InfoRésultatTexte,
  InfoRésultatVide,
  InfoRésultat,
} from "@constl/interface/recherche";
import type { InfoAuteur } from "@constl/interface/objets";

export class RechercheVariables extends RechercheObjets<ServicesNécessairesRechercheVariables> {
  constructor({
    service,
  }: {
    service: AccesseurService<ServicesNécessairesRechercheVariables>;
  }) {
    super({ service });
  }

  @cacheRechercheParN
  async toutes({
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
    idVariable,
    f,
    n,
    idCompte,
  }: {
    idVariable: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherSelonId(idVariable),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonNom({
    nomVariable,
    f,
    n,
    idCompte,
  }: {
    nomVariable: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherVariablesSelonNom(nomVariable),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonDescription({
    descriptionVariable,
    f,
    n,
    idCompte,
  }: {
    descriptionVariable: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherVariablesSelonDescription(descriptionVariable),
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
    f: Suivi<RésultatRecherche<InfoRésultatTexte | InfoRésultatVide>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherVariablesSelonTexte(texte),
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
    return await this.service("variables").suivreAuteurs({
      idVariable: idObjet,
      f,
    });
  }

  identifiantValide({ idObjet }: { idObjet: string }): boolean {
    return this.service("variables").identifiantValide({
      identifiant: idObjet,
    });
  }

  async selonObjectif<T extends InfoRésultat = InfoRésultat>({
    f,
    fObjectif,
    n,
    idCompte,
  }: {
    f: Suivi<RésultatRecherche<T>[]>;
    fObjectif: SuivreObjectifRecherche<
      T,
      ServicesNécessairesRechercheVariables
    >;
    n?: number;
    idCompte?: string;
  }): Promise<RetourRecherche> {
    return await this.rechercherObjets<T>({
      f,
      n,
      fRecherche: async ({ f, idCompte }) =>
        await this.service("variables").suivreVariables({
          f: ignorerNonDéfinis(f),
          idCompte,
        }),
      fQualité: async ({ idObjet, f: fSuiviQualité }) =>
        await this.service("variables").suivreScoreQualité({
          idVariable: idObjet,
          f: fSuiviQualité,
        }),
      fObjectif,
      idCompte,
    });
  }
}
