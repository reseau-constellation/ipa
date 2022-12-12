import ClientConstellation from "@/client.js";

import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  schémaStatut,
  TYPES_STATUT,
  schémaFonctionSuiviRecherche,
  schémaRetourFonctionRecherche,
  infoAuteur,
  faisRien,
  uneFois,
} from "@/utils/index.js";
import ContrôleurConstellation from "@/accès/cntrlConstellation.js";

import FeedStore from "orbit-db-feedstore";
import KeyValueStore from "orbit-db-kvstore";
import { cacheSuivi } from "@/décorateursCache";
import { objRôles } from "@/accès/types.js";
import { différenceBds, différenceBDTableauManquant, différenceBDTableauSupplémentaire, différenceTableauxBds, infoTableau, infoTableauAvecId } from "@/bds";
import { v4 as uuidv4 } from "uuid";
import { erreurValidation, élémentDonnées, règleVariable, règleColonne } from "@/valid";
import { élémentDeMembre, élémentDeMembreAvecValid } from "@/reseau";
import { différenceTableaux, InfoCol, InfoColAvecCatégorie, élémentBdListeDonnées } from "@/tableaux";

export type statutMembreNuée = {
  idCompte: string;
  statut: "exclus" | "accepté";
};

export type typeÉlémentsBdNuée = string | schémaStatut;

export default class Nuée {
  client: ClientConstellation;
  idBd: string;

  constructor({ client, id }: { client: ClientConstellation; id: string }) {
    this.client = client;
    this.idBd = id;
  }

