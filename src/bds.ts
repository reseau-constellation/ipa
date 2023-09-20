import type { ImportCandidate } from "ipfs-core-types/src/utils";

import { WorkBook, utils, BookType, writeFile, write as writeXLSX } from "xlsx";
import toBuffer from "it-to-buffer";
import path from "path";
import { isBrowser, isWebWorker } from "wherearewe";
import { v4 as uuidv4 } from "uuid";
import { suivreBdDeFonction } from "@constl/utils-ipa";

import type { InfoColAvecCatégorie } from "@/tableaux.js";
import {
  schémaStatut,
  schémaStructureBdMétadonnées,
  schémaStructureBdNoms,
  TYPES_STATUT,
  élémentsBd,
  schémaFonctionSuivi,
  schémaFonctionOublier,
} from "@/types.js";
import { cacheSuivi } from "@/décorateursCache.js";
import Semaphore from "@chriscdn/promise-semaphore";

import type { règleColonne, erreurValidation, règleExiste } from "@/valid.js";
import type {
  élémentBdListeDonnées,
  différenceTableaux,
  élémentDonnées,
} from "@/tableaux.js";
import ClientConstellation from "@/client.js";
import {
  traduire,
  zipper,
  uneFois,
  faisRien,
  ignorerNonDéfinis,
} from "@constl/utils-ipa";
import type { objRôles } from "@/accès/types.js";
import type { default as ContrôleurConstellation } from "@/accès/cntrlConstellation.js";
import { ComposanteClientListe } from "@/composanteClient.js";
import { JSONSchemaType } from "ajv";

export interface schémaSpécificationBd {
  licence: string;
  licenceContenu?: string;
  métadonnées?: string;
  motsClefs?: string[];
  nuées?: string[];
  statut?: schémaStatut;
  tableaux: {
    cols: {
      idVariable: string;
      idColonne: string;
      index?: boolean;
      optionnel?: boolean;
    }[];
    clef: string;
  }[];
}

export interface infoScore {
  accès?: number;
  couverture?: number;
  valide?: number;
  licence?: number;
  total: number;
}

export interface donnéesBdExportées {
  doc: WorkBook;
  fichiersSFIP: Set<{ cid: string; ext: string }>;
  nomFichier: string;
}

export type schémaCopiéDe = {
  id: string;
};

