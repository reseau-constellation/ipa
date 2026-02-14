import { ignorerNonDéfinis } from "@constl/utils-ipa";
import { cacheRechercheParN, cacheSuivi } from "../nébuleuse/cache.js";
import { rechercherSelonId, rechercherTous } from "./fonctions/utils.js";
import { RechercheObjets } from "./recherche.js";
import {
  rechercherVariablesSelonDescription,
  rechercherVariablesSelonNom,
  rechercherVariablesSelonTexte,
} from "./fonctions/variables.js";
import type { InfoAuteur } from "../types.js";
import type { Constellation } from "../index.js";
import type { ServicesConstellation } from "../constellation.js";
import type { ServicesLibp2pNébuleuse } from "../nébuleuse/services/libp2p/libp2p.js";
import type { Oublier, RetourRecherche, Suivi } from "../nébuleuse/types.js";
import type { Variables } from "../variables.js";
import type {
  InfoRésultat,
  InfoRésultatTexte,
  InfoRésultatVide,
  SuivreObjectifRecherche,
  RésultatRecherche,
} from "./types.js";

export class RechercheVariables extends RechercheObjets<ServicesNécessairesRechercheVariables> {
  constructor({
    variables,
    constl,
    service,
  }: {
    variables: Variables<L>;
    constl: Constellation;
    service: <T extends keyof ServicesConstellation<L>>(
      service: T,
    ) => ServicesConstellation<L>[T];
  }) {
    super({ constl, service });
    this.variables = variables;
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
    return await this.variables.suivreAuteurs({ idVariable: idObjet, f });
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
  }): Promise<RetourRecherche> {
    return await this.rechercherObjets<T>({
      f,
      n,
      fRecherche: async ({ f, idCompte }) =>
        await this.variables.suivreVariables({
          f: ignorerNonDéfinis(f),
          idCompte,
        }),
      fQualité: async ({ idObjet, f: fSuiviQualité }) =>
        await this.variables.suivreScoreQualité({
          idVariable: idObjet,
          f: fSuiviQualité,
        }),
      fObjectif,
      idCompte,
    });
  }
}