  async créerNuée({
    nuéeParent,
    autorisation,
  }: {
    nuéeParent?: string;
    autorisation?: string;
  }): Promise<string> {
    const idBdNuée = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès: {
        address: undefined,
        premierMod: this.client.bdCompte!.id,
      },
    });

    await this.ajouterÀMesNuées({ id: idBdNuée });

    const { bd: bdNuée, fOublier: fOublierNuée } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdNuée>
    >({
      id: idBdNuée,
    });

    const accès = bdNuée.access as ContrôleurConstellation;
    const optionsAccès = { address: accès.address };

    await bdNuée.set("type", "nuée");

    await bdNuée.set(
      "autorisation",
      autorisation || (await this.générerGestionnaireAutorisations({}))
    );

    const idBdNoms = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdNuée.set("noms", idBdNoms);

    const idBdDescr = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdNuée.set("descriptions", idBdDescr);

    const idBdTableaux = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdNuée.set("tableaux", idBdTableaux);

    const idBdMotsClefs = await this.client.créerBdIndépendante({
      type: "feed",
      optionsAccès,
    });
    await bdNuée.set("motsClefs", idBdMotsClefs);

    await bdNuée.set("statut", { statut: TYPES_STATUT.ACTIVE });
    if (nuéeParent) {
      await bdNuée.set("parent", nuéeParent);
    }

    fOublierNuée();
    return idBdNuée;
  }

  async ajouterÀMesNuées({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<FeedStore<string>>({
      id: this.idBd,
    });
    await bd.add(id);
    await fOublier();
  }

  async copierNuée({
    id,
    ajouterÀMesNuées = true,
  }: {
    id: string;
    ajouterÀMesNuées?: boolean;
  }): Promise<string> {}

  async suivreNuées({
    f,
    idBdNuéesCompte,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idBdNuéesCompte?: string;
  }): Promise<schémaFonctionOublier> {
    idBdNuéesCompte = idBdNuéesCompte || this.idBd;
    return await this.client.suivreBdListe({ id: idBdNuéesCompte, f });
  }

  async ajouterNomsNuée({
    id,
    noms,
  }: {
    id: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: id });
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: id,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdNoms)
      throw new Error(`Permission de modification refusée pour Nuée ${id}.`);

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });

    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
    await fOublier();
  }

  async effacerNomNuée({
    id,
    langue,
  }: {
    id: string;
    langue: string;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: id });
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: id,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdNoms)
      throw new Error(`Permission de modification refusée pour Nuée ${id}.`);

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    await bdNoms.del(langue);
    await fOublier();
  }

  async suivreNomsNuée({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({ id, clef: "noms", f });
  }

  async ajouterDescriptionsNuée({
    id,
    descriptions,
  }: {
    id: string;
    descriptions: { [langue: string]: string };
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: id });
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: id,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdDescr)
      throw new Error(`Permission de modification refusée pour BD ${id}.`);

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdDescr });
    for (const lng in descriptions) {
      await bdDescr.set(lng, descriptions[lng]);
    }
    await fOublier();
  }

  async effacerDescriptionNuée({
    id,
    langue,
  }: {
    id: string;
    langue: string;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: id });
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: id,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdDescr)
      throw new Error(`Permission de modification refusée pour BD ${id}.`);

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdDescr });
    await bdDescr.del(langue);
    await fOublier();
  }

  @cacheSuivi
  async suivreDescriptionsNuée({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({ id, clef: "descriptions", f });
  }

  async ajouterMotsClefsNuée({
    idsMotsClefs,
    idNuée,
  }: {
    idsMotsClefs: string | string[];
    idNuée: string;
  }): Promise<void> {
    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idNuée });
    const idBdMotsClefs = await this.client.obtIdBd({
      nom: "motsClefs",
      racine: idNuée,
      type: "feed",
      optionsAccès,
    });
    if (!idBdMotsClefs) {
      throw new Error(`Permission de modification refusée pour BD ${idNuée}.`);
    }

    const { bd: bdMotsClefs, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >({ id: idBdMotsClefs });
    for (const id of idsMotsClefs) {
      const motsClefsExistants = ClientConstellation.obtÉlémentsDeBdListe({
        bd: bdMotsClefs,
      });
      if (!motsClefsExistants.includes(id)) await bdMotsClefs.add(id);
    }
    await fOublier();
  }

  async effacerMotClefNuée({
    idMotClef,
    idNuée,
  }: {
    idMotClef: string;
    idNuée: string;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idNuée });
    const idBdMotsClefs = await this.client.obtIdBd({
      nom: "motsClefs",
      racine: idNuée,
      type: "feed",
      optionsAccès,
    });
    if (!idBdMotsClefs) {
      throw new Error(`Permission de modification refusée pour BD ${idNuée}.`);
    }

    const { bd: bdMotsClefs, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >({ id: idBdMotsClefs });

    await this.client.effacerÉlémentDeBdListe({
      bd: bdMotsClefs,
      élément: idMotClef,
    });

    await fOublier();
  }

  @cacheSuivi
  async suivreMotsClefsNuée({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdListeDeClef({ id, clef: "motsClefs", f });
  }

  async inviterAuteur({
    idNuée,
    idBdCompteAuteur,
    rôle,
  }: {
    idNuée: string;
    idBdCompteAuteur: string;
    rôle: keyof objRôles;
  }): Promise<void> {
    await this.client.donnerAccès({
      idBd: idNuée,
      identité: idBdCompteAuteur,
      rôle,
    });
  }

  async générerGestionnaireAutorisations({
    philosophie = "IJPC",
  }: {
    philosophie?: "IJPC" | "CJPI";
  }): Promise<string> {
    const idBdAutorisation = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès: {
        address: undefined,
        premierMod: this.client.bdCompte!.id,
      },
    });

    const { bd, fOublier } = await this.client.ouvrirBd<KeyValueStore<string>>({
      id: idBdAutorisation,
    });

    await bd.set("philosophie", philosophie);

    const accès = bd.access as ContrôleurConstellation;
    const optionsAccès = { address: accès.address };
    const idBdMembres = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bd.set("membres", idBdMembres);

    fOublier();
    return idBdAutorisation;
  }

  async changerPhisolophieAutorisation({
    idAutorisation,
    philosophie,
  }: {
    idAutorisation: string;
    philosophie: "IJPC" | "CJPI";
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<KeyValueStore<string>>({
      id: idAutorisation,
    });
    await bd.set("philosophie", philosophie);
    fOublier();
  }

  async suivrePhilosophieAutorisation({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<"IJPC" | "CJPI">;
  }): Promise<schémaFonctionOublier> {
    const fFinale = (bd: KeyValueStore<string>) => {
      const philosophie = bd.get("philosophie");
      if (["IJPC", "CJPI"].includes(philosophie)) {
        f(philosophie as "IJPC" | "CJPI");
      }
    };
    return await this.client.suivreBd<KeyValueStore<string>>({
      id: idNuée,
      f: fFinale,
    });
  }

  async accepterMembre({
    idAutorisation,
    idCompte,
  }: {
    idAutorisation: string;
    idCompte: string;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({
      idBd: idAutorisation,
    });
    const idBdMembres = await this.client.obtIdBd({
      nom: "membres",
      racine: idAutorisation,
      type: "feed",
      optionsAccès,
    });
    if (!idBdMembres) {
      throw new Error(
        `Permission de modification refusée pour groupe d'autorisation ${idAutorisation}.`
      );
    }

    const { bd, fOublier } = await this.client.ouvrirBd<KeyValueStore<string>>({
      id: idBdMembres,
    });
    await bd.set(idCompte, "accepté");
    fOublier();
  }

  async exclureMembre({
    idAutorisation,
    idCompte,
  }: {
    idAutorisation: string;
    idCompte: string;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({
      idBd: idAutorisation,
    });
    const idBdMembres = await this.client.obtIdBd({
      nom: "membres",
      racine: idAutorisation,
      type: "feed",
      optionsAccès,
    });
    if (!idBdMembres) {
      throw new Error(
        `Permission de modification refusée pour groupe d'autorisation ${idAutorisation}.`
      );
    }

    const { bd, fOublier } = await this.client.ouvrirBd<KeyValueStore<string>>({
      id: idBdMembres,
    });
    await bd.set(idCompte, "exclus");
    fOublier();
  }

  async suivreGestionnaireAutorisations({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = (bd: KeyValueStore<string>) => {
      const idAutorisation = bd.get("autorisation");
      f(idAutorisation);
    };
    return await this.client.suivreBd({ id: idNuée, f: fFinale });
  }

  async changerGestionnaireAutorisations({
    idNuée,
    idAutorisation,
  }: {
    idNuée: string;
    idAutorisation: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<KeyValueStore<string>>({
      id: idNuée,
    });

    await bd.set("autorisation", idAutorisation);

    fOublier();
  }

  async suivreAutorisationsMembresDeGestionnaire({
    idAutorisation,
    f,
  }: {
    idAutorisation: string;
    f: schémaFonctionSuivi<statutMembreNuée[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = (dicMembres: { [clef: string]: "exclus" | "accepté" }) => {
      const membres = Object.entries(dicMembres).map(([idCompte, statut]) => {
        return {
          idCompte,
          statut,
        };
      });
      f(membres);
    };
    return await this.client.suivreBdDicDeClef({
      id: idAutorisation,
      clef: "membres",
      f: fFinale,
    });
  }

  async suivreAutorisationsMembresDeNuée({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<statutMembreNuée[]>;
  }): Promise<schémaFonctionOublier> {
    const fRacine = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (nouvelIdBdCible?: string) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreGestionnaireAutorisations({
        idNuée,
        f: fSuivreRacine,
      });
    };
    const fSuivre = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<statutMembreNuée[]>;
    }) => {
      return await this.suivreAutorisationsMembresDeGestionnaire({
        idAutorisation: id,
        f: fSuivreBd,
      });
    };
    return await this.client.suivreBdDeFonction({
      fRacine,
      f,
      fSuivre,
    });
  }

  async ajouterTableauNuée({
    idNuée,
    clefTableau,
  }: {
    idNuée: string;
    clefTableau?: string;
  }): Promise<string> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idNuée });
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: idNuée,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdTableaux) {
      throw new Error(
        `Permission de modification refusée pour Nuée ${idNuée}.`
      );
    }

    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<infoTableau>
    >({ id: idBdTableaux });

    clefTableau = clefTableau || uuidv4();
    const idTableau = await this.client.tableaux!.créerTableau({
      idBd: idNuée,
    });
    await bdTableaux.set(idTableau, {
      position: Object.keys(bdTableaux.all).length,
      clef: clefTableau,
    });

    await fOublier();
    return idTableau;
  }

  async effacerTableauNuée({
    idNuée,
    idTableau,
  }: {
    idNuée: string;
    idTableau: string;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idNuée });
    // D'abord effacer l'entrée dans notre liste de tableaux
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: idNuée,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdTableaux) {
      throw new Error(
        `Permission de modification refusée pour Nuée ${idNuée}.`
      );
    }

    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdTableaux });
    await bdTableaux.del(idTableau);
    await fOublier();

    // Enfin, effacer les données et le tableau lui-même
    await this.client.tableaux!.effacerTableau({ idTableau });
  }

  async suivreTableauxNuée({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<infoTableauAvecId[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = (infos: { [clef: string]: infoTableau }) => {
      const tableaux: infoTableauAvecId[] = Object.entries(infos).map(
        ([id, info]) => {
          return {
            id,
            ...info,
          };
        }
      );
      f(tableaux);
    };
    return await this.client.suivreBdDicDeClef({
      id: idNuée,
      clef: "tableaux",
      f: fFinale,
    });
  }

  async ajouterNomsTableauNuée({ idTableau, noms }: { idTableau: string, noms: {[key: string]: string} }): Promise<void> {
    return await this.client.tableaux!.ajouterNomsTableau({ idTableau, noms })
  }
  async effacerNomsTableauNuée({ idTableau, langue }: { idTableau: string, langue: string }): Promise<void> {
    return await this.client.tableaux!.effacerNomTableau({ idTableau, langue })
  }
  async suivreNomsTableauNuée({
    idNuée,
    clefTableau,
    f,
  }: {
    idNuée: string;
    clefTableau: string;
    f: schémaFonctionSuivi<{ [langue: string]: string }>;
  }): Promise<schémaFonctionOublier> {}

  ajouterColonneTableauNuée() {}
  effacerColonneTableauNuée() {}
  suivreColonnesTableauNuée() {}

  ajouterRègleTableauNuée() {}
  effacerRègleTableauNuée() {}
  suivreRèglesColonneTableauNuée() {}

  async suivreDifférencesAvecTableau({
    idNuée,
    clefTableau,
    idTableau,
    f,
    stricte = true,
  }: {
    idNuée: string;
    clefTableau: string;
    idTableau: string;
    f: schémaFonctionSuivi<différenceTableaux[]>;
    stricte?: boolean;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (différences: différenceTableaux[]) => {
      const différencesFinales = différences.filter((d) => stricte || d.sévère);
      await f(différencesFinales);
    };
    const fRacine = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (nouvelIdBdCible?: string) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {

      // On peut traiter la nuée comme une BD
      return await this.client.bds.suivreIdTableauParClef({
        idBd: idNuée,
        clef: clefTableau,
        f: fSuivreRacine
      })
    };

    const fSuivre = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<différenceTableaux[]>;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.tableaux.suivreDifférencesAvecTableau({
        idTableau,
        idTableauRéf: id,
        f: fSuivreBd,
      });
    };
    return await this.client.suivreBdDeFonction({
      fRacine,
      f: fFinale,
      fSuivre,
    });
  }

  @cacheSuivi
  async suivreDifférencesAvecBd({
    idNuée,
    idBd,
    f
  }: {
    idNuée: string;
    idBd: string;
    f: schémaFonctionSuivi<différenceBds[]>
  }): Promise<schémaFonctionOublier> {

    const info: {
      tableauxBd?: infoTableauAvecId[];
      tableauxNuée?: infoTableauAvecId[];
    } = {
    };
    
    const fFinale = async () => {
      const différences: différenceBds[] = [];

      if (info.tableauxNuée && info.tableauxBd) {
        for (const tableauNuée of info.tableauxNuée) {
          const tableau = info.tableauxNuée.find(
            (t) => t.clef === tableauNuée.clef
          );
          if (!tableau) {
            const dif: différenceBDTableauManquant = {
              type: "tableauManquant",
              sévère: true,
              clefManquante: tableauNuée.clef,
            };
            différences.push(dif);
          }
        }
        for (const tableau of info.tableauxBd) {
          const tableauLié = info.tableauxNuée.find(
            (t) => t.clef === tableau.clef
          );
          if (!tableauLié) {
            const dif: différenceBDTableauSupplémentaire = {
              type: "tableauSupplémentaire",
              sévère: false,
              clefExtra: tableau.clef,
            };
            différences.push(dif);
          }
        }
      }

      await f(différences);
    };

    const fOublierTableauxBd = await this.client.bds.suivreTableauxBd({
      id: idBd,
      f: (tableaux) => {
        info.tableauxBd = tableaux;
        fFinale();
      },
    });

    const fOublierTableauxNuée = await this.suivreTableauxNuée({
      idNuée,
      f: (tableaux) => {
        info.tableauxNuée = tableaux;
        fFinale();
      },
    });

    return async () => {
      await fOublierTableauxBd();
      await fOublierTableauxNuée();
    };
  }

  @cacheSuivi
  async suivreNuéesSpécialiséesLiées({
    idNuée,
  }: {
    idNuée: string;
  }): Promise<schémaFonctionSuivi<Set<string>>> {}

  @cacheSuivi
  async suivreNuéesParents({
    idNuée,
  }: {
    idNuée: string;
  }): Promise<schémaFonctionSuivi<string[]>> {}

  @cacheSuivi
  async suivreBdsCorrespondantes({
    idNuée,
    f,
    vérifierAutorisation = true,
    nRésultatsDésirés = 100,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string[]>;
    vérifierAutorisation?: boolean;
    nRésultatsDésirés?: number;
  }): Promise<schémaRetourFonctionRecherche> {
    if (vérifierAutorisation) {
      const info: {
        philoAutorisation?: "CJPI" | "IJPC";
        membres?: statutMembreNuée[];
        bds?: { idBd: string; auteurs: string[] }[];
      } = {};

      const fFinale = async (): Promise<void> => {
        const { philoAutorisation, membres, bds } = info;
        if (!(philoAutorisation && membres && bds)) await f(undefined); // Attendre que tout soit prêt

        const filtrerAutorisation = (
          bds_: { idBd: string; auteurs: string[] }[]
        ): string[] => {
          if (philoAutorisation === "CJPI") {
            const invités = membres
              .filter((m) => m.statut === "accepté")
              .map((m) => m.idCompte);
            return bds_
              .filter((x) => x.auteurs.some((c) => invités.includes(c)))
              .map((x) => x.idBd);
          } else if (philoAutorisation === "IJPC") {
            const exclus = membres
              .filter((m) => m.statut === "exclus")
              .map((m) => m.idCompte);
            return bds_
              .filter((x) => !x.auteurs.some((c) => exclus.includes(c)))
              .map((x) => x.idBd);
          } else {
            throw new Error(philoAutorisation);
          }
        };
        await f(filtrerAutorisation(bds));
      };

      const fOublierSuivrePhilo = await this.suivrePhilosophieAutorisation({
        idNuée,
        f: async (philo) => {
          info.philoAutorisation = philo;
          await fFinale();
        },
      });

      const fOublierSuivreMembres = await this.suivreAutorisationsMembresDeNuée(
        {
          idNuée,
          f: async (membres) => {
            info.membres = membres;
            await fFinale();
          },
        }
      );

      const fSuivreBds = async (bds: { idBd: string; auteurs: string[] }[]) => {
        info.bds = bds;
        await fFinale();
      };

      const fListe = async (
        fSuivreRacine: (éléments: string[]) => Promise<void>
      ): Promise<schémaRetourFonctionRecherche> => {
        return await this.client.réseau!.suivreBdsDeNuée({
          idNuée,
          f: fSuivreRacine,
          nRésultatsDésirés,
        });
      };

      const fBranche = async (
        idBd: string,
        fSuivreBranche: schémaFonctionSuivi<{
          idBd: string;
          auteurs: string[];
        }>,
      ): Promise<schémaFonctionOublier> => {
        const fFinaleSuivreBranche = async (
          auteurs: infoAuteur[]
        ): Promise<void> => {
          fSuivreBranche({
            idBd,
            auteurs: auteurs
              .filter((x) => {
                x.accepté;
              })
              .map((x) => x.idBdCompte),
          });
        };

        return await this.client.réseau.suivreAuteursBd({
          idBd,
          f: fFinaleSuivreBranche,
        });
      };

      const { fOublier: fOublierBds, fChangerProfondeur } =
        await this.client.suivreBdsDeFonctionListe({
          fListe,
          f: fSuivreBds,
          fBranche,
        });

      const fOublier = async () => {
        await Promise.all(
          [fOublierBds, fOublierSuivreMembres, fOublierSuivrePhilo].map((f) =>
            f()
          )
        );
      };

      return {
        fOublier,
        fChangerProfondeur,
      };
    } else {
      return await this.client.réseau.suivreBdsDeNuée({
        idNuée,
        f,
        nRésultatsDésirés,
      });
    }
  }

  @cacheSuivi
  async suivreDonnéesTableauNuée<T extends élémentBdListeDonnées>({
    idNuée,
    clefTableau,
    f,
    ignorerErreursFormatBd = true,
    ignorerErreursFormatTableau = false,
    ignorerErreursDonnéesTableau = true,
    licensesPermises = undefined,
  }: {
    idNuée: string;
    clefTableau: string;
    f: schémaFonctionSuivi<élémentDeMembreAvecValid<T>[]>;
    ignorerErreursFormatBd?: boolean;
    ignorerErreursFormatTableau?: boolean;
    ignorerErreursDonnéesTableau?: boolean;
    licensesPermises?: string[];
  }): Promise<schémaRetourFonctionRecherche> {
    const fFinale = async (
      donnéesTableaux: élémentDeMembreAvecValid<T>[][]
    ) => {
      const éléments = donnéesTableaux.flat();
      await f(éléments);
    };

    const fListe = async (
      fSuivreRacine: (bds: string[]) => Promise<void>
    ): Promise<schémaRetourFonctionRecherche> => {
      return await this.suivreBdsCorrespondantes({
        idNuée,
        f: fSuivreRacine,
      });
    };

    const fSuivreBdsConformes = async (
      fSuivreRacine: (bds: string[]) => Promise<void>
    ): Promise<schémaRetourFonctionRecherche> => {
      const fCondition = async (
        idBd: string,
        fSuivreCondition: schémaFonctionSuivi<boolean>
      ): Promise<schémaFonctionOublier> => {
        const conformes: { licence: boolean; formatBd: boolean } = {
          licence: false,
          formatBd: false,
        };
        const fsOublier: schémaFonctionOublier[] = [];

        const fFinaleBdConforme = async () => {
          const conforme = Object.values(conformes).every((x) => x);
          await fSuivreCondition(conforme);
        };

        if (licensesPermises) {
          const fOublierLicence = await this.client.bds.suivreLicence({
            id: idBd,
            f: async (licence) => {
              conformes.licence = licensesPermises.includes(licence);
              await fFinaleBdConforme();
            },
          });
          fsOublier.push(fOublierLicence);
        } else {
          conformes.licence = true;
        }

        if (ignorerErreursFormatBd) {
          conformes.formatBd = true;
        } else {
          const fOublierErreursFormatBd =
            await this.suivreDifférencesAvecBd({
              idBd,
              idNuée,
              f: async (différences) => {
                conformes.formatBd = !différences.length;
                await fFinaleBdConforme();
              },
            });
          fsOublier.push(fOublierErreursFormatBd);
        }
        fFinaleBdConforme();

        return async () => {
          await Promise.all(fsOublier.map((f) => f()));
        };
      };
      return await this.client.suivreBdsSelonCondition({
        fListe,
        fCondition,
        f: fSuivreRacine,
      });
    };

    const fBranche = async (
      idBd: string,
      fSuivreBranche: schémaFonctionSuivi<élémentDeMembreAvecValid<T>[]>
    ): Promise<schémaFonctionOublier> => {
      const info: {
        auteurs?: infoAuteur[];
        données?: élémentDonnées<T>[];
        erreursÉléments?: erreurValidation[];
        erreursTableau?: différenceTableaux[];
      } = {};

      const fFinaleBranche = async () => {
        const { données, erreursÉléments, auteurs } = info;
        if (données && erreursÉléments && auteurs && auteurs.length) {
          const auteur = auteurs.find((a) => a.accepté)?.idBdCompte;
          if (!auteur) return;

          const donnéesMembres: élémentDeMembreAvecValid<T>[] = données
            .map((d) => {
              return {
                idBdCompte: auteur,
                élément: d,
                valid: erreursÉléments.filter(
                  (e) => e.empreinte == d.empreinte
                ),
              };
            })
            .filter((d) => ignorerErreursDonnéesTableau || !d.valid.length);
          await fSuivreBranche(donnéesMembres);
        }
      };

      const fSuivreTableau = async ({
        id,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: schémaFonctionSuivi<{
          données?: élémentDonnées<T>[];
          erreurs?: erreurValidation<règleVariable>[];
        }>;
      }): Promise<schémaFonctionOublier> => {
        const infoTableau: {
          données?: élémentDonnées<T>[];
          erreurs?: erreurValidation<règleVariable>[];
        } = {};
        const fsOublier: schémaFonctionOublier[] = [];

        const fFinaleTableau = async () => {
          const { données, erreurs } = infoTableau;
          if (données && erreurs) {
            await fSuivreBd({ données, erreurs });
          }
        };
        const fOublierDonnnées = await this.client.tableaux.suivreDonnées<T>({
          idTableau: id,
          f: async (données) => {
            infoTableau.données = données;
            await fFinaleTableau();
          },
        });
        fsOublier.push(fOublierDonnnées);

        const fOublierErreurs = await this.client.tableaux.suivreValidDonnées({
          idTableau: id,
          f: async (erreurs) => {
            infoTableau.erreurs = erreurs;
            await fFinaleTableau();
          },
        });
        fsOublier.push(fOublierErreurs);

        return async () => {
          await Promise.all(fsOublier.map((f) => f()));
        };
      };

      const fOublierSuivreTableau = await this.client.suivreBdDeFonction<{
        données?: élémentDonnées<T>[];
        erreurs?: erreurValidation<règleVariable>[];
      }>({
        fRacine: async ({ fSuivreRacine }) => {
          return await this.client.suivreBdSelonCondition({
            fRacine: async (
              fSuivreRacineListe: (id: string) => Promise<void>
            ) => {
              return await this.client.bds.suivreIdTableauParClef({
                idBd,
                clef: clefTableau,
                f: async (idTableau) => await fSuivreRacineListe(idTableau),
              });
            },
            fCondition: async (
              idTableau: string,
              fSuivreCondition: schémaFonctionSuivi<boolean>
            ) => {
              if (ignorerErreursFormatTableau) {
                await fSuivreCondition(true);
                return faisRien;
              } else {
                return await this.suivreDifférencesAvecTableau({
                  idNuée,
                  clefTableau,
                  idTableau,
                  f: async (différences) =>
                    await fSuivreCondition(!différences.length),
                  stricte: false,
                });
              }
            },
            f: fSuivreRacine,
          });
        },
        f: async (x) => {
          info.données = x.données;
          info.erreursÉléments = x.erreurs;
          await fFinaleBranche();
        },
        fSuivre: fSuivreTableau,
      });

      const fOublierAuteursBd = await this.client.réseau.suivreAuteursBd({
        idBd,
        f: async (auteurs) => {
          info.auteurs = auteurs;
          await fFinaleBranche();
        },
      });

      return async () => {
        await Promise.all([fOublierSuivreTableau, fOublierAuteursBd]);
      };
    };

    return await this.client.suivreBdsDeFonctionListe({
      fListe: fSuivreBdsConformes,
      f: fFinale,
      fBranche,
    });
  }

  async générerDeBd({ idBd }: { idBd: string }): Promise<string> {
    const idNuée = await this.créerNuée({});

    // Noms
    const noms = await uneFois(async (fSuivi: schémaFonctionSuivi<{[key: string]: string}>): Promise<schémaFonctionOublier> => {
      return await this.client.bds.suivreNomsBd({ id: idBd, f: fSuivi})
    })
    await this.ajouterNomsNuée({
      id: idNuée,
      noms
    })
    
    // Descriptions
    const descriptions = await uneFois(async (fSuivi: schémaFonctionSuivi<{[key: string]: string}>): Promise<schémaFonctionOublier> => {
      return await this.client.bds.suivreDescrBd({ id: idBd, f: fSuivi})
    })
    await this.ajouterDescriptionsNuée({
      id: idNuée,
      descriptions
    })
    
    // Mots-clefs
    const idsMotsClefs = await uneFois(async (fSuivi: schémaFonctionSuivi<string[]>): Promise<schémaFonctionOublier> => {
      return await this.client.bds.suivreMotsClefsBd({ id: idBd, f: fSuivi})
    })
    await this.ajouterMotsClefsNuée({
      idNuée,
      idsMotsClefs
    })

    // Tableaux
    const tableaux = await uneFois(async (fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>): Promise<schémaFonctionOublier> => {
      return await this.client.bds.suivreTableauxBd({ id: idBd, f: fSuivi})
    })

    for (const tableau of tableaux) {
      const idTableau = tableau.id;
      const idTableauNuée = await this.ajouterTableauNuée({
        idNuée,
        clefTableau: tableau.clef
      })

      // Colonnes
      const colonnes = await uneFois(async (fSuivi: schémaFonctionSuivi<InfoCol[]>): Promise<schémaFonctionOublier> => {
        return await this.client.tableaux.suivreColonnes({ idTableau, f: fSuivi, catégories: false});
      })
      for (const col of colonnes) {
        await this.client.tableaux.ajouterColonneTableau({
          idTableau: idTableauNuée,
          idVariable: col.variable,
          idColonne: col.id
        });

        // Indexes
        await this.client.tableaux.changerColIndex({
          idTableau: idTableauNuée,
          idColonne: col.id,
          val: col.index
        })

        // Règles
        const règles = await uneFois(async (fSuivi: schémaFonctionSuivi<règleColonne<règleVariable>[]>): Promise<schémaFonctionOublier> => {
          return await this.client.tableaux.suivreRègles({ idTableau, f: fSuivi });
        })
        for (const règle of règles) {
          if (règle.source === "tableau") {
            await this.client.tableaux.ajouterRègleTableau({
              idTableau: idTableauNuée,
              idColonne: col.id,
              règle: règle.règle.règle
            })
          }
        }
      }
    }

    return idNuée;
  }
}
