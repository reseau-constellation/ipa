import { cacheRechercheParN } from "../crabe/cache.js";
import { rechercherSelonId, rechercherTous } from "./fonctions/utils.js";
import { Recherche } from "./recherche.js";
import { rechercherNuéesSelonDescription, rechercherNuéesSelonIdMotClef, rechercherNuéesSelonIdVariable, rechercherNuéesSelonMotClef, rechercherNuéesSelonNom, rechercherNuéesSelonNomMotClef, rechercherNuéesSelonNomVariable, rechercherNuéesSelonTexte, rechercherNuéesSelonVariable } from "./fonctions/nuées.js";
import type { Constellation } from "../index.js";
import type { ServicesConstellation } from "../constellation.js";
import type { ServicesLibp2pCrabe } from "../crabe/services/libp2p/libp2p.js";
import type { Suivi } from "../crabe/types.js";
import type { Nuées } from "../nuées.js";
import type {
  InfoRésultat,
  InfoRésultatTexte,
  InfoRésultatVide,
  SuivreObjectifRecherche,
  RetourFonctionRecherche,
  RésultatRecherche,
  InfoRésultatRecherche,
} from "./types.js";

export class RechercheNuées<
  L extends ServicesLibp2pCrabe,
> extends Recherche<L> {
  nuées: Nuées<L>;

  constructor({
    nuées: nuées,
    constl,
    service,
  }: {
    nuées: Nuées<L>;
    constl: Constellation;
    service: <T extends keyof ServicesConstellation<L>>(
      service: T,
    ) => ServicesConstellation<L>[T];
  }) {
    super({ constl, service });
    this.nuées = nuées;
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
    idNuée,
    f,
    n,
    idCompte,
  }: {
    idNuée: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherSelonId(idNuée),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonNom({
    nomNuée,
    f,
    n,
    idCompte,
  }: {
    nomNuée: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherNuéesSelonNom(nomNuée),
      idCompte,
    });
  }

  @cacheRechercheParN
  async selonDescription({
    descriptionNuée,
    f,
    n,
    idCompte,
  }: {
    descriptionNuée: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherNuéesSelonDescription(descriptionNuée),
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
      fObjectif: rechercherNuéesSelonIdMotClef(idMotClef),
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
      fObjectif: rechercherNuéesSelonIdVariable(idVariable),
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
      fObjectif: rechercherNuéesSelonNomMotClef(nomMotClef),
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
      fObjectif: rechercherNuéesSelonNomVariable(nomVariable),
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
      fObjectif: rechercherNuéesSelonMotClef(texte),
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
      fObjectif: rechercherNuéesSelonVariable(texte),
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
      fObjectif: rechercherNuéesSelonTexte(texte),
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
        await this.nuées.suivreNuées({ f, idCompte }),
      fQualité: async ({ idObjet, f: fSuiviQualité }) =>
        await this.nuées.suivreScoreQualité({
          idNuée: idObjet,
          f: fSuiviQualité,
        }),
      fObjectif,
      idCompte,
    });
  }
}
