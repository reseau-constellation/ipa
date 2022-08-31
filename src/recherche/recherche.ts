import * as bd from "@/recherche/bd";
import * as motClef from "@/recherche/motClef";
import * as profil from "@/recherche/profil";
import * as projet from "@/recherche/projet";
import * as variable from "@/recherche/variable";
import * as utils from "@/recherche/utils";

import ClientConstellation from "@/client";
import { réponseSuivreRecherche } from "@/reseau";
import {
  schémaFonctionSuivi,
  résultatRecherche,
  infoRésultatRecherche,
  infoRésultatTexte,
  infoRésultatVide,
} from "@/utils";

export class Recherche {
  client: ClientConstellation;

  constructor({ client }: { client: ClientConstellation }) {
    this.client = client;
  }

  async rechercherVariables({
    f,
    nRésultatsDésirés,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    return await this.client.réseau!.rechercherVariables({
      f,
      nRésultatsDésirés,
    });
  }

  async rechercherVariableSelonId({
    idVariable,
    f,
    nRésultatsDésirés,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = utils.rechercherSelonId(idVariable);
    return await this.client.réseau!.rechercherVariables({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherVariableSelonNom({
    nomVariable,
    f,
    nRésultatsDésirés,
  }: {
    nomVariable: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = variable.rechercherVariableSelonNom(nomVariable);
    return await this.client.réseau!.rechercherVariables({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherVariableSelonDescr({
    descrVariable,
    f,
    nRésultatsDésirés,
  }: {
    descrVariable: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = variable.rechercherVariableSelonDescr(descrVariable);
    return await this.client.réseau!.rechercherVariables({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherVariableSelonTexte({
    texte,
    f,
    nRésultatsDésirés,
  }: {
    texte: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = variable.rechercherVariableSelonTexte(texte);
    return await this.client.réseau!.rechercherVariables({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherMotsClefs({
    f,
    nRésultatsDésirés,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    return await this.client.réseau!.rechercherMotsClefs({
      f,
      nRésultatsDésirés,
    });
  }

  async rechercherMotClefSelonId({
    idMotClef,
    f,
    nRésultatsDésirés,
  }: {
    idMotClef: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = utils.rechercherSelonId(idMotClef);
    return await this.client.réseau!.rechercherMotsClefs({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherMotClefSelonNom({
    nomMotClef,
    f,
    nRésultatsDésirés,
  }: {
    nomMotClef: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = motClef.rechercherMotClefSelonNom(nomMotClef);
    return await this.client.réseau!.rechercherMotsClefs({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherMotClefSelonTexte({
    texte,
    f,
    nRésultatsDésirés,
  }: {
    texte: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = motClef.rechercherMotClefSelonTexte(texte);
    return await this.client.réseau!.rechercherMotsClefs({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherBds({
    f,
    nRésultatsDésirés,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    return await this.client.réseau!.rechercherBds({ f, nRésultatsDésirés });
  }

  async rechercherBdSelonId({
    idBd,
    f,
    nRésultatsDésirés,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = utils.rechercherSelonId(idBd);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherBdSelonNom({
    nomBd,
    f,
    nRésultatsDésirés,
  }: {
    nomBd: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = bd.rechercherBdSelonNom(nomBd);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherBdSelonDescr({
    descrBd,
    f,
    nRésultatsDésirés,
  }: {
    descrBd: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = bd.rechercherBdSelonDescr(descrBd);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherBdSelonIdMotClef({
    idMotClef,
    f,
    nRésultatsDésirés,
  }: {
    idMotClef: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = bd.rechercherBdSelonIdMotClef(idMotClef);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherBdSelonIdVariable({
    idVariable,
    f,
    nRésultatsDésirés,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = bd.rechercherBdSelonIdVariable(idVariable);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherBdSelonNomMotClef({
    nomMotClef,
    f,
    nRésultatsDésirés,
  }: {
    nomMotClef: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = bd.rechercherBdSelonNomMotClef(nomMotClef);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherBdSelonNomVariable({
    nomVariable,
    f,
    nRésultatsDésirés,
  }: {
    nomVariable: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = bd.rechercherBdSelonNomVariable(nomVariable);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherBdSelonMotClef({
    texte,
    f,
    nRésultatsDésirés,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = bd.rechercherBdSelonMotClef(texte);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherBdSelonVariable({
    texte,
    f,
    nRésultatsDésirés,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = bd.rechercherBdSelonVariable(texte);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherBdSelonTexte({
    texte,
    f,
    nRésultatsDésirés,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<
        infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
      >[]
    >;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = bd.rechercherBdSelonTexte(texte);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherProjets({
    f,
    nRésultatsDésirés,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
    });
  }

  async rechercherProfilSelonId({
    idCompte,
    f,
    nRésultatsDésirés,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = utils.rechercherSelonId(idCompte);
    return await this.client.réseau!.rechercherMembres({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherProfilSelonNom({
    nom,
    f,
    nRésultatsDésirés,
  }: {
    nom: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = profil.rechercherProfilSelonNom(nom);
    return await this.client.réseau!.rechercherMembres({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherProfilSelonImage({
    image,
    f,
    nRésultatsDésirés,
  }: {
    image: Uint8Array;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatVide>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = profil.rechercherProfilSelonImage(image);
    return await this.client.réseau!.rechercherMembres({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherProfilSelonActivité({
    f,
    nRésultatsDésirés,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatVide>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = profil.rechercherProfilSelonActivité();
    return await this.client.réseau!.rechercherMembres({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherProfilSelonCourriel({
    courriel,
    f,
    nRésultatsDésirés,
  }: {
    courriel: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = profil.rechercherProfilSelonCourriel(courriel);
    return await this.client.réseau!.rechercherMembres({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherProjetSelonId({
    idProjet,
    f,
    nRésultatsDésirés,
  }: {
    idProjet: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = utils.rechercherSelonId(idProjet);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherProjetSelonNom({
    nomProjet,
    f,
    nRésultatsDésirés,
  }: {
    nomProjet: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonNom(nomProjet);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherProjetSelonDescr({
    descrProjet,
    f,
    nRésultatsDésirés,
  }: {
    descrProjet: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonDescr(descrProjet);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherProjetSelonIdVariable({
    idVariable,
    f,
    nRésultatsDésirés,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonIdVariable(idVariable);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }
  async rechercherProjetSelonNomVariable({
    nomVariable,
    f,
    nRésultatsDésirés,
  }: {
    nomVariable: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonNomVariable(nomVariable);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherProjetSelonVariable({
    texte,
    f,
    nRésultatsDésirés,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonVariable(texte);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherProjetSelonIdMotClef({
    idMotClef,
    f,
    nRésultatsDésirés,
  }: {
    idMotClef: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonIdMotClef(idMotClef);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherProjetSelonNomMotClef({
    nomMotClef,
    f,
    nRésultatsDésirés,
  }: {
    nomMotClef: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonNomMotClef(nomMotClef);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherProjetSelonMotClef({
    texte,
    f,
    nRésultatsDésirés,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonMotClef(texte);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherProjetSelonIdBd({
    idBd,
    f,
    nRésultatsDésirés,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonIdBd(idBd);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherProjetSelonBd({
    texte,
    f,
    nRésultatsDésirés,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<
        infoRésultatRecherche<
          infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
        >
      >[]
    >;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonBd(texte);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  async rechercherProjetSelonTexte({
    texte,
    f,
    nRésultatsDésirés,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
          >
      >[]
    >;
    nRésultatsDésirés: number;
  }): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonTexte(texte);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }
}
