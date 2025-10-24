import * as bd from "@/recherche/bd.js";
import * as motClef from "@/recherche/motClef.js";
import * as nuée from "@/recherche/nuée.js";
import * as profil from "@/recherche/profil.js";
import * as projet from "@/recherche/projet.js";
import * as utils from "@/recherche/utils.js";
import * as variable from "@/recherche/variable.js";

import { cacheRechercheParN } from "@/décorateursCache.js";
import type { Constellation } from "@/client.js";
import type {
  infoRésultatRecherche,
  infoRésultatTexte,
  infoRésultatVide,
  résultatRecherche,
  schémaFonctionSuivi,
  schémaRetourFonctionRechercheParN,
} from "@/types.js";

export class Recherche {
  client: Constellation;

  constructor({ client }: { client: Constellation }) {
    this.client = client;
  }

  @cacheRechercheParN
  async rechercherVariables({
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    return await this.client.réseau.rechercherVariables({
      f,
      nRésultatsDésirés,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherVariablesSelonId({
    idVariable,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = utils.rechercherSelonId(idVariable);
    return await this.client.réseau.rechercherVariables({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherVariablesSelonNom({
    nomVariable,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    nomVariable: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = variable.rechercherVariablesSelonNom(nomVariable);
    return await this.client.réseau.rechercherVariables({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherVariablesSelonDescr({
    descrVariable,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    descrVariable: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = variable.rechercherVariablesSelonDescr(descrVariable);
    return await this.client.réseau.rechercherVariables({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherVariablesSelonTexte({
    texte,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatTexte | infoRésultatVide>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = variable.rechercherVariablesSelonTexte(texte);
    return await this.client.réseau.rechercherVariables({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherMotsClefs({
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    return await this.client.réseau.rechercherMotsClefs({
      f,
      nRésultatsDésirés,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherMotsClefsSelonId({
    idMotClef,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    idMotClef: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = utils.rechercherSelonId(idMotClef);
    return await this.client.réseau.rechercherMotsClefs({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherMotsClefsSelonNom({
    nomMotClef,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    nomMotClef: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = motClef.rechercherMotsClefsSelonNom(nomMotClef);
    return await this.client.réseau.rechercherMotsClefs({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherMotsClefsSelonDescr({
    descrMotClef,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    descrMotClef: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = motClef.rechercherMotsClefsSelonDescr(descrMotClef);
    return await this.client.réseau.rechercherMotsClefs({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherMotsClefsSelonTexte({
    texte,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatTexte | infoRésultatVide>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = motClef.rechercherMotsClefsSelonTexte(texte);
    return await this.client.réseau.rechercherMotsClefs({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherBds({
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    return await this.client.réseau.rechercherBds({
      f,
      nRésultatsDésirés,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherBdsSelonId({
    idBd,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = utils.rechercherSelonId(idBd);
    return await this.client.réseau.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherBdsSelonNom({
    nomBd,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    nomBd: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdsSelonNom(nomBd);
    return await this.client.réseau.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherBdsSelonDescr({
    descrBd,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    descrBd: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdsSelonDescr(descrBd);
    return await this.client.réseau.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherBdsSelonIdMotClef({
    idMotClef,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    idMotClef: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdsSelonIdMotClef(idMotClef);
    return await this.client.réseau.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherBdsSelonIdVariable({
    idVariable,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdsSelonIdVariable(idVariable);
    return await this.client.réseau.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherBdsSelonNomMotClef({
    nomMotClef,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    nomMotClef: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdsSelonNomMotClef(nomMotClef);
    return await this.client.réseau.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherBdsSelonNomVariable({
    nomVariable,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    nomVariable: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdsSelonNomVariable(nomVariable);
    return await this.client.réseau.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherBdsSelonMotClef({
    texte,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdsSelonMotClef(texte);
    return await this.client.réseau.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherBdsSelonVariable({
    texte,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdsSelonVariable(texte);
    return await this.client.réseau.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherBdsSelonTexte({
    texte,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<infoRésultatTexte>
        | infoRésultatVide
      >[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdsSelonTexte(texte);
    return await this.client.réseau.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherProfilsSelonId({
    idCompte,
    f,
    nRésultatsDésirés,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = utils.rechercherSelonId(idCompte);
    return await this.client.réseau.rechercherMembres({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParN
  async rechercherProfilsSelonNom({
    nom,
    f,
    nRésultatsDésirés,
  }: {
    nom: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = profil.rechercherProfilsSelonNom(nom);
    return await this.client.réseau.rechercherMembres({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParN
  async rechercherProfilsSelonImage({
    image,
    f,
    nRésultatsDésirés,
  }: {
    image: Uint8Array;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatVide>[]>;
    nRésultatsDésirés?: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = profil.rechercherProfilsSelonImage(image);
    return await this.client.réseau.rechercherMembres({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParN
  async rechercherProfilsSelonActivité({
    f,
    nRésultatsDésirés,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatVide>[]>;
    nRésultatsDésirés?: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = profil.rechercherProfilsSelonActivité();
    return await this.client.réseau.rechercherMembres({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParN
  async rechercherProfilsSelonCourriel({
    courriel,
    f,
    nRésultatsDésirés,
  }: {
    courriel: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = profil.rechercherProfilsSelonCourriel(courriel);
    return await this.client.réseau.rechercherMembres({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParN
  async rechercherProfilsSelonTexte({
    texte,
    f,
    nRésultatsDésirés,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatTexte | infoRésultatVide>[]
    >;
    nRésultatsDésirés?: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = profil.rechercherProfilsSelonTexte(texte);
    return await this.client.réseau.rechercherMembres({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParN
  async rechercherProjets({
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    return await this.client.réseau.rechercherProjets({
      f,
      nRésultatsDésirés,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherProjetsSelonId({
    idProjet,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    idProjet: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = utils.rechercherSelonId(idProjet);
    return await this.client.réseau.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherProjetsSelonNom({
    nomProjet,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    nomProjet: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetsSelonNom(nomProjet);
    return await this.client.réseau.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherProjetsSelonDescr({
    descrProjet,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    descrProjet: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetsSelonDescr(descrProjet);
    return await this.client.réseau.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherProjetsSelonIdVariable({
    idVariable,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetsSelonIdVariable(idVariable);
    return await this.client.réseau.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherProjetsSelonNomVariable({
    nomVariable,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    nomVariable: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetsSelonNomVariable(nomVariable);
    return await this.client.réseau.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherProjetsSelonVariable({
    texte,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<
        infoRésultatRecherche<infoRésultatTexte | infoRésultatVide>
      >[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetsSelonVariable(texte);
    return await this.client.réseau.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherProjetsSelonIdMotClef({
    idMotClef,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    idMotClef: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetsSelonIdMotClef(idMotClef);
    return await this.client.réseau.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherProjetsSelonNomMotClef({
    nomMotClef,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    nomMotClef: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetsSelonNomMotClef(nomMotClef);
    return await this.client.réseau.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherProjetsSelonMotClef({
    texte,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<
        infoRésultatRecherche<infoRésultatTexte | infoRésultatVide>
      >[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetsSelonMotClef(texte);
    return await this.client.réseau.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherProjetsSelonIdBd({
    idBd,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetsSelonIdBd(idBd);
    return await this.client.réseau.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherProjetsSelonBd({
    texte,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<
        infoRésultatRecherche<
          | infoRésultatTexte
          | infoRésultatRecherche<infoRésultatTexte>
          | infoRésultatVide
        >
      >[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetsSelonBd(texte);
    return await this.client.réseau.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherProjetsSelonTexte({
    texte,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            | infoRésultatTexte
            | infoRésultatRecherche<infoRésultatTexte | infoRésultatVide>
            | infoRésultatVide
          >
        | infoRésultatVide
      >[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetsSelonTexte(texte);
    return await this.client.réseau.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherNuées({
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    return await this.client.réseau.rechercherNuées({
      f,
      nRésultatsDésirés,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherNuéesSelonId({
    idNuée,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = utils.rechercherSelonId(idNuée);
    return await this.client.réseau.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherNuéesSelonNom({
    nomNuée,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    nomNuée: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéesSelonNom(nomNuée);
    return await this.client.réseau.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherNuéesSelonDescr({
    descrNuée,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    descrNuée: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéesSelonDescr(descrNuée);
    return await this.client.réseau.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherNuéesSelonIdMotClef({
    idMotClef,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    idMotClef: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéesSelonIdMotClef(idMotClef);
    return await this.client.réseau.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherNuéesSelonIdVariable({
    idVariable,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéesSelonIdVariable(idVariable);
    return await this.client.réseau.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherNuéesSelonNomMotClef({
    nomMotClef,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    nomMotClef: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéesSelonNomMotClef(nomMotClef);
    return await this.client.réseau.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherNuéesSelonNomVariable({
    nomVariable,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    nomVariable: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéesSelonNomVariable(nomVariable);
    return await this.client.réseau.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherNuéesSelonMotClef({
    texte,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéesSelonMotClef(texte);
    return await this.client.réseau.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherNuéesSelonVariable({
    texte,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéesSelonVariable(texte);
    return await this.client.réseau.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheRechercheParN
  async rechercherNuéesSelonTexte({
    texte,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<infoRésultatTexte>
        | infoRésultatVide
      >[]
    >;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéesSelonTexte(texte);
    return await this.client.réseau.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
      toutLeRéseau,
    });
  }
}
