import * as bd from "./bd";
import * as motClef from "./motClef";
import * as profil from "./profil";
import * as projet from "./projet";
import * as variable from "./variable";
import * as utils from "./utils";

import ClientConstellation from "@/client";
import { réponseSuivreRecherche } from "@/reseau";
import { schémaFonctionSuivi, résultatRecherche, infoRésultatRecherche, infoRésultatTexte, infoRésultatVide } from "@/utils";

export default class Recherche {
  client: ClientConstellation;

  constructor(client: ClientConstellation) {
    this.client = client;
  }

  async rechercherVariableSelonId(
    idVariable: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = utils.rechercherSelonId(idVariable);
    return await this.client.réseau!.rechercherVariables(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherVariableSelonNom(
    nomBd: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = variable.rechercherVariableSelonNom(nomBd);
    return await this.client.réseau!.rechercherVariables(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherVariableSelonTexte(
    texte: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = variable.rechercherVariableSelonTexte(texte);
    return await this.client.réseau!.rechercherVariables(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherMotClefSelonId(
    idMotClef: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = utils.rechercherSelonId(idMotClef);
    return await this.client.réseau!.rechercherVariables(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherMotClefSelonNom(
    nomMotClef: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = motClef.rechercherMotClefSelonNom(nomMotClef);
    return await this.client.réseau!.rechercherMotsClefs(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherMotClefSelonTexte(
    texte: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = motClef.rechercherMotClefSelonTexte(texte);
    return await this.client.réseau!.rechercherMotsClefs(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonId(
    idBd: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = utils.rechercherSelonId(idBd);
    return await this.client.réseau!.rechercherVariables(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonDescr(
    descrBd: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = bd.rechercherBdSelonDescr(descrBd);
    return await this.client.réseau!.rechercherBds(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonIdMotClef(
    idMotClef: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = bd.rechercherBdSelonIdMotClef(idMotClef);
    return await this.client.réseau!.rechercherBds(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonIdVariable(
    idVariable: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = bd.rechercherBdSelonIdVariable(idVariable);
    return await this.client.réseau!.rechercherBds(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonNomMotClef(
    nomMotClef: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = bd.rechercherBdSelonNomMotClef(nomMotClef);
    return await this.client.réseau!.rechercherBds(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonNomVariable(
    nomVariable: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = bd.rechercherBdSelonNomVariable(nomVariable);
    return await this.client.réseau!.rechercherBds(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonMotClef(
    texte: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = bd.rechercherBdSelonMotClef(texte);
    return await this.client.réseau!.rechercherBds(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonVariable(
    texte: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = bd.rechercherBdSelonVariable(texte);
    return await this.client.réseau!.rechercherBds(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonTexte(
    texte: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = bd.rechercherBdSelonTexte(texte);
    return await this.client.réseau!.rechercherBds(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProfilSelonNom(
    nom: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = profil.rechercherProfilSelonNom(nom);
    return await this.client.réseau!.rechercherMembres(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProfilSelonImage(
    image: Uint8Array,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatVide>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = profil.rechercherProfilSelonImage(image);
    return await this.client.réseau!.rechercherMembres(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProfilSelonActivité(
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatVide>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = profil.rechercherProfilSelonActivité();
    return await this.client.réseau!.rechercherMembres(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProfilSelonCourriel(
    courriel: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = profil.rechercherProfilSelonCourriel(courriel);
    return await this.client.réseau!.rechercherMembres(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonId(
    idProjet: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = utils.rechercherSelonId(idProjet);
    return await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonNom(
    nomProjet: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonNom(nomProjet);
    return await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonDescr(
    descrProjet: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonDescr(descrProjet);
    return await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonIdVariable(
    idVariable: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonIdVariable(idVariable);
    return await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }
  async rechercherProjetSelonNomVariable(
    nomVariable: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonNomVariable(nomVariable);
    return await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonVariable(
    texte: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonVariable(texte);
    return await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonIdMotClef(
    idMotClef: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonIdMotClef(idMotClef);
    return await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonNomMotClef(
    nomMotClef: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonNomMotClef(nomMotClef);
    return await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonMotClef(
    texte: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonMotClef(texte);
    return await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonIdBd(
    idBd: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonIdBd(idBd);
    return await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }


  async rechercherProjetSelonTexte(
    texte: string,
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>>>[]>,
    nRésultatsDésirés: number,
  ): Promise<réponseSuivreRecherche> {
    const fObjectif = projet.rechercherProjetSelonTexte(texte);
    return await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

}