export type structureBdBd = {
  type: string;
  licence: string;
  licenceContenu?: string;
  image?: string;
  métadonnées?: string;
  noms: string;
  descriptions: string;
  tableaux: string;
  motsClefs: string;
  nuées: string;
  statut: schémaStatut;
  copiéDe: schémaCopiéDe;
};
const schémaStructureBdBd: JSONSchemaType<structureBdBd> = {
  type: "object",
  properties: {
    type: { type: "string" },
    métadonnées: { type: "string", nullable: true },
    licence: { type: "string" },
    licenceContenu: { type: "string", nullable: true },
    image: { type: "string", nullable: true },
    noms: { type: "string" },
    descriptions: { type: "string" },
    tableaux: { type: "string" },
    motsClefs: { type: "string" },
    nuées: { type: "string" },
    statut: {
      type: "object",
      properties: {
        statut: { type: "string" },
        idNouvelle: { type: "string", nullable: true },
      },
      required: ["statut"],
    },
    copiéDe: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  required: [
    "type",
    "licence",
    "noms",
    "descriptions",
    "tableaux",
    "motsClefs",
    "nuées",
    "statut",
    "copiéDe",
  ],
};

export type infoTableau = {
  clef: string;
  position: number;
};

export type différenceBds =
  | différenceBDTableauSupplémentaire
  | différenceBDTableauManquant
  | différenceTableauxBds;

export type différenceBDTableauManquant = {
  type: "tableauManquant";
  sévère: true;
  clefManquante: string;
};

export type différenceBDTableauSupplémentaire = {
  type: "tableauSupplémentaire";
  sévère: false;
  clefExtra: string;
};

export type différenceTableauxBds<
  T extends différenceTableaux = différenceTableaux
> = {
  type: "tableau";
  sévère: T["sévère"];
  idTableau: string;
  différence: T;
};

export type infoTableauAvecId = infoTableau & { id: string };

export const schémaInfoTableau: JSONSchemaType<infoTableau> = {
  type: "object",
  properties: {
    clef: { type: "string" },
    position: { type: "integer" },
  },
  required: ["clef", "position"],
};
export const schémaBdTableauxDeBd: JSONSchemaType<{
  [idTableau: string]: infoTableau;
}> = {
  type: "object",
  additionalProperties: schémaInfoTableau,
  required: [],
};

const schémaBdPrincipale: JSONSchemaType<string> = { type: "string" };

export const MAX_TAILLE_IMAGE = 500 * 1000; // 500 kilooctets
export const MAX_TAILLE_IMAGE_VIS = 1500 * 1000; // 1,5 megaoctets

export default class BDs extends ComposanteClientListe<string> {
  verrouBdUnique: Semaphore;

  constructor({ client }: { client: ClientConstellation }) {
    super({ client, clef: "bds", schémaBdPrincipale });
    this.verrouBdUnique = new Semaphore();
  }

  async épingler() {
    await this.client.épingles?.épinglerBd({
      id: await this.obtIdBd(),
      récursif: false,
      fichiers: false,
    });
  }

  @cacheSuivi
  async suivreBds({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({ idCompte, f });
  }

  async créerBd({
    licence,
    licenceContenu,
    ajouter = true,
  }: {
    licence: string;
    licenceContenu?: string;
    ajouter?: boolean;
  }): Promise<string> {
    const idBdBd = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès: {
        address: undefined,
        premierMod: this.client.bdCompte!.id,
      },
    });

    const { bd: bdBD, fOublier } = await this.client.ouvrirBd<structureBdBd>({
      id: idBdBd,
      type: "kvstore",
    });
    await bdBD.set("type", "bd");
    await bdBD.set("licence", licence);
    if (licenceContenu) await bdBD.set("licenceContenu", licenceContenu);

    const accès = bdBD.access as unknown as ContrôleurConstellation;
    const optionsAccès = { address: accès.address };

    const idBdMétadonnées = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdBD.set("métadonnées", idBdMétadonnées);

    const idBdNoms = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdBD.set("noms", idBdNoms);

    const idBdDescr = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdBD.set("descriptions", idBdDescr);

    const idBdTableaux = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdBD.set("tableaux", idBdTableaux);

    const idBdMotsClefs = await this.client.créerBdIndépendante({
      type: "feed",
      optionsAccès,
    });
    await bdBD.set("motsClefs", idBdMotsClefs);

    const idBdNuées = await this.client.créerBdIndépendante({
      type: "feed",
      optionsAccès,
    });
    await bdBD.set("nuées", idBdNuées);

    await bdBD.set("statut", { statut: TYPES_STATUT.ACTIVE });

    if (ajouter) {
      const { bd: bdRacine, fOublier: fOublierRacine } =
        await this.client.ouvrirBd<string>({
          id: await this.obtIdBd(),
          type: "feed",
        });
      await bdRacine.add(idBdBd);
      fOublierRacine();
    }

    await fOublier();

    return idBdBd;
  }

  async ajouterÀMesBds({ idBd }: { idBd: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<string>({
      id: await this.obtIdBd(),
      type: "feed",
    });
    await bd.add(idBd);
    await fOublier();
  }

  async enleverDeMesBds({ idBd }: { idBd: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<string>({
      id: await this.obtIdBd(),
      type: "feed",
    });
    await this.client.effacerÉlémentDeBdListe({ bd, élément: idBd });
    await fOublier();
  }

  async copierBd({
    idBd,
    ajouterÀMesBds = true,
    copierDonnées = true,
  }: {
    idBd: string;
    ajouterÀMesBds?: boolean;
    copierDonnées?: boolean;
  }): Promise<string> {
    const { bd: bdBase, fOublier } = await this.client.ouvrirBd<structureBdBd>({
      id: idBd,
      type: "kvstore",
    });
    const licence = bdBase.get("licence");
    const licenceContenu = bdBase.get("licenceContenu");
    if (!licence)
      throw new Error(`Aucune licence trouvée sur la BD source ${idBd}.`);
    const idNouvelleBd = await this.créerBd({
      licence,
      licenceContenu,
      ajouter: ajouterÀMesBds,
    });
    const { bd: nouvelleBd, fOublier: fOublierNouvelle } =
      await this.client.ouvrirBd<structureBdBd>({
        id: idNouvelleBd,
        type: "kvstore",
      });

    const idBdMétadonnées = bdBase.get("métadonnées");
    if (idBdMétadonnées) {
      const { bd: bdMétadonnées, fOublier: fOublierBdNoms } =
        await this.client.ouvrirBd<{ [clef: string]: élémentsBd }>({
          id: idBdMétadonnées,
          type: "kvstore",
        });
      const métadonnées = ClientConstellation.obtObjetdeBdDic({
        bd: bdMétadonnées,
      });
      await fOublierBdNoms();
      await this.sauvegarderMétadonnéesBd({ idBd: idNouvelleBd, métadonnées });
    }

    const idBdNoms = bdBase.get("noms");
    if (idBdNoms) {
      const { bd: bdNoms, fOublier: fOublierBdNoms } =
        await this.client.ouvrirBd<{ [langue: string]: string }>({
          id: idBdNoms,
          type: "kvstore",
        });
      const noms = ClientConstellation.obtObjetdeBdDic({ bd: bdNoms });
      await fOublierBdNoms();
      await this.sauvegarderNomsBd({ idBd: idNouvelleBd, noms });
    }

    const idBdDescr = bdBase.get("descriptions");
    if (idBdDescr) {
      const { bd: bdDescr, fOublier: fOublierBdDescr } =
        await this.client.ouvrirBd<{ [langue: string]: string }>({
          id: idBdDescr,
          type: "kvstore",
        });
      const descriptions = ClientConstellation.obtObjetdeBdDic({
        bd: bdDescr,
      });
      await fOublierBdDescr();
      await this.sauvegarderDescriptionsBd({
        idBd: idNouvelleBd,
        descriptions,
      });
    }

    const idBdMotsClefs = bdBase.get("motsClefs");
    if (idBdMotsClefs) {
      const { bd: bdMotsClefs, fOublier: fOublierBdMotsClefs } =
        await this.client.ouvrirBd<string>({ id: idBdMotsClefs, type: "feed" });
      const motsClefs = ClientConstellation.obtÉlémentsDeBdListe({
        bd: bdMotsClefs,
      });
      await fOublierBdMotsClefs();
      await this.ajouterMotsClefsBd({
        idBd: idNouvelleBd,
        idsMotsClefs: motsClefs,
      });
    }

    const idBdNuées = bdBase.get("nuées");
    if (idBdNuées) {
      const { bd: bdNuées, fOublier: fOublierBdNuées } =
        await this.client.ouvrirBd<string>({ id: idBdNuées, type: "feed" });
      const nuées = ClientConstellation.obtÉlémentsDeBdListe({
        bd: bdNuées,
      });
      await fOublierBdNuées();
      await this.rejoindreNuées({
        idBd: idNouvelleBd,
        idsNuées: nuées,
      });
    }

    const idBdTableaux = bdBase.get("tableaux");
    const idNouvelleBdTableaux = nouvelleBd.get("tableaux");
    if (!idNouvelleBdTableaux) throw new Error("Erreur d'initialisation.");

    const { bd: nouvelleBdTableaux, fOublier: fOublierNouvelleTableaux } =
      await this.client.ouvrirBd<{ [tbl: string]: infoTableau }>({
        id: idNouvelleBdTableaux,
        type: "kvstore",
      });
    if (idBdTableaux) {
      const { bd: bdTableaux, fOublier: fOublierBdTableaux } =
        await this.client.ouvrirBd<{ [tbl: string]: infoTableau }>({
          id: idBdTableaux,
          type: "kvstore",
        });
      const tableaux = ClientConstellation.obtObjetdeBdDic({
        bd: bdTableaux,
      });
      await fOublierBdTableaux();
      for (const idTableau of Object.keys(tableaux)) {
        const idNouveauTableau: string =
          await this.client.tableaux!.copierTableau({
            id: idTableau,
            idBd: idNouvelleBd,
            copierDonnées,
          });
        await nouvelleBdTableaux.set(idNouveauTableau, tableaux[idTableau]);
      }
    }

    const statut = bdBase.get("statut") || { statut: TYPES_STATUT.ACTIVE };
    await nouvelleBd.set("statut", statut);

    const image = bdBase.get("image");
    if (image) await nouvelleBd.set("image", image);

    await nouvelleBd.set("copiéDe", { id: idBd });

    await Promise.all([
      fOublier(),
      fOublierNouvelleTableaux(),
      fOublierNouvelle(),
    ]);
    return idNouvelleBd;
  }

  async créerBdDeSchéma({
    schéma,
    ajouter = true,
  }: {
    schéma: schémaSpécificationBd;
    ajouter?: boolean;
  }): Promise<string> {
    const { tableaux, motsClefs, nuées, licence, licenceContenu, statut } =
      schéma;

    // On n'ajoutera la BD que lorsqu'elle sera prête
    const idBd = await this.créerBd({
      licence,
      licenceContenu,
      ajouter: false,
    });

    if (motsClefs) {
      await this.ajouterMotsClefsBd({ idBd, idsMotsClefs: motsClefs });
    }

    if (nuées) {
      await this.rejoindreNuées({ idBd, idsNuées: nuées });
    }

    if (statut) {
      await this.changerStatutBd({ idBd, statut });
    }

    for (const tb of tableaux) {
      const { cols, clef: clefTableau } = tb;
      const idTableau = await this.ajouterTableauBd({ idBd, clefTableau });

      for (const c of cols) {
        const { idColonne, idVariable, index, optionnel } = c;
        await this.client.tableaux!.ajouterColonneTableau({
          idTableau,
          idVariable,
          idColonne,
        });
        if (index) {
          await this.client.tableaux!.changerColIndex({
            idTableau,
            idColonne,
            val: true,
          });
        }
        if (!optionnel) {
          const règle: règleExiste = {
            typeRègle: "existe",
            détails: {},
          };
          await this.client.tableaux!.ajouterRègleTableau({
            idTableau,
            idColonne,
            règle,
          });
        }
      }
    }

    // Maintenant on peut l'annoncer !
    if (ajouter) await this.ajouterÀMesBds({ idBd });

    return idBd;
  }

  @cacheSuivi
  async suivreParent({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<{ id: string } | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idBd,
      f: async (bd) => {
        const copiéDe = bd.get("copiéDe");
        await f(copiéDe);
      },
      type: "keyvalue",
      schéma: schémaStructureBdBd,
    });
  }

  @cacheSuivi
  async suivreNuéesBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdListeDeClef({
      id: idBd,
      clef: "nuées",
      schéma: { type: "string" },
      f,
    });
  }

  @cacheSuivi
  async rechercherBdsParMotsClefs({
    motsClefs,
    f,
    idCompte,
  }: {
    motsClefs: string[];
    f: schémaFonctionSuivi<string[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBds({ f: fSuivreRacine, idCompte });
    };

    const fCondition = async (
      id: string,
      fSuivreCondition: (état: boolean) => void
    ): Promise<schémaFonctionOublier> => {
      const fFinaleSuivreCondition = (motsClefsBd: string[]) => {
        const état = motsClefs.every((m) => motsClefsBd.includes(m));
        fSuivreCondition(état);
      };
      return await this.suivreMotsClefsBd({
        idBd: id,
        f: fFinaleSuivreCondition,
      });
    };
    return await this.client.suivreBdsSelonCondition({ fListe, fCondition, f });
  }

  @cacheSuivi
  async rechercherBdsParNuée({
    idNuée,
    f,
    idCompte,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBds({ f: fSuivreRacine, idCompte });
    };

    const fCondition = async (
      id: string,
      fSuivreCondition: (état: boolean) => void
    ): Promise<schémaFonctionOublier> => {
      const fFinaleSuivreCondition = async (nuéesBd?: string[]) => {
        fSuivreCondition(!!nuéesBd && nuéesBd.includes(idNuée));
      };
      return await this.suivreNuéesBd({ idBd: id, f: fFinaleSuivreCondition });
    };
    return await this.client.suivreBdsSelonCondition({ fListe, fCondition, f });
  }

  async combinerBds({
    idBdBase,
    idBd2,
  }: {
    idBdBase: string;
    idBd2: string;
  }): Promise<void> {
    const obtTableaux = async (idBd: string): Promise<infoTableauAvecId[]> => {
      return await uneFois(
        async (
          fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>
        ): Promise<schémaFonctionOublier> => {
          return await this.suivreTableauxBd({ idBd, f: fSuivi });
        }
      );
    };

    const tableauxBase = await obtTableaux(idBdBase);
    const tableauxBd2 = await obtTableaux(idBd2);

    for (const info of tableauxBd2) {
      const { id: idTableau, clef } = info;
      if (clef) {
        const idTableauBaseCorresp = tableauxBase.find(
          (t) => t.clef === clef
        )?.id;

        if (idTableauBaseCorresp) {
          await this.client.tableaux!.combinerDonnées({
            idTableauBase: idTableauBaseCorresp,
            idTableau2: idTableau,
          });
        }
      }
    }
  }

  @cacheSuivi
  async suivreIdTableauParClef({
    idBd,
    clef,
    f,
  }: {
    idBd: string;
    clef: string;
    f: schémaFonctionSuivi<string | undefined>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (tableaux: infoTableauAvecId[]) => {
      const infoTableau = tableaux.find((t) => t.clef === clef);
      await f(infoTableau?.id);
    };
    return await this.suivreTableauxBd({ idBd, f: fFinale });
  }

  @cacheSuivi
  async suivreBdUnique({
    schéma,
    idNuéeUnique,
    f,
  }: {
    schéma: schémaSpécificationBd;
    idNuéeUnique: string;
    f: schémaFonctionSuivi<string>;
  }): Promise<schémaFonctionOublier> {
    const clefStockageLocal = "bdUnique: " + idNuéeUnique;

    const déjàCombinées = new Set();

    const fFinale = async (bds: string[]): Promise<void> => {
      let idBd: string;

      await this.verrouBdUnique.acquire(idNuéeUnique);
      const idBdLocale = await this.client.obtDeStockageLocal({
        clef: clefStockageLocal,
      });

      switch (bds.length) {
        case 0: {
          if (idBdLocale) {
            idBd = idBdLocale;
          } else {
            idBd = await this.créerBdDeSchéma({ schéma });
            await this.client.sauvegarderAuStockageLocal({
              clef: clefStockageLocal,
              val: idBd,
            });
          }
          break;
        }
        case 1: {
          idBd = bds[0];
          await this.client.sauvegarderAuStockageLocal({
            clef: clefStockageLocal,
            val: idBd,
          });
          if (idBdLocale && idBd !== idBdLocale) {
            await this.combinerBds({ idBdBase: idBd, idBd2: idBdLocale });
            await this.effacerBd({ idBd: idBdLocale });
          }
          break;
        }
        default: {
          if (idBdLocale) bds = [...new Set([...bds, idBdLocale])];
          idBd = bds.sort()[0];
          await this.client.sauvegarderAuStockageLocal({
            clef: clefStockageLocal,
            val: idBd,
          });

          for (const bd of bds.slice(1)) {
            if (déjàCombinées.has(bd)) continue;

            déjàCombinées.add(bd);
            await this.combinerBds({ idBdBase: idBd, idBd2: bd });
            await this.effacerBd({ idBd: bd });
          }

          break;
        }
      }
      this.verrouBdUnique.release(idNuéeUnique);
      await f(idBd);
    };

    const fOublier = await this.rechercherBdsParNuée({
      idNuée: idNuéeUnique,
      f: fFinale,
    });

    return fOublier;
  }

  @cacheSuivi
  async suivreIdTableauParClefDeBdUnique({
    schémaBd,
    idNuéeUnique,
    clefTableau,
    f,
  }: {
    schémaBd: schémaSpécificationBd;
    idNuéeUnique: string;
    clefTableau: string;
    f: schémaFonctionSuivi<string | undefined>;
  }): Promise<schémaFonctionOublier> {
    const fRacine = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (nouvelIdBdCible: string) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreBdUnique({
        schéma: schémaBd,
        idNuéeUnique,
        f: fSuivreRacine,
      });
    };

    const fSuivre = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<string | undefined>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreIdTableauParClef({
        idBd: id,
        clef: clefTableau,
        f: fSuivreBd,
      });
    };
    return await suivreBdDeFonction<string>({
      fRacine,
      f,
      fSuivre,
    });
  }

  @cacheSuivi
  async suivreDonnéesDeTableauUnique<T extends élémentBdListeDonnées>({
    schémaBd,
    idNuéeUnique,
    clefTableau,
    f,
  }: {
    schémaBd: schémaSpécificationBd;
    idNuéeUnique: string;
    clefTableau: string;
    f: schémaFonctionSuivi<élémentDonnées<T>[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (données?: élémentDonnées<T>[]) => {
      return await f(données || []);
    };

    const fSuivreDonnéesDeTableau = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<élémentDonnées<T>[]>;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.tableaux!.suivreDonnées({
        idTableau: id,
        f: fSuivreBd,
      });
    };

    const fSuivreTableau = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: schémaFonctionSuivi<string>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreIdTableauParClefDeBdUnique({
        schémaBd,
        idNuéeUnique,
        clefTableau,
        f: async (idTableau?: string) => {
          if (idTableau) await fSuivreRacine(idTableau);
        },
      });
    };

    return await suivreBdDeFonction({
      fRacine: fSuivreTableau,
      f: fFinale,
      fSuivre: fSuivreDonnéesDeTableau,
    });
  }

  async ajouterÉlémentÀTableauUnique<T extends élémentBdListeDonnées>({
    schémaBd,
    idNuéeUnique,
    clefTableau,
    vals,
  }: {
    schémaBd: schémaSpécificationBd;
    idNuéeUnique: string;
    clefTableau: string;
    vals: T;
  }): Promise<string> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClefDeBdUnique({
          schémaBd,
          idNuéeUnique,
          clefTableau,
          f: ignorerNonDéfinis(fSuivi),
        });
      }
    );
    return await this.client.tableaux!.ajouterÉlément({
      idTableau: idTableau,
      vals,
    });
  }

  async modifierÉlémentDeTableauUnique({
    vals,
    schémaBd,
    idNuéeUnique,
    clefTableau,
    empreintePrécédente,
  }: {
    vals: { [key: string]: élémentsBd | undefined };
    schémaBd: schémaSpécificationBd;
    idNuéeUnique: string;
    clefTableau: string;
    empreintePrécédente: string;
  }): Promise<string> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClefDeBdUnique({
          schémaBd,
          idNuéeUnique,
          clefTableau,
          f: (id?: string) => {
            if (id) fSuivi(id);
          },
        });
      },
      (x) => !!x
    );

    return await this.client.tableaux!.modifierÉlément({
      idTableau: idTableau,
      vals,
      empreintePrécédente,
    });
  }

  async effacerÉlémentDeTableauUnique({
    schémaBd,
    idNuéeUnique,
    clefTableau,
    empreinte,
  }: {
    schémaBd: schémaSpécificationBd;
    idNuéeUnique: string;
    clefTableau: string;
    empreinte: string;
  }): Promise<void> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClefDeBdUnique({
          schémaBd,
          idNuéeUnique,
          clefTableau,
          f: (id?: string) => {
            if (id) fSuivi(id);
          },
        });
      },
      (x) => !!x
    );

    return await this.client.tableaux!.effacerÉlément({
      idTableau: idTableau,
      empreinte,
    });
  }

  @cacheSuivi
  async suivreDonnéesDeTableauParClef<T extends élémentBdListeDonnées>({
    idBd,
    clefTableau,
    f,
  }: {
    idBd: string;
    clefTableau: string;
    f: schémaFonctionSuivi<élémentDonnées<T>[]>;
  }): Promise<schémaFonctionOublier> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClef({
          idBd,
          clef: clefTableau,
          f: ignorerNonDéfinis(fSuivi),
        });
      },
      (x) => !!x
    );
    return await this.client!.tableaux!.suivreDonnées({
      idTableau,
      f,
    });
  }

  async ajouterÉlémentÀTableauParClef<T extends élémentBdListeDonnées>({
    idBd,
    clefTableau,
    vals,
  }: {
    idBd: string;
    clefTableau: string;
    vals: T;
  }): Promise<string> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClef({
          idBd,
          clef: clefTableau,
          f: ignorerNonDéfinis(fSuivi),
        });
      }
    );
    return await this.client.tableaux!.ajouterÉlément({
      idTableau,
      vals,
    });
  }

  async modifierÉlémentDeTableauParClef({
    idBd,
    clefTableau,
    empreinteÉlément,
    vals,
  }: {
    idBd: string;
    clefTableau: string;
    empreinteÉlément: string;
    vals: { [key: string]: élémentsBd | undefined };
  }): Promise<string> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClef({
          idBd,
          clef: clefTableau,
          f: ignorerNonDéfinis(fSuivi),
        });
      }
    );
    return await this.client.tableaux!.modifierÉlément({
      idTableau,
      vals,
      empreintePrécédente: empreinteÉlément,
    });
  }

  async effacerÉlémentDeTableauParClef({
    idBd,
    clefTableau,
    empreinteÉlément,
  }: {
    idBd: string;
    clefTableau: string;
    empreinteÉlément: string;
  }): Promise<void> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClef({
          idBd,
          clef: clefTableau,
          f: ignorerNonDéfinis(fSuivi),
        });
      }
    );
    this.client.tableaux!.effacerÉlément({
      idTableau,
      empreinte: empreinteÉlément,
    });
  }

  async sauvegarderMétadonnéesBd({
    idBd,
    métadonnées,
  }: {
    idBd: string;
    métadonnées: { [key: string]: élémentsBd };
  }): Promise<void> {
    const idBdMétadonnées = await this.client.obtIdBd({
      nom: "métadonnées",
      racine: idBd,
      type: "kvstore",
    });
    if (!idBdMétadonnées)
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);

    const { bd: bdMétadonnées, fOublier } = await this.client.ouvrirBd<{
      [clef: string]: élémentsBd;
    }>({ id: idBdMétadonnées, type: "kvstore" });

    for (const clef in métadonnées) {
      await bdMétadonnées.set(clef, métadonnées[clef]);
    }
    await fOublier();
  }

  async sauvegarderMétadonnéeBd({
    idBd,
    clef,
    métadonnée,
  }: {
    idBd: string;
    clef: string;
    métadonnée: string;
  }): Promise<void> {
    const idBdMétadonnées = await this.client.obtIdBd({
      nom: "métadonnées",
      racine: idBd,
      type: "kvstore",
    });
    if (!idBdMétadonnées)
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);

    const { bd: bdMétadonnées, fOublier } = await this.client.ouvrirBd<{
      [clef: string]: string;
    }>({ id: idBdMétadonnées, type: "kvstore" });
    await bdMétadonnées.set(clef, métadonnée);
    await fOublier();
  }

  async effacerMétadonnéeBd({
    idBd,
    clef,
  }: {
    idBd: string;
    clef: string;
  }): Promise<void> {
    const idBdMétadonnées = await this.client.obtIdBd({
      nom: "métadonnées",
      racine: idBd,
      type: "kvstore",
    });
    if (!idBdMétadonnées)
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);

    const { bd: bdMétadonnées, fOublier } = await this.client.ouvrirBd<{
      [langue: string]: string;
    }>({ id: idBdMétadonnées, type: "kvstore" });
    await bdMétadonnées.del(clef);
    await fOublier();
  }

  @cacheSuivi
  async suivreMétadonnéesBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<{ [key: string]: élémentsBd }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({
      id: idBd,
      clef: "métadonnées",
      schéma: schémaStructureBdMétadonnées,
      f,
    });
  }

  async sauvegarderNomsBd({
    idBd,
    noms,
  }: {
    idBd: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idBd,
      type: "kvstore",
    });
    if (!idBdNoms)
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<{
      [langue: string]: string;
    }>({ id: idBdNoms, type: "kvstore" });

    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
    await fOublier();
  }

  async sauvegarderNomBd({
    idBd,
    langue,
    nom,
  }: {
    idBd: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idBd,
      type: "kvstore",
    });
    if (!idBdNoms)
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<{
      [langue: string]: string;
    }>({ id: idBdNoms, type: "kvstore" });
    await bdNoms.set(langue, nom);
    await fOublier();
  }

  async effacerNomBd({
    idBd,
    langue,
  }: {
    idBd: string;
    langue: string;
  }): Promise<void> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idBd,
      type: "kvstore",
    });
    if (!idBdNoms)
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<{
      [langue: string]: string;
    }>({ id: idBdNoms, type: "kvstore" });
    await bdNoms.del(langue);
    await fOublier();
  }

  async sauvegarderDescriptionsBd({
    idBd,
    descriptions,
  }: {
    idBd: string;
    descriptions: { [key: string]: string };
  }): Promise<void> {
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: idBd,
      type: "kvstore",
    });
    if (!idBdDescr)
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<{
      [langue: string]: string;
    }>({ id: idBdDescr, type: "kvstore" });
    for (const lng in descriptions) {
      await bdDescr.set(lng, descriptions[lng]);
    }
    await fOublier();
  }

  async sauvegarderDescriptionBd({
    idBd,
    langue,
    description,
  }: {
    idBd: string;
    langue: string;
    description: string;
  }): Promise<void> {
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: idBd,
      type: "kvstore",
    });
    if (!idBdDescr)
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<{
      [langue: string]: string;
    }>({ id: idBdDescr, type: "kvstore" });
    await bdDescr.set(langue, description);
    await fOublier();
  }

  async effacerDescriptionBd({
    idBd,
    langue,
  }: {
    idBd: string;
    langue: string;
  }): Promise<void> {
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: idBd,
      type: "kvstore",
    });
    if (!idBdDescr)
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<{
      [langue: string]: string;
    }>({ id: idBdDescr, type: "keyvalue" });
    await bdDescr.del(langue);
    await fOublier();
  }

  async changerLicenceBd({
    idBd,
    licence,
  }: {
    idBd: string;
    licence: string;
  }): Promise<void> {
    const { bd: bdBd, fOublier } = await this.client.ouvrirBd<structureBdBd>({
      id: idBd,
      type: "keyvalue",
    });
    await bdBd.set("licence", licence);
    await fOublier();
  }

  async changerLicenceContenuBd({
    idBd,
    licenceContenu,
  }: {
    idBd: string;
    licenceContenu?: string;
  }): Promise<void> {
    const { bd: bdBd, fOublier } = await this.client.ouvrirBd<structureBdBd>({
      id: idBd,
      type: "keyvalue",
    });
    if (licenceContenu) {
      await bdBd.set("licenceContenu", licenceContenu);
    } else {
      await bdBd.del("licenceContenu");
    }
    await fOublier();
  }

  async ajouterMotsClefsBd({
    idBd,
    idsMotsClefs,
  }: {
    idBd: string;
    idsMotsClefs: string | string[];
  }): Promise<void> {
    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];
    const idBdMotsClefs = await this.client.obtIdBd({
      nom: "motsClefs",
      racine: idBd,
      type: "feed",
    });
    if (!idBdMotsClefs) {
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);
    }

    const { bd: bdMotsClefs, fOublier } = await this.client.ouvrirBd<string>({
      id: idBdMotsClefs,
      type: "feed",
    });
    for (const id of idsMotsClefs) {
      const motsClefsExistants = ClientConstellation.obtÉlémentsDeBdListe({
        bd: bdMotsClefs,
      });
      if (!motsClefsExistants.includes(id)) await bdMotsClefs.add(id);
    }
    await fOublier();
  }

  async effacerMotClefBd({
    idBd,
    idMotClef,
  }: {
    idBd: string;
    idMotClef: string;
  }): Promise<void> {
    const idBdMotsClefs = await this.client.obtIdBd({
      nom: "motsClefs",
      racine: idBd,
      type: "feed",
    });
    if (!idBdMotsClefs) {
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);
    }

    const { bd: bdMotsClefs, fOublier } = await this.client.ouvrirBd<string>({
      id: idBdMotsClefs,
      type: "feed",
    });

    await this.client.effacerÉlémentDeBdListe({
      bd: bdMotsClefs,
      élément: idMotClef,
    });

    await fOublier();
  }

  async rejoindreNuées({
    idBd,
    idsNuées,
  }: {
    idBd: string;
    idsNuées: string | string[];
  }): Promise<void> {
    if (!Array.isArray(idsNuées)) idsNuées = [idsNuées];
    const idBdNuées = await this.client.obtIdBd({
      nom: "nuées",
      racine: idBd,
      type: "feed",
    });
    if (!idBdNuées) {
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);
    }

    const { bd: bdNuées, fOublier } = await this.client.ouvrirBd<string>({
      id: idBdNuées,
      type: "feed",
    });
    for (const id of idsNuées) {
      const nuéesExistantes = ClientConstellation.obtÉlémentsDeBdListe({
        bd: bdNuées,
      });
      if (!nuéesExistantes.includes(id)) await bdNuées.add(id);
    }
    await fOublier();
  }

  async quitterNuée({
    idBd,
    idNuée,
  }: {
    idBd: string;
    idNuée: string;
  }): Promise<void> {
    const idBdNuées = await this.client.obtIdBd({
      nom: "nuée",
      racine: idBd,
      type: "feed",
    });
    if (!idBdNuées) {
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);
    }

    const { bd: bdNuées, fOublier } = await this.client.ouvrirBd<string>({
      id: idBdNuées,
      type: "feed",
    });

    await this.client.effacerÉlémentDeBdListe({
      bd: bdNuées,
      élément: idNuée,
    });

    await fOublier();
  }

  async ajouterTableauBd({
    idBd,
    clefTableau,
  }: {
    idBd: string;
    clefTableau?: string;
  }): Promise<string> {
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: idBd,
      type: "kvstore",
    });
    if (!idBdTableaux) {
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);
    }

    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBd<{
      [tbl: string]: infoTableau;
    }>({ id: idBdTableaux, type: "keyvalue" });

    clefTableau = clefTableau || uuidv4();
    const idTableau = await this.client.tableaux!.créerTableau({ idBd });
    await bdTableaux.set(idTableau, {
      position: Object.keys(bdTableaux.all).length,
      clef: clefTableau,
    });

    await fOublier();
    return idTableau;
  }

  async effacerTableauBd({
    idBd,
    idTableau,
  }: {
    idBd: string;
    idTableau: string;
  }): Promise<void> {
    // D'abord effacer l'entrée dans notre liste de tableaux
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: idBd,
      type: "kvstore",
    });
    if (!idBdTableaux) {
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);
    }

    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBd<{
      [tbl: string]: infoTableau;
    }>({ id: idBdTableaux, type: "keyvalue" });
    await bdTableaux.del(idTableau);
    await fOublier();

    // Enfin, effacer les données et le tableau lui-même
    await this.client.tableaux!.effacerTableau({ idTableau });
  }

  async spécifierClefTableau({
    idBd,
    idTableau,
    clef,
  }: {
    idBd: string;
    idTableau: string;
    clef: string;
  }): Promise<void> {
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: idBd,
      type: "kvstore",
    });
    if (!idBdTableaux) throw new Error("Id Bd Tableau non obtenable.");
    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBd<{
      [tbl: string]: infoTableau;
    }>({ id: idBdTableaux, type: "keyvalue" });

    const infoExistante = bdTableaux.get(idTableau);
    if (infoExistante) {
      infoExistante.clef = clef;
      bdTableaux.set(idTableau, infoExistante);
    }

    await fOublier();
  }

  async changerStatutBd({
    idBd,
    statut,
  }: {
    idBd: string;
    statut: schémaStatut;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<structureBdBd>({
      id: idBd,
      type: "keyvalue",
    });
    bd.set("statut", statut);
    await fOublier();
  }

  async suivreStatutBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<schémaStatut>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDic({
      id: idBd,
      schéma: schémaStructureBdBd,
      f: async (x) => {
        if (x["statut"]) return await f(x["statut"]);
      },
    });
  }

  async marquerObsolète({
    idBd,
    idNouvelle,
  }: {
    idBd: string;
    idNouvelle?: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<structureBdBd>({
      id: idBd,
      type: "keyvalue",
    });
    bd.set("statut", { statut: TYPES_STATUT.OBSOLÈTE, idNouvelle });
    await fOublier();
  }

  async marquerActive({ idBd }: { idBd: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<structureBdBd>({
      id: idBd,
      type: "keyvalue",
    });
    bd.set("statut", { statut: TYPES_STATUT.ACTIVE });
    await fOublier();
  }

  async marquerBêta({ idBd }: { idBd: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<structureBdBd>({
      id: idBd,
      type: "keyvalue",
    });
    bd.set("statut", { statut: TYPES_STATUT.BÊTA });
    await fOublier();
  }

  async marquerInterne({ idBd }: { idBd: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<structureBdBd>({
      id: idBd,
      type: "keyvalue",
    });
    bd.set("statut", { statut: TYPES_STATUT.INTERNE });
    await fOublier();
  }

  @cacheSuivi
  async suivreLicenceBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<string>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idBd,
      type: "keyvalue",
      schéma: schémaStructureBdBd,
      f: async (bd) => {
        const licence = bd.get("licence");
        if (licence) await f(licence);
      },
    });
  }

  @cacheSuivi
  async suivreLicenceContenuBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<string | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idBd,
      type: "keyvalue",
      schéma: schémaStructureBdBd,
      f: async (bd) => {
        const licenceContenu = bd.get("licenceContenu");
        await f(licenceContenu);
      },
    });
  }

  async inviterAuteur({
    idBd,
    idCompteAuteur,
    rôle,
  }: {
    idBd: string;
    idCompteAuteur: string;
    rôle: keyof objRôles;
  }): Promise<void> {
    await this.client.donnerAccès({ idBd, identité: idCompteAuteur, rôle });
  }

  async sauvegarderImage({
    idBd,
    image,
  }: {
    idBd: string;
    image: ImportCandidate;
  }): Promise<void> {
    let contenu: ImportCandidate;

    if ((image as File).size !== undefined) {
      if ((image as File).size > MAX_TAILLE_IMAGE) {
        throw new Error("Taille maximale excédée");
      }
      contenu = await (image as File).arrayBuffer();
    } else {
      contenu = image;
    }
    const idImage = await this.client.ajouterÀSFIP({ fichier: contenu });
    const { bd, fOublier } = await this.client.ouvrirBd<structureBdBd>({
      id: idBd,
      type: "keyvalue",
    });
    await bd.set("image", idImage);
    await fOublier();
  }

  async effacerImage({ idBd }: { idBd: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<structureBdBd>({
      id: idBd,
      type: "kvstore",
    });
    await bd.del("image");
    await fOublier();
  }

  @cacheSuivi
  async suivreImage({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<Uint8Array | null>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idBd,
      type: "keyvalue",
      schéma: schémaStructureBdBd,
      f: async (bd) => {
        const idImage = bd.get("image");
        if (!idImage) {
          await f(null);
        } else {
          const image = await this.client.obtFichierSFIP({
            id: idImage,
            max: MAX_TAILLE_IMAGE_VIS,
          });
          await f(image);
        }
      },
    });
  }

  @cacheSuivi
  async suivreNomsBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({
      id: idBd,
      clef: "noms",
      schéma: schémaStructureBdNoms,
      f,
    });
  }

  @cacheSuivi
  async suivreDescriptionsBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({
      id: idBd,
      clef: "descriptions",
      schéma: schémaStructureBdNoms,
      f,
    });
  }

  @cacheSuivi
  async suivreMotsClefsBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdListeDeClef({
      id: idBd,
      clef: "motsClefs",
      schéma: { type: "string" },
      f,
    });
  }

  @cacheSuivi
  async suivreTableauxBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<infoTableauAvecId[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (infos: { [clef: string]: infoTableau }) => {
      const tableaux: infoTableauAvecId[] = Object.entries(infos).map(
        ([id, info]) => {
          return {
            id,
            ...info,
          };
        }
      );
      await f(tableaux);
    };
    return await this.client.suivreBdDicDeClef({
      id: idBd,
      clef: "tableaux",
      schéma: schémaBdTableauxDeBd,
      f: fFinale,
    });
  }

  @cacheSuivi
  async suivreScoreAccèsBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<number | undefined>;
  }): Promise<schémaFonctionOublier> {
    // À faire
    f(Number.parseInt(idBd));
    return faisRien;
  }

  @cacheSuivi
  async suivreScoreCouvertureBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<number | undefined>;
  }): Promise<schémaFonctionOublier> {
    type scoreTableau = { numérateur: number; dénominateur: number };

    const fFinale = async (branches: scoreTableau[]) => {
      const numérateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.numérateur,
        0
      );
      const dénominateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.dénominateur,
        0
      );
      await f(dénominateur === 0 ? undefined : numérateur / dénominateur);
    };

    const fBranche = async (
      idTableau: string,
      f: schémaFonctionSuivi<scoreTableau>
    ): Promise<schémaFonctionOublier> => {
      const info: { cols?: InfoColAvecCatégorie[]; règles?: règleColonne[] } =
        {};

      const fFinaleBranche = async () => {
        const { cols, règles } = info;

        if (cols !== undefined && règles !== undefined) {
          const colsÉligibles = cols.filter(
            (c) =>
              c.catégorie &&
              ["numérique", "catégorique"].includes(c.catégorie.catégorie)
          );

          const dénominateur = colsÉligibles.length;
          const numérateur = colsÉligibles.filter((c) =>
            règles.some(
              (r) =>
                r.règle.règle.typeRègle !== "catégorie" && r.colonne === c.id
            )
          ).length;
          await f({ numérateur, dénominateur });
        }
      };

      const fOublierCols = await this.client.tableaux!.suivreColonnesTableau({
        idTableau,
        f: async (cols) => {
          info.cols = cols;
          await fFinaleBranche();
        },
      });

      const fOublierRègles = await this.client.tableaux!.suivreRègles({
        idTableau,
        f: async (règles) => {
          info.règles = règles;
          await fFinaleBranche();
        },
      });

      return async () => {
        await fOublierCols();
        await fOublierRègles();
      };
    };

    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd({
        idBd,
        f: (tableaux) => fSuivreRacine(tableaux.map((x) => x.id)),
      });
    };

    return await this.client.suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  @cacheSuivi
  async suivreScoreValideBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<number | undefined>;
  }): Promise<schémaFonctionOublier> {
    type scoreTableau = { numérateur: number; dénominateur: number };

    const fFinale = async (branches: scoreTableau[]) => {
      const numérateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.numérateur,
        0
      );
      const dénominateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.dénominateur,
        0
      );
      await f(dénominateur === 0 ? undefined : numérateur / dénominateur);
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
          const colsÉligibles = cols.filter(
            (c) =>
              c.catégorie &&
              ["numérique", "catégorique"].includes(c.catégorie.catégorie)
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

      const fOublierDonnées = await this.client.tableaux!.suivreDonnées({
        idTableau,
        f: (données) => {
          info.données = données;
          fFinaleBranche();
        },
      });

      const fOublierErreurs = await this.client.tableaux!.suivreValidDonnées({
        idTableau,
        f: (erreurs) => {
          info.erreurs = erreurs;
          fFinaleBranche();
        },
      });

      const fOublierColonnes =
        await this.client.tableaux!.suivreColonnesTableau({
          idTableau,
          f: (cols) => {
            info.cols = cols;
            fFinaleBranche();
          },
        });

      return async () => {
        await fOublierDonnées();
        await fOublierErreurs();
        await fOublierColonnes();
      };
    };

    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd({
        idBd,
        f: (tableaux) => fSuivreRacine(tableaux.map((t) => t.id)),
      });
    };

    return await this.client.suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  @cacheSuivi
  async suivreQualitéBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<infoScore>;
  }): Promise<schémaFonctionOublier> {
    const info: {
      accès?: number;
      couverture?: number;
      valide?: number;
      licence?: number;
    } = {};

    const fFinale = async () => {
      const { accès, couverture, valide, licence } = info;
      const score: infoScore = {
        // Score impitoyable de 0 pour BDs sans licence
        total: licence
          ? ((accès || 0) + (couverture || 0) + (valide || 0)) / 3
          : 0,
        accès,
        couverture,
        valide,
        licence,
      };
      await f(score);
    };

    const oublierAccès = await this.suivreScoreAccèsBd({
      idBd,
      f: (accès) => {
        info.accès = accès;
        fFinale();
      },
    });
    const oublierCouverture = await this.suivreScoreCouvertureBd({
      idBd,
      f: (couverture) => {
        info.couverture = couverture;
        fFinale();
      },
    });
    const oublierValide = await this.suivreScoreValideBd({
      idBd,
      f: (valide) => {
        info.valide = valide;
        fFinale();
      },
    });

    const oublierLicence = await this.suivreLicenceBd({
      idBd,
      f: (licence) => (info.licence = licence ? 1 : 0),
    });
    return async () => {
      await Promise.all([
        oublierAccès,
        oublierCouverture,
        oublierValide,
        oublierLicence,
      ]);
    };
  }

  @cacheSuivi
  async suivreVariablesBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (variables?: string[]) => {
      return await f(variables || []);
    };

    const fBranche = async (
      id: string,
      f: schémaFonctionSuivi<string[]>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.tableaux!.suivreVariables({ idTableau: id, f });
    };

    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd({
        idBd,
        f: (x) => fSuivreRacine(x.map((x) => x.id)),
      });
    };

    return await this.client.suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  async exporterDonnées({
    idBd,
    langues,
    nomFichier,
  }: {
    idBd: string;
    langues?: string[];
    nomFichier?: string;
  }): Promise<donnéesBdExportées> {
    const doc = utils.book_new();
    const fichiersSFIP: Set<{ cid: string; ext: string }> = new Set();

    const infosTableaux = await uneFois(
      (f: schémaFonctionSuivi<infoTableauAvecId[]>) =>
        this.suivreTableauxBd({ idBd, f })
    );

    for (const tableau of infosTableaux) {
      const { id: idTableau } = tableau;
      const { fichiersSFIP: fichiersSFIPTableau } =
        await this.client.tableaux!.exporterDonnées({
          idTableau,
          langues,
          doc,
        });
      fichiersSFIPTableau.forEach((f: { cid: string; ext: string }) =>
        fichiersSFIP.add(f)
      );
    }

    if (!nomFichier) {
      const nomsBd = await uneFois(
        (f: schémaFonctionSuivi<{ [key: string]: string }>) =>
          this.suivreNomsBd({ idBd, f })
      );
      const idCourt = idBd.split("/").pop()!;

      nomFichier = langues ? traduire(nomsBd, langues) || idCourt : idCourt;
    }

    return { doc, fichiersSFIP, nomFichier };
  }

  async exporterDocumentDonnées({
    données,
    formatDoc,
    dossier = "",
    inclureFichiersSFIP = true,
  }: {
    données: donnéesBdExportées;
    formatDoc: BookType | "xls";
    dossier?: string;
    inclureFichiersSFIP?: boolean;
  }): Promise<string> {
    const { doc, fichiersSFIP, nomFichier } = données;

    const conversionsTypes: { [key: string]: BookType } = {
      xls: "biff8",
    };
    const bookType: BookType = conversionsTypes[formatDoc] || formatDoc;

    // Créer le dossier si nécessaire. Sinon, xlsx n'écrit rien, et ce, sans se plaindre.
    if (!(isBrowser || isWebWorker)) {
      const fs = await import("fs");
      if (!fs.existsSync(dossier)) {
        // Mais juste si on n'est pas dans le navigateur ! Dans le navigateur, ça télécharge sans problème.
        fs.mkdirSync(dossier, { recursive: true });
      }
    }

    if (inclureFichiersSFIP) {
      const fichierDoc = {
        octets: writeXLSX(doc, { bookType, type: "buffer" }),
        nom: `${nomFichier}.${formatDoc}`,
      };
      const fichiersDeSFIP = await Promise.all(
        [...fichiersSFIP].map(async (fichier) => {
          return {
            nom: `${fichier.cid}.${fichier.ext}`,
            octets: await toBuffer(
              this.client.obtItérableAsyncSFIP({ id: fichier.cid })
            ),
          };
        })
      );
      await zipper(
        [fichierDoc],
        fichiersDeSFIP,
        path.join(dossier, nomFichier)
      );
      return path.join(dossier, `${nomFichier}.zip`);
    } else {
      writeFile(doc, path.join(dossier, `${nomFichier}.${formatDoc}`), {
        bookType,
      });
      return path.join(dossier, `${nomFichier}.${formatDoc}`);
    }
  }

  async effacerBd({ idBd }: { idBd: string }): Promise<void> {
    // D'abord effacer l'entrée dans notre liste de BDs
    const { bd: bdRacine, fOublier } = await this.client.ouvrirBd<string>({
      id: await this.obtIdBd(),
      type: "feed",
    });
    await this.client.effacerÉlémentDeBdListe({ bd: bdRacine, élément: idBd });
    await fOublier();

    // Et puis maintenant aussi effacer les données et la BD elle-même
    for (const clef in ["noms", "descriptions", "motsClefs"]) {
      const idSousBd = await this.client.obtIdBd({
        nom: clef,
        racine: idBd,
      });
      if (idSousBd) await this.client.effacerBd({ id: idSousBd });
    }
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: idBd,
      type: "kvstore",
    });
    if (idBdTableaux) {
      const { bd: bdTableaux, fOublier: fOublierTableaux } =
        await this.client.ouvrirBd<infoTableau>({
          id: idBdTableaux,
          type: "keyvalue",
        });
      const tableaux: string[] = Object.keys(bdTableaux.all);
      for (const t of tableaux) {
        await this.client.tableaux!.effacerTableau({ idTableau: t });
      }
      fOublierTableaux();
      await this.client.effacerBd({ id: idBdTableaux });
    }

    await this.enleverDeMesBds({ idBd });
    await this.client.effacerBd({ id: idBd });
  }
}
