import FeedStore from "orbit-db-feedstore";
import KeyValueStore from "orbit-db-kvstore";

import { WorkBook, utils, BookType, writeFile, write as writeXLSX } from "xlsx";
import toBuffer from "it-to-buffer";
import path from "path";

import obtStockageLocal from "@/stockageLocal";
import { InfoColAvecCatégorie, typeÉlémentsBdTableaux } from "@/tableaux";
import { infoAuteur, schémaStatut, TYPES_STATUT } from "@/utils/types";

import {
  règleColonne,
  élémentDonnées,
  erreurValidation,
} from "@/valid";
import { élémentBdListeDonnées } from "@/tableaux"
import ClientConstellation, { infoAccès } from "@/client";
import {
  traduire,
  zipper,
  schémaFonctionSuivi,
  schémaFonctionOublier,
  uneFois,
  faisRien,
} from "@/utils";
import { objRôles } from "@/accès/types";
import ContrôleurConstellation from "@/accès/cntrlConstellation";

export interface schémaSpécificationBd {
  licence: string;
  motsClefs?: string[];
  tableaux: {
    cols: {
      idVariable: string;
      idColonne: string;
      index?: boolean;
    }[];
    idUnique?: string;
  }[];
}

export interface infoScore {
  accès?: number;
  couverture?: number;
  valide?: number;
  total?: number;
}

export interface donnéesBdExportées {
  doc: WorkBook;
  fichiersSFIP: Set<{ cid: string; ext: string }>;
  nomFichier: string;
}

export type typeÉlémentsBdBD = string | schémaStatut;

export default class BDs {
  client: ClientConstellation;
  idBd: string;

  constructor(client: ClientConstellation, id: string) {
    this.client = client;
    this.idBd = id;
  }

  async suivreBds(
    f: schémaFonctionSuivi<string[]>,
    idBdCompte?: string
  ): Promise<schémaFonctionOublier> {
    idBdCompte = idBdCompte || this.idBd;
    return await this.client.suivreBdListe(idBdCompte, f);
  }

  async créerBd(licence: string, ajouter = true): Promise<string> {
    const idBdBd = await this.client.créerBdIndépendante("kvstore", {
      adresseBd: undefined,
      premierMod: this.client.bdCompte!.id,
    });

    const { bd: bdBD, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >(idBdBd);
    await bdBD.set("licence", licence);

    const accès = bdBD.access as unknown as ContrôleurConstellation;
    const optionsAccès = { adresseBd: accès.adresseBd };

    const idBdNoms = await this.client.créerBdIndépendante(
      "kvstore",
      optionsAccès
    );
    await bdBD.set("noms", idBdNoms);

    const idBdDescr = await this.client.créerBdIndépendante(
      "kvstore",
      optionsAccès
    );
    await bdBD.set("descriptions", idBdDescr);

    const idBdTableaux = await this.client.créerBdIndépendante(
      "feed",
      optionsAccès
    );
    await bdBD.set("tableaux", idBdTableaux);

    const idBdMotsClefs = await this.client.créerBdIndépendante(
      "feed",
      optionsAccès
    );
    await bdBD.set("motsClefs", idBdMotsClefs);

    await bdBD.set("statut", { statut: TYPES_STATUT.ACTIVE });

    if (ajouter) {
      const { bd: bdRacine, fOublier: fOublierRacine } =
        await this.client.ouvrirBd<FeedStore<string>>(this.idBd);
      await bdRacine.add(idBdBd);
      fOublierRacine();
    }

    fOublier();

    return idBdBd;
  }

  async ajouterÀMesBds(id: string): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<FeedStore<string>>(
      this.idBd
    );
    await bd.add(id);
    fOublier();
  }

