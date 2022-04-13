import * as bd from "./bd";
import * as motClef from "./motClef";
import * as profil from "./profil";
import * as projet from "./projet";
import * as variable from "./variable";
import * as utils from "./utils";

import ClientConstellation from "@/client";
import { schémaFonctionSuivi, résultatObjectifRecherche, infoRésultatRecherche, infoRésultatTexte, infoRésultatVide } from "@/utils";

export default class Recherche {
  client: ClientConstellation;

  constructor(client: ClientConstellation) {
    this.client = client;
  }

  async rechercherVariableSelonId(
    idVariable: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = utils.rechercherSelonId(idVariable);
    await this.client.réseau!.rechercherVariables(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherVariableSelonNom(
    nomBd: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = variable.rechercherVariableSelonNom(nomBd);
    await this.client.réseau!.rechercherVariables(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherVariableSelonTexte(
    texte: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = variable.rechercherVariableSelonTexte(texte);
    await this.client.réseau!.rechercherVariables(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherMotClefSelonId(
    idMotClef: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = utils.rechercherSelonId(idMotClef);
    await this.client.réseau!.rechercherVariables(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherMotClefSelonNom(
    nomMotClef: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = motClef.rechercherMotClefSelonNom(nomMotClef);
    await this.client.réseau!.rechercherMotsClefs(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherMotClefSelonTexte(
    texte: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = motClef.rechercherMotClefSelonTexte(texte);
    await this.client.réseau!.rechercherMotsClefs(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonId(
    idBd: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = utils.rechercherSelonId(idBd);
    await this.client.réseau!.rechercherVariables(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonDescr(
    descrBd: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = bd.rechercherBdSelonDescr(descrBd);
    await this.client.réseau!.rechercherBds(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonIdMotClef(
    idMotClef: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = bd.rechercherBdSelonIdMotClef(idMotClef);
    await this.client.réseau!.rechercherBds(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonIdVariable(
    idVariable: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = bd.rechercherBdSelonIdVariable(idVariable);
    await this.client.réseau!.rechercherBds(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonNomMotClef(
    nomMotClef: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = bd.rechercherBdSelonNomMotClef(nomMotClef);
    await this.client.réseau!.rechercherBds(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonNomVariable(
    nomVariable: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = bd.rechercherBdSelonNomVariable(nomVariable);
    await this.client.réseau!.rechercherBds(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonMotClef(
    texte: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = bd.rechercherBdSelonMotClef(texte);
    await this.client.réseau!.rechercherBds(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonVariable(
    texte: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = bd.rechercherBdSelonVariable(texte);
    await this.client.réseau!.rechercherBds(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherBdSelonTexte(
    texte: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = bd.rechercherBdSelonTexte(texte);
    await this.client.réseau!.rechercherBds(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProfilSelonNom(
    nom: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = profil.rechercherProfilSelonNom(nom);
    await this.client.réseau!.rechercherMembres(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProfilSelonImage(
    image: Uint8Array,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatVide>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = profil.rechercherProfilSelonImage(image);
    await this.client.réseau!.rechercherMembres(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProfilSelonActivité(
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatVide>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = profil.rechercherProfilSelonActivité();
    await this.client.réseau!.rechercherMembres(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProfilSelonCourriel(
    courriel: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = profil.rechercherProfilSelonCourriel(courriel);
    await this.client.réseau!.rechercherMembres(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonId(
    idProjet: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = utils.rechercherSelonId(idProjet);
    await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonNom(
    nomProjet: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = projet.rechercherProjetSelonNom(nomProjet);
    await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonDescr(
    descrProjet: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatTexte>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = projet.rechercherProjetSelonDescr(descrProjet);
    await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonIdVariable(
    idVariable: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = projet.rechercherProjetSelonIdVariable(idVariable);
    await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }
  async rechercherProjetSelonNomVariable(
    nomVariable: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = projet.rechercherProjetSelonNomVariable(nomVariable);
    await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonVariable(
    texte: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = projet.rechercherProjetSelonVariable(texte);
    await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonIdMotClef(
    idMotClef: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = projet.rechercherProjetSelonIdMotClef(idMotClef);
    await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonNomMotClef(
    nomMotClef: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = projet.rechercherProjetSelonNomMotClef(nomMotClef);
    await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonMotClef(
    texte: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = projet.rechercherProjetSelonMotClef(texte);
    await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

  async rechercherProjetSelonIdBd(
    idBd: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = projet.rechercherProjetSelonIdBd(idBd);
    await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }


  async rechercherProjetSelonTexte(
    texte: string,
    f: schémaFonctionSuivi<résultatObjectifRecherche<infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>>>[]>,
    nRésultatsDésirés: number,
  ) {
    const fObjectif = projet.rechercherProjetSelonTexte(texte);
    await this.client.réseau!.rechercherProjets(
      f,
      nRésultatsDésirés,
      fObjectif
    )
  }

}
