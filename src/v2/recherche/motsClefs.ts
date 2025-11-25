import { cacheRechercheParN } from "../crabe/cache.js";
import { rechercherSelonId, rechercherTous } from "./fonctions/utils.js";
import { Recherche } from "./recherche.js";
import { rechercherMotsClefsSelonDescription, rechercherMotsClefsSelonNom, rechercherMotsClefsSelonTexte } from "./fonctions/motsClefs.js";
import type { Constellation } from "../index.js";
import type { ServicesConstellation } from "../constellation.js";
import type { ServicesLibp2pCrabe } from "../crabe/services/libp2p/libp2p.js";
import type { Suivi } from "../crabe/types.js";
import type { MotsClefs } from "../motsClefs.js";
import type {
  InfoRésultat,
  InfoRésultatTexte,
  InfoRésultatVide,
  SuivreObjectifRecherche,
  RetourFonctionRecherche,
  RésultatRecherche,
} from "./types.js";

export class RechercheMotsClefs<
  L extends ServicesLibp2pCrabe,
> extends Recherche<L> {
  motsClefs: MotsClefs<L>;

  constructor({
    motsClefs,
    constl,
    service,
  }: {
    motsClefs: MotsClefs<L>;
    constl: Constellation;
    service: <T extends keyof ServicesConstellation<L>>(
      service: T,
    ) => ServicesConstellation<L>[T];
  }) {
    super({ constl, service });
    this.motsClefs = motsClefs;
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
    idMotClef,
    f,
    n,
    idCompte,
  }: {
    idMotClef: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherSelonId(idMotClef),
      idCompte,
    });
  }

  async selonNom ({
    nomMotClef,
    f,
    n,
    idCompte,
  }: {
    nomMotClef: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherMotsClefsSelonNom(nomMotClef),
      idCompte,
    });
  };
  
  async selonDescription ({
    descriptionMotClef,
    f,
    n,
    idCompte,
}: {
    descriptionMotClef: string;
    f: Suivi<RésultatRecherche<InfoRésultatTexte>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherMotsClefsSelonDescription(descriptionMotClef),
      idCompte,
    });
  };
  
  async selonTexte ({
    texte,
    f,
    n,
    idCompte,
  }: {
    texte: string,
    f: Suivi<RésultatRecherche<InfoRésultatTexte | InfoRésultatVide>[]>;
    n?: number;
    idCompte?: string;
  }): Promise<RetourFonctionRecherche> {
    return await this.selonObjectif({
      f,
      n,
      fObjectif: rechercherMotsClefsSelonTexte(texte),
      idCompte,
    });
  };

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
        await this.motsClefs.suivreMotsClefs({ f, idCompte }),
      fQualité: async ({ idObjet, f: fSuiviQualité }) =>
        await this.motsClefs.suivreQualité({
          idMotClef: idObjet,
          f: fSuiviQualité,
        }),
      fObjectif,
      idCompte,
    });
  }
}
