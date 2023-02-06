import * as bd from "@/recherche/bd.js";
import * as motClef from "@/recherche/motClef.js";
import * as profil from "@/recherche/profil.js";
import * as projet from "@/recherche/projet.js";
import * as variable from "@/recherche/variable.js";
import * as nuée from "@/recherche/nuée.js";
import * as utils from "@/recherche/utils.js";

import type ClientConstellation from "@/client.js";
import type { schémaRetourFonctionRechercheParN } from "@/utils/types.js";
import type {
  schémaFonctionSuivi,
  résultatRecherche,
  infoRésultatRecherche,
  infoRésultatTexte,
  infoRésultatVide,
} from "@/utils/index.js";
import { cacheRechercheParNRésultats } from "@/décorateursCache.js";

export class Recherche {
  client: ClientConstellation;

  constructor({ client }: { client: ClientConstellation }) {
    this.client = client;
  }

  @cacheRechercheParNRésultats
  async rechercherVariables({
    f,
    nRésultatsDésirés,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    return await this.client.réseau!.rechercherVariables({
      f,
      nRésultatsDésirés,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherVariableSelonId({
    idVariable,
    f,
    nRésultatsDésirés,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = utils.rechercherSelonId(idVariable);
    return await this.client.réseau!.rechercherVariables({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherVariableSelonNom({
    nomVariable,
    f,
    nRésultatsDésirés,
  }: {
    nomVariable: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = variable.rechercherVariableSelonNom(nomVariable);
    return await this.client.réseau!.rechercherVariables({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherVariableSelonDescr({
    descrVariable,
    f,
    nRésultatsDésirés,
  }: {
    descrVariable: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = variable.rechercherVariableSelonDescr(descrVariable);
    return await this.client.réseau!.rechercherVariables({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherVariableSelonTexte({
    texte,
    f,
    nRésultatsDésirés,
  }: {
    texte: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = variable.rechercherVariableSelonTexte(texte);
    return await this.client.réseau!.rechercherVariables({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherMotsClefs({
    f,
    nRésultatsDésirés,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    return await this.client.réseau!.rechercherMotsClefs({
      f,
      nRésultatsDésirés,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherMotClefSelonId({
    idMotClef,
    f,
    nRésultatsDésirés,
  }: {
    idMotClef: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = utils.rechercherSelonId(idMotClef);
    return await this.client.réseau!.rechercherMotsClefs({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherMotClefSelonNom({
    nomMotClef,
    f,
    nRésultatsDésirés,
  }: {
    nomMotClef: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = motClef.rechercherMotClefSelonNom(nomMotClef);
    return await this.client.réseau!.rechercherMotsClefs({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherMotClefSelonTexte({
    texte,
    f,
    nRésultatsDésirés,
  }: {
    texte: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = motClef.rechercherMotClefSelonTexte(texte);
    return await this.client.réseau!.rechercherMotsClefs({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherBds({
    f,
    nRésultatsDésirés,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    return await this.client.réseau!.rechercherBds({ f, nRésultatsDésirés });
  }

  @cacheRechercheParNRésultats
  async rechercherBdSelonId({
    idBd,
    f,
    nRésultatsDésirés,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = utils.rechercherSelonId(idBd);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherBdSelonNom({
    nomBd,
    f,
    nRésultatsDésirés,
  }: {
    nomBd: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdSelonNom(nomBd);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherBdSelonDescr({
    descrBd,
    f,
    nRésultatsDésirés,
  }: {
    descrBd: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdSelonDescr(descrBd);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
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
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdSelonIdMotClef(idMotClef);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
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
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdSelonIdVariable(idVariable);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
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
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdSelonNomMotClef(nomMotClef);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
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
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdSelonNomVariable(nomVariable);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
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
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdSelonMotClef(texte);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
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
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdSelonVariable(texte);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
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
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = bd.rechercherBdSelonTexte(texte);
    return await this.client.réseau!.rechercherBds({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherProjets({
    f,
    nRésultatsDésirés,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherProfilSelonId({
    idCompte,
    f,
    nRésultatsDésirés,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = utils.rechercherSelonId(idCompte);
    return await this.client.réseau!.rechercherMembres({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherProfilSelonNom({
    nom,
    f,
    nRésultatsDésirés,
  }: {
    nom: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = profil.rechercherProfilSelonNom(nom);
    return await this.client.réseau!.rechercherMembres({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherProfilSelonImage({
    image,
    f,
    nRésultatsDésirés,
  }: {
    image: Uint8Array;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatVide>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = profil.rechercherProfilSelonImage(image);
    return await this.client.réseau!.rechercherMembres({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherProfilSelonActivité({
    f,
    nRésultatsDésirés,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatVide>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = profil.rechercherProfilSelonActivité();
    return await this.client.réseau!.rechercherMembres({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherProfilSelonCourriel({
    courriel,
    f,
    nRésultatsDésirés,
  }: {
    courriel: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = profil.rechercherProfilSelonCourriel(courriel);
    return await this.client.réseau!.rechercherMembres({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherProjetSelonId({
    idProjet,
    f,
    nRésultatsDésirés,
  }: {
    idProjet: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = utils.rechercherSelonId(idProjet);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherProjetSelonNom({
    nomProjet,
    f,
    nRésultatsDésirés,
  }: {
    nomProjet: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetSelonNom(nomProjet);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherProjetSelonDescr({
    descrProjet,
    f,
    nRésultatsDésirés,
  }: {
    descrProjet: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetSelonDescr(descrProjet);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
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
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetSelonIdVariable(idVariable);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
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
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetSelonNomVariable(nomVariable);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
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
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetSelonVariable(texte);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
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
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetSelonIdMotClef(idMotClef);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
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
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetSelonNomMotClef(nomMotClef);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
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
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetSelonMotClef(texte);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
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
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetSelonIdBd(idBd);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
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
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetSelonBd(texte);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
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
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = projet.rechercherProjetSelonTexte(texte);
    return await this.client.réseau!.rechercherProjets({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }


  @cacheRechercheParNRésultats
  async rechercherNuées({
    f,
    nRésultatsDésirés,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    return await this.client.réseau!.rechercherNuées({ f, nRésultatsDésirés });
  }

  @cacheRechercheParNRésultats
  async rechercherNuéeSelonId({
    idNuée,
    f,
    nRésultatsDésirés,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = utils.rechercherSelonId(idNuée);
    return await this.client.réseau!.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherNuéeSelonNom({
    nomNuée,
    f,
    nRésultatsDésirés,
  }: {
    nomNuée: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéeSelonNom(nomNuée);
    return await this.client.réseau!.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherNuéeSelonDescr({
    descrNuée,
    f,
    nRésultatsDésirés,
  }: {
    descrNuée: string;
    f: schémaFonctionSuivi<résultatRecherche<infoRésultatTexte>[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéeSelonDescr(descrNuée);
    return await this.client.réseau!.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherNuéeSelonIdMotClef({
    idMotClef,
    f,
    nRésultatsDésirés,
  }: {
    idMotClef: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéeSelonIdMotClef(idMotClef);
    return await this.client.réseau!.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherNuéeSelonIdVariable({
    idVariable,
    f,
    nRésultatsDésirés,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéeSelonIdVariable(idVariable);
    return await this.client.réseau!.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherNuéeSelonNomMotClef({
    nomMotClef,
    f,
    nRésultatsDésirés,
  }: {
    nomMotClef: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéeSelonNomMotClef(nomMotClef);
    return await this.client.réseau!.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherNuéeSelonNomVariable({
    nomVariable,
    f,
    nRésultatsDésirés,
  }: {
    nomVariable: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéeSelonNomVariable(nomVariable);
    return await this.client.réseau!.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherNuéeSelonMotClef({
    texte,
    f,
    nRésultatsDésirés,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéeSelonMotClef(texte);
    return await this.client.réseau!.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherNuéeSelonVariable({
    texte,
    f,
    nRésultatsDésirés,
  }: {
    texte: string;
    f: schémaFonctionSuivi<
      résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
    >;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéeSelonVariable(texte);
    return await this.client.réseau!.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherNuéeSelonTexte({
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
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fObjectif = nuée.rechercherNuéeSelonTexte(texte);
    return await this.client.réseau!.rechercherNuées({
      f,
      nRésultatsDésirés,
      fObjectif,
    });
  }
}