  async enleverDeMesBds(id: string): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<FeedStore<string>>(
      this.idBd
    );
    await this.client.effacerÉlémentDeBdListe(bd, id);
    fOublier();
  }

  async copierBd(
    id: string,
    ajouterÀMesBds = true,
    copierDonnées = true
  ): Promise<string> {
    const { bd: bdBase, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >(id);
    const licence = bdBase.get("licence") as string;
    const idNouvelleBd = await this.créerBd(licence, ajouterÀMesBds);
    const { bd: nouvelleBd, fOublier: fOublierNouvelle } =
      await this.client.ouvrirBd<KeyValueStore<typeÉlémentsBdBD>>(idNouvelleBd);

    const idBdNoms = bdBase.get("noms") as string;
    const { bd: bdNoms, fOublier: fOublierBdNoms } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdNoms);
    const noms = ClientConstellation.obtObjetdeBdDic(bdNoms) as {
      [key: string]: string;
    };
    await this.ajouterNomsBd(idNouvelleBd, noms);

    const idBdDescr = bdBase.get("descriptions") as string;
    const { bd: bdDescr, fOublier: fOublierBdDescr } =
      await this.client.ouvrirBd<KeyValueStore<string>>(idBdDescr);
    const descriptions = ClientConstellation.obtObjetdeBdDic(bdDescr) as {
      [key: string]: string;
    };
    await this.ajouterDescriptionsBd(idNouvelleBd, descriptions);

    const idBdMotsClefs = bdBase.get("motsClefs") as string;
    const { bd: bdMotsClefs, fOublier: fOublierBdMotsClefs } =
      await this.client.ouvrirBd<FeedStore<string>>(idBdMotsClefs);
    const motsClefs = ClientConstellation.obtÉlémentsDeBdListe(
      bdMotsClefs
    ) as string[];
    await this.ajouterMotsClefsBd(idNouvelleBd, motsClefs);

    const idBdTableaux = bdBase.get("tableaux") as string;
    const idNouvelleBdTableaux = nouvelleBd.get("tableaux") as string;

    const { bd: nouvelleBdTableaux, fOublier: fOublierNouvelleTableaux } =
      await this.client.ouvrirBd<FeedStore<typeÉlémentsBdTableaux>>(
        idNouvelleBdTableaux
      );
    const { bd: bdTableaux, fOublier: fOublierBdTableaux } =
      await this.client.ouvrirBd<FeedStore<typeÉlémentsBdTableaux>>(
        idBdTableaux
      );
    const tableaux = ClientConstellation.obtÉlémentsDeBdListe(bdTableaux);

    await Promise.all(
      tableaux.map(async (idT: string) => {
        const idNouveauTableau: string =
          await this.client.tableaux!.copierTableau(idT, copierDonnées);
        await nouvelleBdTableaux.add(idNouveauTableau);
      })
    );

    const statut = bdBase.get("statut") || {statut: TYPES_STATUT.ACTIVE};
    await nouvelleBd.set("statut", statut);

    fOublier();
    fOublierNouvelleTableaux();
    fOublierBdNoms();
    fOublierBdDescr();
    fOublierNouvelle();
    fOublierBdTableaux();
    fOublierBdMotsClefs();
    return idNouvelleBd;
  }

  async créerBdDeSchéma(
    schéma: schémaSpécificationBd,
    ajouter = true
  ): Promise<string> {
    const { tableaux, motsClefs, licence } = schéma;

    // On n'ajoutera la BD que lorsqu'elle sera prête
    const idBd = await this.créerBd(licence, false);

    if (motsClefs) {
      await this.ajouterMotsClefsBd(idBd, motsClefs);
    }

    for (const tb of tableaux) {
      const { cols, idUnique } = tb;
      const idTableau = await this.ajouterTableauBd(idBd);
      if (idUnique) {
        await this.client.tableaux!.spécifierIdUniqueTableau(
          idTableau,
          idUnique
        );
      }

      for (const c of cols) {
        const { idColonne, idVariable, index } = c;
        await this.client.tableaux!.ajouterColonneTableau(
          idTableau,
          idVariable,
          idColonne
        );
        if (index) {
          await this.client.tableaux!.changerColIndex(
            idTableau,
            idColonne,
            true
          );
        }
      }
    }

    // Maintenant on peut l'annoncer !
    if (ajouter) await this.ajouterÀMesBds(idBd);

    return idBd;
  }

  async rechercherBdsParMotsClefs(
    motsClefs: string[],
    f: schémaFonctionSuivi<string[]>,
    idBdCompte?: string
  ): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBds(fSuivreRacine, idBdCompte);
    };

    const fCondition = async (
      id: string,
      fSuivreCondition: (état: boolean) => void
    ): Promise<schémaFonctionOublier> => {
      const fFinaleSuivreCondition = (motsClefsBd: string[]) => {
        const état = motsClefs.every((m) => motsClefsBd.includes(m));
        fSuivreCondition(état);
      };
      return await this.suivreMotsClefsBd(id, fFinaleSuivreCondition);
    };
    return await this.client.suivreBdsSelonCondition(fListe, fCondition, f);
  }

  async combinerBds(idBdBase: string, idBd2: string): Promise<void> {
    const obtTableauxEtIdsUniques = async (
      idBd: string
    ): Promise<{ idTableau: string; idUnique: string }[]> => {
      const tableaux = await uneFois(
        async (
          fSuivi: schémaFonctionSuivi<string[]>
        ): Promise<schémaFonctionOublier> => {
          return await this.suivreTableauxBd(idBd, fSuivi);
        }
      );
      const idsUniques = [];
      for (const idTableau of tableaux) {
        const idUnique = await uneFois(
          async (
            fSuivi: schémaFonctionSuivi<string | undefined>
          ): Promise<schémaFonctionOublier> => {
            return await this.client.tableaux!.suivreIdUnique(
              idTableau,
              fSuivi
            );
          }
        );
        if (idUnique) idsUniques.push({ idTableau, idUnique });
      }
      return idsUniques;
    };

    const tableauxBase = await obtTableauxEtIdsUniques(idBdBase);
    const tableauxBd2 = await obtTableauxEtIdsUniques(idBd2);

    for (const info of tableauxBd2) {
      const { idTableau, idUnique } = info;
      const idTableauBaseCorresp = tableauxBase.find(
        (t) => t.idUnique === idUnique
      )?.idTableau;

      if (idTableauBaseCorresp) {
        await this.client.tableaux!.combinerDonnées(
          idTableauBaseCorresp,
          idTableau
        );
      }
    }
  }

  async suivreTableauParIdUnique(
    idBd: string,
    idUniqueTableau: string,
    f: schémaFonctionSuivi<string | undefined>
  ): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: (ids: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd(idBd, fSuivreRacine);
    };

    const fCondition = async (
      id: string,
      fSuivreCondition: (état: boolean) => void
    ): Promise<schémaFonctionOublier> => {
      return await this.client.tableaux!.suivreIdUnique(id, (id) =>
        fSuivreCondition(id === idUniqueTableau)
      );
    };

    return await this.client.suivreBdsSelonCondition(
      fListe,
      fCondition,
      (ids) => f(ids.length ? ids[0] : undefined)
    );
  }

  async suivreBdUnique(
    schéma: schémaSpécificationBd,
    motClefUnique: string,
    f: schémaFonctionSuivi<string>
  ): Promise<schémaFonctionOublier> {
    const clefStockageLocal = "bdUnique: " + motClefUnique;

    const déjàCombinées = new Set();

    const fFinale = async (bds: string[]): Promise<void> => {
      let idBd: string;
      const idBdLocale = (await obtStockageLocal()).getItem(clefStockageLocal);

      switch (bds.length) {
        case 0: {
          if (idBdLocale) {
            idBd = idBdLocale;
          } else {
            idBd = await this.créerBdDeSchéma(schéma);
            (await obtStockageLocal()).setItem(clefStockageLocal, idBd);
          }
          break;
        }
        case 1: {
          idBd = bds[0];
          (await obtStockageLocal()).setItem(clefStockageLocal, idBd);
          if (idBdLocale && idBd !== idBdLocale) {
            await this.combinerBds(idBd, idBdLocale);
          }
          break;
        }
        default: {
          if (idBdLocale) bds = [...new Set([...bds, idBdLocale])];
          idBd = bds.sort()[0];
          (await obtStockageLocal()).setItem(clefStockageLocal, idBd);

          for (const bd of bds.slice(1)) {
            if (déjàCombinées.has(bd)) continue;

            déjàCombinées.add(bd);
            await this.combinerBds(idBd, bd);
          }

          break;
        }
      }
      f(idBd);
    };

    const fOublier = await this.rechercherBdsParMotsClefs(
      [motClefUnique],
      fFinale
    );

    return fOublier;
  }

  async suivreTableauUniqueDeBdUnique(
    schémaBd: schémaSpécificationBd,
    motClefUnique: string,
    idTableauUnique: string,
    f: schémaFonctionSuivi<string | undefined>
  ): Promise<schémaFonctionOublier> {
    const fRacine = async (
      fSuivreRacine: (nouvelIdBdCible: string) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBdUnique(schémaBd, motClefUnique, fSuivreRacine);
    };

    const fSuivre = async (
      idBd: string,
      fSuivreBd: schémaFonctionSuivi<string | undefined>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauParIdUnique(
        idBd,
        idTableauUnique,
        fSuivreBd
      );
    };
    return await this.client.suivreBdDeFonction<string>(
      fRacine,
      f,
      fSuivre
    );
  }

  async ajouterNomsBd(
    id: string,
    noms: { [key: string]: string }
  ): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès(id);
    const idBdNoms = await this.client.obtIdBd(
      "noms",
      id,
      "kvstore",
      optionsAccès
    );
    if (!idBdNoms) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdNoms);

    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
    fOublier();
  }

  async sauvegarderNomBd(
    id: string,
    langue: string,
    nom: string
  ): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès(id);
    const idBdNoms = await this.client.obtIdBd(
      "noms",
      id,
      "kvstore",
      optionsAccès
    );
    if (!idBdNoms) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdNoms);
    await bdNoms.set(langue, nom);
    fOublier();
  }

  async effacerNomBd(id: string, langue: string): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès(id);
    const idBdNoms = await this.client.obtIdBd(
      "noms",
      id,
      "kvstore",
      optionsAccès
    );
    if (!idBdNoms) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdNoms);
    await bdNoms.del(langue);
    fOublier();
  }

  async ajouterDescriptionsBd(
    id: string,
    descriptions: { [key: string]: string }
  ): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès(id);
    const idBdDescr = await this.client.obtIdBd(
      "descriptions",
      id,
      "kvstore",
      optionsAccès
    );
    if (!idBdDescr) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdDescr);
    for (const lng in descriptions) {
      await bdDescr.set(lng, descriptions[lng]);
    }
    fOublier();
  }

  async sauvegarderDescrBd(
    id: string,
    langue: string,
    nom: string
  ): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès(id);
    const idBdDescr = await this.client.obtIdBd(
      "descriptions",
      id,
      "kvstore",
      optionsAccès
    );
    if (!idBdDescr) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdDescr);
    await bdDescr.set(langue, nom);
    fOublier();
  }

  async effacerDescrBd(id: string, langue: string): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès(id);
    const idBdDescr = await this.client.obtIdBd(
      "descriptions",
      id,
      "kvstore",
      optionsAccès
    );
    if (!idBdDescr) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdDescr);
    await bdDescr.del(langue);
    fOublier();
  }

  async changerLicenceBd(idBd: string, licence: string): Promise<void> {
    const { bd: bdBd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >(idBd);
    await bdBd.set("licence", licence);
    fOublier();
  }

  async ajouterMotsClefsBd(
    idBd: string,
    idsMotsClefs: string | string[]
  ): Promise<void> {
    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];
    const optionsAccès = await this.client.obtOpsAccès(idBd);
    const idBdMotsClefs = await this.client.obtIdBd(
      "motsClefs",
      idBd,
      "feed",
      optionsAccès
    );
    if (!idBdMotsClefs) {
      throw `Permission de modification refusée pour BD ${idBd}.`;
    }

    const { bd: bdMotsClefs, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >(idBdMotsClefs);
    await Promise.all(
      idsMotsClefs.map(async (id: string) => {
        const motsClefsExistants =
          ClientConstellation.obtÉlémentsDeBdListe(bdMotsClefs);
        if (!motsClefsExistants.includes(id)) await bdMotsClefs.add(id);
      })
    );
    fOublier();
  }

  async effacerMotClefBd(idBd: string, idMotClef: string): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès(idBd);
    const idBdMotsClefs = await this.client.obtIdBd(
      "motsClefs",
      idBd,
      "feed",
      optionsAccès
    );
    if (!idBdMotsClefs) {
      throw `Permission de modification refusée pour BD ${idBd}.`;
    }

    const { bd: bdMotsClefs, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >(idBdMotsClefs);

    await this.client.effacerÉlémentDeBdListe(bdMotsClefs, idMotClef);

    fOublier();
  }

  async ajouterTableauBd(id: string): Promise<string> {
    const optionsAccès = await this.client.obtOpsAccès(id);
    const idBdTableaux = await this.client.obtIdBd(
      "tableaux",
      id,
      "feed",
      optionsAccès
    );
    if (!idBdTableaux) {
      throw `Permission de modification refusée pour BD ${id}.`;
    }

    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >(idBdTableaux);
    const idTableau = await this.client.tableaux!.créerTableau();
    await bdTableaux.add(idTableau);

    fOublier();
    return idTableau;
  }

  async effacerTableauBd(id: string, idTableau: string): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès(id);
    // D'abord effacer l'entrée dans notre liste de tableaux
    const idBdTableaux = await this.client.obtIdBd(
      "tableaux",
      id,
      "feed",
      optionsAccès
    );
    if (!idBdTableaux) {
      throw `Permission de modification refusée pour BD ${id}.`;
    }

    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >(idBdTableaux);
    await this.client.effacerÉlémentDeBdListe(bdTableaux, idTableau);
    fOublier();

    // Enfin, effacer les données et le tableau lui-même
    await this.client.tableaux!.effacerTableau(idTableau);
  }

  async marquerObsolète(id: string, idNouvelle?: string): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >(id);
    bd.set("statut", { statut: TYPES_STATUT.OBSOLÈTE, idNouvelle });
    fOublier();
  }

  async marquerActive(id: string): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >(id);
    bd.set("statut", { statut: TYPES_STATUT.ACTIVE });
    fOublier();
  }

  async marquerBêta(id: string): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >(id);
    bd.set("statut", { statut: TYPES_STATUT.BÊTA });
    fOublier();
  }

  async marquerInterne(id: string): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >(id);
    bd.set("statut", { statut: TYPES_STATUT.INTERNE });
    fOublier();
  }

  async suivreLicence(
    id: string,
    f: schémaFonctionSuivi<string>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd(id, async (bd) => {
      const licence = (bd as KeyValueStore<typeÉlémentsBdBD>).get(
        "licence"
      ) as string;
      f(licence);
    });
  }

  async inviterAuteur(
    idBd: string,
    idBdCompteAuteur: string,
    rôle: keyof objRôles
  ): Promise<void> {
    await this.client.donnerAccès(idBd, idBdCompteAuteur, rôle);
  }

  async suivreAuteurs(
    id: string,
    f: schémaFonctionSuivi<infoAuteur[]>
  ): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: (éléments: infoAccès[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.suivreAccèsBd(id, fSuivreRacine);
    };
    const fBranche = async (
      idBdCompte: string,
      fSuivreBranche: schémaFonctionSuivi<infoAuteur[]>,
      branche: infoAccès
    ) => {
      const fFinaleSuivreBranche = (bdsMembre?: string[]) => {
        bdsMembre = bdsMembre || [];
        return fSuivreBranche([
          {
            idBdCompte: branche.idBdCompte,
            rôle: branche.rôle,
            accepté: bdsMembre.includes(id),
          },
        ]);
      };
      return await this.client.réseau!.suivreBdsMembre(
        idBdCompte,
        fFinaleSuivreBranche,
        false
      );
    };
    const fIdBdDeBranche = (x: infoAccès) => x.idBdCompte;
    const fCode = (x: infoAccès) => x.idBdCompte;

    const fOublier = this.client.suivreBdsDeFonctionListe(
      fListe,
      f,
      fBranche,
      fIdBdDeBranche,
      undefined,
      fCode
    );
    return fOublier;
  }

  async suivreNomsBd(
    id: string,
    f: schémaFonctionSuivi<{ [key: string]: string }>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef(id, "noms", f);
  }

  async suivreDescrBd(
    id: string,
    f: schémaFonctionSuivi<{ [key: string]: string }>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef(id, "descriptions", f);
  }

  async suivreMotsClefsBd(
    id: string,
    f: schémaFonctionSuivi<string[]>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdListeDeClef(id, "motsClefs", f);
  }

  async suivreTableauxBd(
    id: string,
    f: schémaFonctionSuivi<string[]>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdListeDeClef(id, "tableaux", f);
  }

  async suivreScoreAccèsBd(
    id: string,
    f: schémaFonctionSuivi<number | undefined>
  ): Promise<schémaFonctionOublier> {
    // À faire
    f(Number.parseInt(id));
    return faisRien;
  }

  async suivreScoreCouvertureBd(
    id: string,
    f: schémaFonctionSuivi<number | undefined>
  ): Promise<schémaFonctionOublier> {
    type scoreTableau = { numérateur: number; dénominateur: number };

    const fFinale = (branches: scoreTableau[]) => {
      const numérateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.numérateur,
        0
      );
      const dénominateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.dénominateur,
        0
      );
      f(dénominateur === 0 ? undefined : numérateur / dénominateur);
    };

    const fBranche = async (
      idTableau: string,
      f: schémaFonctionSuivi<scoreTableau>
    ): Promise<schémaFonctionOublier> => {
      const info: { cols?: InfoColAvecCatégorie[]; règles?: règleColonne[] } =
        {};

      const fFinaleBranche = () => {
        const { cols, règles } = info;

        if (cols !== undefined && règles !== undefined) {
          const colsÉligibles = cols.filter((c) =>
            ["numérique", "catégorique"].includes(c.catégorie)
          );

          const dénominateur = colsÉligibles.length;
          const numérateur = colsÉligibles.filter((c) =>
            règles.some(
              (r) =>
                r.règle.règle.typeRègle !== "catégorie" && r.colonne === c.id
            )
          ).length;
          f({ numérateur, dénominateur });
        }
      };

      const fOublierCols = await this.client.tableaux!.suivreColonnes(
        idTableau,
        (cols) => {
          info.cols = cols;
          fFinaleBranche();
        }
      );

      const fOublierRègles = await this.client.tableaux!.suivreRègles(
        idTableau,
        (règles) => {
          info.règles = règles;
          fFinaleBranche();
        }
      );

      return () => {
        fOublierCols();
        fOublierRègles();
      };
    };

    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd(id, fSuivreRacine);
    };

    return await this.client.suivreBdsDeFonctionListe(
      fListe,
      fFinale,
      fBranche
    );
  }

  async suivreScoreValideBd(
    id: string,
    f: schémaFonctionSuivi<number | undefined>
  ): Promise<schémaFonctionOublier> {
    type scoreTableau = { numérateur: number; dénominateur: number };

    const fFinale = (branches: scoreTableau[]) => {
      const numérateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.numérateur,
        0
      );
      const dénominateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.dénominateur,
        0
      );
      f(dénominateur === 0 ? undefined : numérateur / dénominateur);
    };

    const fBranche = async (
      idTableau: string,
      f: schémaFonctionSuivi<scoreTableau>
    ): Promise<schémaFonctionOublier> => {
      const info: {
        données?: élémentDonnées<élémentBdListeDonnées>[];
        cols?: InfoColAvecCatégorie[];
        erreurs?: erreurValidation[];
      } = {};

      const fFinaleBranche = () => {
        const { données, erreurs, cols } = info;
        if (
          données !== undefined &&
          erreurs !== undefined &&
          cols !== undefined
        ) {
          const colsÉligibles = cols.filter((c) =>
            ["numérique", "catégorique"].includes(c.catégorie)
          );

          const déjàVus: { empreinte: string; idColonne: string }[] = [];
          const nCellulesÉrronnées = erreurs
            .map((e) => {
              return {
                empreinte: e.empreinte,
                idColonne: e.erreur.règle.colonne,
              };
            })
            .filter((x) => {
              const déjàVu = déjàVus.find(
                (y) =>
                  y.empreinte === x.empreinte && y.idColonne === x.idColonne
              );
              if (déjàVu) {
                return false;
              } else {
                déjàVus.push(x);
                return true;
              }
            }).length;

          const dénominateur = données
            .map(
              (d) =>
                colsÉligibles.filter((c) => d.données[c.id] !== undefined)
                  .length
            )
            .reduce((a, b) => a + b, 0);

          const numérateur = dénominateur - nCellulesÉrronnées;

          f({ numérateur, dénominateur });
        }
      };

      const fOublierDonnées = await this.client.tableaux!.suivreDonnées(
        idTableau,
        (données) => {
          info.données = données;
          fFinaleBranche();
        }
      );

      const fOublierErreurs = await this.client.tableaux!.suivreValidDonnées(
        idTableau,
        (erreurs) => {
          info.erreurs = erreurs;
          fFinaleBranche();
        }
      );

      const fOublierColonnes = await this.client.tableaux!.suivreColonnes(
        idTableau,
        (cols) => {
          info.cols = cols;
          fFinaleBranche();
        }
      );

      return () => {
        fOublierDonnées();
        fOublierErreurs();
        fOublierColonnes();
      };
    };

    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd(id, fSuivreRacine);
    };

    return await this.client.suivreBdsDeFonctionListe(
      fListe,
      fFinale,
      fBranche
    );
  }

  async suivreScoreBd(
    id: string,
    f: schémaFonctionSuivi<infoScore>
  ): Promise<schémaFonctionOublier> {
    const info: { accès?: number; couverture?: number; valide?: number } = {};

    const fFinale = () => {
      const { accès, couverture, valide } = info;
      const score: infoScore = {
        total: ((accès || 0) + (couverture || 0) + (valide || 0)) / 3,
        accès,
        couverture,
        valide,
      };
      f(score);
    };

    const oublierAccès = await this.suivreScoreAccèsBd(id, (accès) => {
      info.accès = accès;
      fFinale();
    });
    const oublierCouverture = await this.suivreScoreCouvertureBd(
      id,
      (couverture) => {
        info.couverture = couverture;
        fFinale();
      }
    );
    const oublierValide = await this.suivreScoreValideBd(id, (valide) => {
      info.valide = valide;
      fFinale();
    });
    return () => {
      oublierAccès();
      oublierCouverture();
      oublierValide();
    };
  }

  async suivreVariablesBd(
    id: string,
    f: schémaFonctionSuivi<string[]>
  ): Promise<schémaFonctionOublier> {
    const fFinale = (variables?: string[]) => {
      return f(variables || []);
    };
    const fBranche = async (
      id: string,
      f: schémaFonctionSuivi<string[]>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.tableaux!.suivreVariables(id, f);
    };
    const fSuivreTableaux = async (
      id: string,
      f: schémaFonctionSuivi<string[]>
    ) => {
      return await this.client.suivreBdsDeBdListe(id, f, fBranche);
    };

    return await this.client.suivreBdDeClef(
      id,
      "tableaux",
      fFinale,
      fSuivreTableaux
    );
  }

  async exporterDonnées(
    id: string,
    langues?: string[],
    nomFichier?: string
  ): Promise<donnéesBdExportées> {
    const doc = utils.book_new();
    const fichiersSFIP: Set<{ cid: string; ext: string }> = new Set();

    const idsTableaux = await uneFois((f: schémaFonctionSuivi<string[]>) =>
      this.suivreTableauxBd(id, f)
    );

    for (const idTableau of idsTableaux) {
      const { fichiersSFIP: fichiersSFIPTableau } =
        await this.client.tableaux!.exporterDonnées(idTableau, langues, doc);
      fichiersSFIPTableau.forEach((f: { cid: string; ext: string }) =>
        fichiersSFIP.add(f)
      );
    }

    if (!nomFichier) {
      const nomsBd = await uneFois(
        (f: schémaFonctionSuivi<{ [key: string]: string }>) =>
          this.suivreNomsBd(id, f)
      );
      const idCourt = id.split("/").pop()!;

      nomFichier = langues ? traduire(nomsBd, langues) || idCourt : idCourt;
    }

    return { doc, fichiersSFIP, nomFichier };
  }

  async exporterDocumentDonnées(
    données: donnéesBdExportées,
    formatDoc: BookType | "xls",
    dir = "",
    inclureFichierSFIP = true
  ): Promise<void> {
    const { doc, fichiersSFIP, nomFichier } = données;

    const conversionsTypes: { [key: string]: BookType } = {
      xls: "biff8",
    };
    const bookType: BookType = conversionsTypes[formatDoc] || formatDoc;

    if (inclureFichierSFIP) {
      const fichierDoc = {
        octets: writeXLSX(doc, { bookType, type: "buffer" }),
        nom: `${nomFichier}.${formatDoc}`,
      };
      const fichiersDeSFIP = [];
      for (const fichier of fichiersSFIP) {
        fichiersDeSFIP.push({
          nom: `${fichier.cid}.${fichier.ext}`,
          octets: await toBuffer(this.client.obtItérableAsyncSFIP(fichier.cid)),
        });
      }
      await zipper([fichierDoc], fichiersDeSFIP, path.join(dir, nomFichier));
    } else {
      writeFile(doc, path.join(dir, `${nomFichier}.${formatDoc}`), {
        bookType,
      });
    }
  }

  async effacerBd(id: string): Promise<void> {
    // D'abord effacer l'entrée dans notre liste de BDs
    const { bd: bdRacine, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >(this.idBd);
    await this.client.effacerÉlémentDeBdListe(bdRacine, id);
    fOublier();

    // Et puis maintenant aussi effacer les données et la BD elle-même
    const optionsAccès = await this.client.obtOpsAccès(id);
    for (const clef in ["noms", "descriptions", "motsClefs"]) {
      const idBd = await this.client.obtIdBd(clef, id, undefined, optionsAccès);
      if (idBd) await this.client.effacerBd(idBd);
    }
    const idBdTableaux = await this.client.obtIdBd(
      "tableaux",
      id,
      "feed",
      optionsAccès
    );
    if (idBdTableaux) {
      const { bd: bdTableaux, fOublier: fOublierTableaux } =
        await this.client.ouvrirBd<FeedStore<string>>(idBdTableaux);
      const tableaux: string[] = bdTableaux
        .iterator({ limit: -1 })
        .collect()
        .map((e: LogEntry<string>) => e.payload.value);
      for (const t of tableaux) {
        await this.client.tableaux!.effacerTableau(t);
      }
      fOublierTableaux();
    }

    await this.enleverDeMesBds(id);
    await this.client.effacerBd(id);
  }
}
