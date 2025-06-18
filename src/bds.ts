import path from "path";
import {
  attendreStabilité,
  suivreFonctionImbriquée,
  suivreDeFonctionListe,
  faisRien,
  ignorerNonDéfinis,
  traduire,
  uneFois,
  zipper,
  idcValide,
  adresseOrbiteValide,
} from "@constl/utils-ipa";
import toBuffer from "it-to-buffer";
import { v4 as uuidv4 } from "uuid";
import { isBrowser, isElectronMain, isNode, isWebWorker } from "wherearewe";
import xlsx, {
  utils as xlsxUtils,
  write as xlsxWrite,
  writeFile as xlsxWriteFile,
} from "xlsx";

import { Semaphore } from "@chriscdn/promise-semaphore";
import pkg from "file-saver";
import { cacheSuivi } from "@/décorateursCache.js";
import {
  type InfoColAvecCatégorie,
  différenceTableaux,
  donnéesTableauExportation,
  élémentBdListeDonnées,
  élémentDonnées,
} from "@/tableaux.js";
import {
  RecursivePartial,
  TraducsNom,
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaStatut,
  élémentsBd,
} from "@/types.js";

import { ContrôleurConstellation as générerContrôleurConstellation } from "@/accès/cntrlConstellation.js";
import { Constellation } from "@/client.js";
import { ComposanteClientListe } from "@/services.js";
import { INSTALLÉ, TOUS, résoudreDéfauts } from "./favoris.js";
import type { ÉpingleBd, ÉpingleFavorisAvecId } from "./favoris.js";
import type { objRôles } from "@/accès/types.js";
import type { JSONSchemaType } from "ajv";
import type { erreurValidation, règleColonne, règleExiste } from "@/valid.js";

const { saveAs } = pkg;

type ContrôleurConstellation = Awaited<
  ReturnType<ReturnType<typeof générerContrôleurConstellation>>
>;

export interface schémaSpécificationBd {
  licence: string;
  licenceContenu?: string;
  métadonnées?: string;
  motsClefs?: string[];
  nuées?: string[];
  statut?: schémaStatut;
  tableaux: {
    cols: {
      idColonne: string;
      idVariable?: string;
      index?: boolean;
      optionnelle?: boolean;
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

export type donnéesBdExportation = {
  nomBd: string;
  tableaux: donnéesTableauExportation[];
};

export interface donnéesBdExportées {
  doc: xlsx.WorkBook;
  fichiersSFIP: Set<string>;
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
  métadonnées: {[clef: string]: élémentsBd};
  noms: TraducsNom;
  descriptions: TraducsNom;
  tableaux: string;
  motsClefs: string;
  nuées: string;
  statut: schémaStatut;
  copiéDe?: schémaCopiéDe;
};
const schémaStructureBdBd: JSONSchemaType<Partial<structureBdBd>> = {
  type: "object",
  properties: {
    type: { type: "string", nullable: true },
    métadonnées: { type: "object",oneOf:[], additionalProperties: {
    }, required: [], nullable: true },
    licence: { type: "string", nullable: true },
    licenceContenu: { type: "string", nullable: true },
    image: { type: "string", nullable: true },
    noms: { type: "object", additionalProperties: {
      type: "string",
    }, required: [], nullable: true },
    descriptions: { type: "object", additionalProperties: {
      type: "string",
    }, required: [], nullable: true },
    tableaux: { type: "string", nullable: true },
    motsClefs: { type: "string", nullable: true },
    nuées: { type: "string", nullable: true },
    statut: {
      type: "object",
      properties: {
        statut: { type: "string" },
        idNouvelle: { type: "string", nullable: true },
      },
      required: ["statut"],
      nullable: true 
    },
    copiéDe: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      nullable: true,
    },
  },
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
  T extends différenceTableaux = différenceTableaux,
> = {
  type: "tableau";
  sévère: T["sévère"];
  idTableau: string;
  différence: T;
};

export type infoTableauAvecId = { clef: string; id: string };

export const schémaInfoTableau: JSONSchemaType<{ clef: string }> = {
  type: "object",
  properties: {
    clef: { type: "string" },
  },
  required: ["clef"],
};
export const schémaBdTableauxDeBd: JSONSchemaType<{
  [idTableau: string]: { clef: string };
}> = {
  type: "object",
  additionalProperties: schémaInfoTableau,
  required: [],
};

const schémaBdPrincipale: JSONSchemaType<string> = { type: "string" };
const schémaStructureBdMotsClefs: JSONSchemaType<string> = { type: "string" };
const schémaStructureBdNuées: JSONSchemaType<string> = { type: "string" };

export const MAX_TAILLE_IMAGE = 500 * 1000; // 500 kilooctets
export const MAX_TAILLE_IMAGE_VIS = 1500 * 1000; // 1,5 megaoctets

export class BDs extends ComposanteClientListe<string> {
  verrouBdUnique: Semaphore;

  constructor({ client }: { client: Constellation }) {
    super({ client, clef: "bds", schémaBdPrincipale });
    this.verrouBdUnique = new Semaphore();
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisAvecId<ÉpingleBd>;
    f: schémaFonctionSuivi<Set<string>>;
  }): Promise<schémaFonctionOublier> {
    const épinglerBase = await this.client.favoris.estÉpingléSurDispositif({
      dispositifs: épingle.épingle.base || "TOUS",
    });
    const épinglerDonnées = await this.client.favoris.estÉpingléSurDispositif({
      dispositifs: épingle.épingle.données?.tableaux || "TOUS",
    });
    const épinglerFichiersDonnées =
      await this.client.favoris.estÉpingléSurDispositif({
        dispositifs: épingle.épingle.données?.fichiers || "INSTALLÉ",
      });
    const info: {
      base?: (string | undefined)[];
      données?: (string | undefined)[];
      fichiersDonnées?: (string | undefined)[];
    } = {};
    const fFinale = async () => {
      return await f(
        new Set(
          Object.values(info)
            .flat()
            .filter((x) => !!x) as string[],
        ),
      );
    };

    const fsOublier: schémaFonctionOublier[] = [];
    if (épinglerBase) {
      const fOublierBase = await this.client.suivreBd({
        id: épingle.idObjet,
        type: "nested",
        schéma: schémaStructureBdBd,
        f: async (bd) => {
          try {
            const contenuBd = await bd.allAsJSON();
            if (épinglerBase)
              info.base = [
                épingle.idObjet,
                contenuBd.tableaux,
                contenuBd.motsClefs,
                contenuBd.nuées,
                contenuBd.image,
              ];
          } catch {
            return; // Si la structure n'est pas valide.
          }
          await fFinale();
        },
      });
      fsOublier.push(fOublierBase);
    }

    if (épinglerDonnées) {
      const fOublierTableaux = await this.suivreTableauxBd({
        idBd: épingle.idObjet,
        f: async (tableaux) => {
          info.données = tableaux.map((t) => t.id);
          await fFinale();
        },
      });
      fsOublier.push(fOublierTableaux);
    }
    if (épinglerFichiersDonnées) {
      const fOublierDonnées = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (éléments: string[]) => Promise<void>;
        }) => {
          return await this.suivreTableauxBd({
            idBd: épingle.idObjet,
            f: (tableaux) => fSuivreRacine(tableaux.map((t) => t.id)),
          });
        },
        fBranche: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: schémaFonctionSuivi<
            élémentDonnées<élémentBdListeDonnées>[]
          >;
        }) => {
          return await this.client.tableaux.suivreDonnées({
            idTableau: id,
            f: fSuivreBranche,
          });
        },
        f: async (données: élémentDonnées<élémentBdListeDonnées>[]) => {
          const idcs = données
            .map((file) =>
              Object.values(file.données).filter((x) => idcValide(x)),
            )
            .flat() as string[];
          info.fichiersDonnées = idcs;
          await fFinale();
        },
      });
      fsOublier.push(fOublierDonnées);
    }

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
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
    épingler = true,
  }: {
    licence: string;
    licenceContenu?: string;
    épingler?: boolean;
  }): Promise<string> {
    const idBd = await this.client.créerBdIndépendante({
      type: "nested",
      optionsAccès: {
        address: undefined,
        write: await this.client.obtIdCompte(),
      },
    });
    if (épingler) await this.épinglerBd({ idBd });

    const { bd: bdBD, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    await bdBD.putNested({type: "bd", licence, licenceContenu});

    const accès = bdBD.access as ContrôleurConstellation;
    const optionsAccès = { write: accès.address };

    const idBdTableaux = await this.client.créerBdIndépendante({
      type: "ordered-keyvalue",
      optionsAccès,
    });
    await bdBD.set("tableaux", idBdTableaux);

    const idBdMotsClefs = await this.client.créerBdIndépendante({
      type: "set",
      optionsAccès,
    });
    await bdBD.set("motsClefs", idBdMotsClefs);

    const idBdNuées = await this.client.créerBdIndépendante({
      type: "set",
      optionsAccès,
    });
    await bdBD.set("nuées", idBdNuées);

    await bdBD.set("statut", { statut: "active" });

    const { bd: bdRacine, fOublier: fOublierRacine } =
      await this.client.ouvrirBdTypée({
        id: await this.obtIdBd(),
        type: "set",
        schéma: schémaBdPrincipale,
      });
    await bdRacine.add(idBd);
    fOublierRacine();

    await fOublier();

    return idBd;
  }

  async créerBdDeNuée({
    idNuée,
    licence,
    licenceContenu,
    épingler = true,
  }: {
    idNuée: string;
    licence: string;
    licenceContenu?: string;
    épingler?: boolean;
  }): Promise<string> {
    const schéma = await this.client.nuées.générerSchémaBdNuée({
      idNuée,
      licence,
      licenceContenu,
    });
    return await this.créerBdDeSchéma({ schéma, épingler });
  }

  async ajouterÀMesBds({ idBd }: { idBd: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: await this.obtIdBd(),
      type: "set",
      schéma: schémaBdPrincipale,
    });
    await bd.add(idBd);
    await fOublier();
  }

  async enleverDeMesBds({ idBd }: { idBd: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: await this.obtIdBd(),
      type: "set",
      schéma: schémaBdPrincipale,
    });
    await bd.del(idBd);
    await fOublier();
  }

  async épinglerBd({
    idBd,
    options = {},
  }: {
    idBd: string;
    options?: RecursivePartial<ÉpingleBd>;
  }) {
    const épingle: ÉpingleBd = résoudreDéfauts(options, {
      type: "bd",
      base: TOUS,
      données: {
        tableaux: TOUS,
        fichiers: INSTALLÉ,
      },
    });
    await this.client.favoris.épinglerFavori({ idObjet: idBd, épingle });
  }

  async suivreÉpingleBd({
    idBd,
    f,
    idCompte,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<ÉpingleBd | undefined>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.client.favoris.suivreÉtatFavori({
      idObjet: idBd,
      f: async (épingle) => {
        if (épingle?.type === "bd") await f(épingle);
        else await f(undefined);
      },
      idCompte,
    });
  }

  async copierBd({
    idBd,
    copierDonnées = true,
  }: {
    idBd: string;
    copierDonnées?: boolean;
  }): Promise<string> {
    const { bd: bdBase, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    const licence = await bdBase.get("licence");
    const licenceContenu = await bdBase.get("licenceContenu");
    if (!licence)
      throw new Error(`Aucune licence trouvée sur la BD source ${idBd}.`);
    const idNouvelleBd = await this.créerBd({
      licence,
      licenceContenu,
    });
    const { bd: nouvelleBd, fOublier: fOublierNouvelle } =
      await this.client.ouvrirBdTypée({
        id: idNouvelleBd,
        type: "nested",
        schéma: schémaStructureBdBd,
      });

    const métadonnées = await bdBase.get("métadonnées");
    if (métadonnées) {    
      await this.sauvegarderMétadonnéesBd({ idBd: idNouvelleBd, métadonnées });
    }

    const noms = await bdBase.get("noms");
    if (noms) {
      await this.sauvegarderNomsBd({ idBd: idNouvelleBd, noms });
    }

    const descriptions = await bdBase.get("descriptions");
    if (descriptions) {
      await this.sauvegarderDescriptionsBd({
        idBd: idNouvelleBd,
        descriptions,
      });
    }

    const idBdMotsClefs = await bdBase.get("motsClefs");
    if (idBdMotsClefs) {
      const { bd: bdMotsClefs, fOublier: fOublierBdMotsClefs } =
        await this.client.ouvrirBdTypée({
          id: idBdMotsClefs,
          type: "set",
          schéma: schémaStructureBdMotsClefs,
        });
      const motsClefs = (await bdMotsClefs.all()).map((x) => x.value);
      await fOublierBdMotsClefs();
      await this.ajouterMotsClefsBd({
        idBd: idNouvelleBd,
        idsMotsClefs: motsClefs,
      });
    }

    const idBdNuées = await bdBase.get("nuées");
    if (idBdNuées) {
      const { bd: bdNuées, fOublier: fOublierBdNuées } =
        await this.client.ouvrirBdTypée({
          id: idBdNuées,
          type: "set",
          schéma: schémaStructureBdNuées,
        });
      const nuées = (await bdNuées.all()).map((x) => x.value);
      await fOublierBdNuées();
      await this.rejoindreNuées({
        idBd: idNouvelleBd,
        idsNuées: nuées,
      });
    }

    const idBdTableaux = await bdBase.get("tableaux");
    const idNouvelleBdTableaux = await nouvelleBd.get("tableaux");
    if (!idNouvelleBdTableaux) throw new Error("Erreur d'initialisation.");

    const { bd: nouvelleBdTableaux, fOublier: fOublierNouvelleTableaux } =
      await this.client.ouvrirBdTypée({
        id: idNouvelleBdTableaux,
        type: "ordered-keyvalue",
        schéma: schémaBdTableauxDeBd,
      });
    if (idBdTableaux) {
      const { bd: bdTableaux, fOublier: fOublierBdTableaux } =
        await this.client.ouvrirBdTypée({
          id: idBdTableaux,
          type: "ordered-keyvalue",
          schéma: schémaBdTableauxDeBd,
        });
      const tableaux = await bdTableaux.all();

      await fOublierBdTableaux();
      for (const { key: idTableau, value: tableau } of tableaux) {
        const idNouveauTableau: string =
          await this.client.tableaux.copierTableau({
            id: idTableau,
            idBd: idNouvelleBd,
            copierDonnées,
          });
        await nouvelleBdTableaux.set(idNouveauTableau, tableau);
      }
    }

    const statut = (await bdBase.get("statut")) || {
      statut: "active",
    };
    await nouvelleBd.set("statut", statut);

    const image = await bdBase.get("image");
    if (image) await nouvelleBd.set("image", image);

    await nouvelleBd.set("copiéDe", { id: idBd });

    await Promise.allSettled([
      fOublier(),
      fOublierNouvelleTableaux(),
      fOublierNouvelle(),
    ]);
    return idNouvelleBd;
  }

  async créerBdDeSchéma({
    schéma,
    épingler,
  }: {
    schéma: schémaSpécificationBd;
    épingler?: boolean;
  }): Promise<string> {
    const { tableaux, motsClefs, nuées, licence, licenceContenu, statut } =
      schéma;

    // On n'ajoutera la BD que lorsqu'elle sera prête
    const idBd = await this.créerBd({
      licence,
      licenceContenu,
      épingler,
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
        const { idColonne, idVariable, index, optionnelle } = c;
        await this.client.tableaux.ajouterColonneTableau({
          idTableau,
          idVariable,
          idColonne,
        });
        if (index) {
          await this.client.tableaux.changerColIndex({
            idTableau,
            idColonne,
            val: true,
          });
        }
        if (!optionnelle) {
          const règle: règleExiste = {
            typeRègle: "existe",
            détails: {},
          };
          await this.client.tableaux.ajouterRègleTableau({
            idTableau,
            idColonne,
            règle,
          });
        }
      }
    }

    return idBd;
  }

  async _confirmerPermission({ idBd }: { idBd: string }): Promise<void> {
    if (!(await this.client.permission({ idObjet: idBd })))
      throw new Error(`Permission de modification refusée pour la BD ${idBd}.`);
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
        const copiéDe = await bd.get("copiéDe");
        await f(copiéDe);
      },
      type: "nested",
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
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreBds({ f: fSuivreRacine, idCompte });
    };

    const fCondition = async (
      id: string,
      fSuivreCondition: (état: boolean) => void,
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
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreBds({ f: fSuivreRacine, idCompte });
    };

    const fCondition = async (
      id: string,
      fSuivreCondition: (état: boolean) => void,
    ): Promise<schémaFonctionOublier> => {
      const fFinaleSuivreCondition = async (nuéesBd?: string[]) => {
        fSuivreCondition(!!nuéesBd && nuéesBd.includes(idNuée));
      };
      return await this.suivreNuéesBd({
        idBd: id,
        f: fFinaleSuivreCondition,
      });
    };
    return await this.client.suivreBdsSelonCondition({ fListe, fCondition, f });
  }

  async combinerBds({
    idBdBase,
    idBd2,
    patience = 100,
  }: {
    idBdBase: string;
    idBd2: string;
    patience?: number;
  }): Promise<void> {
    const obtTableaux = async (idBd: string): Promise<infoTableauAvecId[]> => {
      return await uneFois(
        async (
          fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>,
        ): Promise<schémaFonctionOublier> => {
          return await this.suivreTableauxBd({ idBd, f: fSuivi });
        },
        attendreStabilité(patience),
      );
    };

    const tableauxBase = await obtTableaux(idBdBase);
    const tableauxBd2 = await obtTableaux(idBd2);

    for (const info of tableauxBd2) {
      const { id: idTableau, clef } = info;
      if (clef) {
        const idTableauBaseCorresp = tableauxBase.find(
          (t) => t.clef === clef,
        )?.id;

        if (idTableauBaseCorresp) {
          await this.client.tableaux.combinerDonnées({
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
  async suivreClefTableauParId({
    idBd,
    idTableau,
    f,
  }: {
    idBd: string;
    idTableau: string;
    f: schémaFonctionSuivi<string | undefined>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (tableaux: infoTableauAvecId[]) => {
      const infoTableau = tableaux.find((t) => t.id === idTableau);
      await f(infoTableau?.clef);
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
      try {
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
      } finally {
        this.verrouBdUnique.release(idNuéeUnique);
      }
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
    return await suivreFonctionImbriquée<string>({
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
      return await this.client.tableaux.suivreDonnées({
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

    return await suivreFonctionImbriquée({
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
    vals: T | T[];
  }): Promise<string[]> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClefDeBdUnique({
          schémaBd,
          idNuéeUnique,
          clefTableau,
          f: ignorerNonDéfinis(fSuivi),
        });
      },
    );
    return await this.client.tableaux.ajouterÉlément({
      idTableau: idTableau,
      vals,
    });
  }

  async modifierÉlémentDeTableauUnique({
    vals,
    schémaBd,
    idNuéeUnique,
    clefTableau,
    idÉlément,
  }: {
    vals: { [key: string]: élémentsBd | undefined };
    schémaBd: schémaSpécificationBd;
    idNuéeUnique: string;
    clefTableau: string;
    idÉlément: string;
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
      (x) => !!x,
    );

    return await this.client.tableaux.modifierÉlément({
      idTableau: idTableau,
      vals,
      idÉlément,
    });
  }

  async effacerÉlémentDeTableauUnique({
    schémaBd,
    idNuéeUnique,
    clefTableau,
    idÉlément,
  }: {
    schémaBd: schémaSpécificationBd;
    idNuéeUnique: string;
    clefTableau: string;
    idÉlément: string;
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
      (x) => !!x,
    );

    return await this.client.tableaux.effacerÉlément({
      idTableau: idTableau,
      idÉlément,
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
      (x) => !!x,
    );
    return await this.client.tableaux.suivreDonnées({
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
    vals: T | T[];
  }): Promise<string[]> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClef({
          idBd,
          clef: clefTableau,
          f: ignorerNonDéfinis(fSuivi),
        });
      },
    );
    return await this.client.tableaux.ajouterÉlément({
      idTableau,
      vals,
    });
  }

  async modifierÉlémentDeTableauParClef({
    idBd,
    clefTableau,
    idÉlément,
    vals,
  }: {
    idBd: string;
    clefTableau: string;
    idÉlément: string;
    vals: { [key: string]: élémentsBd | undefined };
  }): Promise<void> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClef({
          idBd,
          clef: clefTableau,
          f: ignorerNonDéfinis(fSuivi),
        });
      },
    );
    return await this.client.tableaux.modifierÉlément({
      idTableau,
      vals,
      idÉlément,
    });
  }

  async effacerÉlémentDeTableauParClef({
    idBd,
    clefTableau,
    idÉlément,
  }: {
    idBd: string;
    clefTableau: string;
    idÉlément: string;
  }): Promise<void> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClef({
          idBd,
          clef: clefTableau,
          f: ignorerNonDéfinis(fSuivi),
        });
      },
    );
    this.client.tableaux.effacerÉlément({
      idTableau,
      idÉlément,
    });
  }

  async sauvegarderMétadonnéesBd({
    idBd,
    métadonnées,
  }: {
    idBd: string;
    métadonnées: { [key: string]: élémentsBd };
  }): Promise<void> {
    await this._confirmerPermission({ idBd });

    const { bd: bdBd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    await bdBd.set(`métadonnées`, métadonnées);
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
    await this._confirmerPermission({ idBd });
    const { bd: bdBd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    await bdBd.set(`métadonnées/${clef}`, métadonnée);
    await fOublier();
  }

  async effacerMétadonnéeBd({
    idBd,
    clef,
  }: {
    idBd: string;
    clef: string;
  }): Promise<void> {
    await this._confirmerPermission({ idBd });

    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    await bd.del(`métadonnées/${clef}`);
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
    return await this.client.suivreBd({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
      f: async bd => {
        await f(await bd.get("métadonnées") || {})
      },
    });
  }

  async sauvegarderNomsBd({
    idBd,
    noms,
  }: {
    idBd: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    await this._confirmerPermission({ idBd });

    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });

    await bd.putNested("noms", noms);
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
    await this._confirmerPermission({ idBd });
    
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    await bd.set(`noms/${langue}`, nom);
    await fOublier();
  }

  async effacerNomBd({
    idBd,
    langue,
  }: {
    idBd: string;
    langue: string;
  }): Promise<void> {
    await this._confirmerPermission({ idBd });

    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    await bd.del(`noms/${langue}`);
    await fOublier();
  }

  async sauvegarderDescriptionsBd({
    idBd,
    descriptions,
  }: {
    idBd: string;
    descriptions: { [key: string]: string };
  }): Promise<void> {
    await this._confirmerPermission({ idBd });
    const { bd: bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    await bd.putNested("descriptions", descriptions);
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
    await this._confirmerPermission({ idBd });

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    await bdDescr.set(`descriptions/${langue}`, description);
    await fOublier();
  }

  async effacerDescriptionBd({
    idBd,
    langue,
  }: {
    idBd: string;
    langue: string;
  }): Promise<void> {
    await this._confirmerPermission({ idBd });

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    await bdDescr.del(`descriptions/${langue}`);
    await fOublier();
  }

  async changerLicenceBd({
    idBd,
    licence,
  }: {
    idBd: string;
    licence: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    await bd.set("licence", licence);
    await fOublier();
  }

  async changerLicenceContenuBd({
    idBd,
    licenceContenu,
  }: {
    idBd: string;
    licenceContenu?: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    if (licenceContenu) {
      await bd.set("licenceContenu", licenceContenu);
    } else {
      await bd.del("licenceContenu");
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
    await this._confirmerPermission({ idBd });
    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];
    const idBdMotsClefs = await this.client.obtIdBd({
      nom: "motsClefs",
      racine: idBd,
      type: "set",
    });

    const { bd: bdMotsClefs, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdMotsClefs,
      type: "set",
      schéma: schémaStructureBdMotsClefs,
    });
    for (const id of idsMotsClefs) {
      const motsClefsExistants = (await bdMotsClefs.all()).map((x) => x.value);
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
    await this._confirmerPermission({ idBd });
    const idBdMotsClefs = await this.client.obtIdBd({
      nom: "motsClefs",
      racine: idBd,
      type: "set",
    });

    const { bd: bdMotsClefs, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdMotsClefs,
      type: "set",
      schéma: schémaStructureBdMotsClefs,
    });

    await bdMotsClefs.del(idMotClef);

    await fOublier();
  }

  async rejoindreNuées({
    idBd,
    idsNuées,
  }: {
    idBd: string;
    idsNuées: string | string[];
  }): Promise<void> {
    await this._confirmerPermission({ idBd });
    if (!Array.isArray(idsNuées)) idsNuées = [idsNuées];
    const idBdNuées = await this.client.obtIdBd({
      nom: "nuées",
      racine: idBd,
      type: "set",
    });

    const { bd: bdNuées, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdNuées,
      type: "set",
      schéma: schémaStructureBdNuées,
    });
    for (const id of idsNuées) {
      const nuéesExistantes = (await bdNuées.all()).map((x) => x.value);
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
    await this._confirmerPermission({ idBd });
    const idBdNuées = await this.client.obtIdBd({
      nom: "nuée",
      racine: idBd,
      type: "set",
    });

    const { bd: bdNuées, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdNuées,
      type: "set",
      schéma: schémaStructureBdNuées,
    });

    await bdNuées.del(idNuée);

    await fOublier();
  }

  async réordonnerTableauBd({
    idBd,
    idTableau,
    position,
  }: {
    idBd: string;
    idTableau: string;
    position: number;
  }): Promise<void> {
    await this._confirmerPermission({ idBd });
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: idBd,
      type: "ordered-keyvalue",
    });

    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdTableaux,
      type: "ordered-keyvalue",
      schéma: schémaBdTableauxDeBd,
    });

    const tableauxExistants = await bdTableaux.all();
    const positionExistante = tableauxExistants.findIndex(
      (t) => t.key === idTableau,
    );
    if (position !== positionExistante)
      await bdTableaux.move(idTableau, position);
    await fOublier();
  }

  async ajouterTableauBd({
    idBd,
    clefTableau,
  }: {
    idBd: string;
    clefTableau?: string;
  }): Promise<string> {
    await this._confirmerPermission({ idBd });
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: idBd,
      type: "ordered-keyvalue",
    });

    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdTableaux,
      type: "ordered-keyvalue",
      schéma: schémaBdTableauxDeBd,
    });

    clefTableau = clefTableau || uuidv4();
    const idTableau = await this.client.tableaux.créerTableau({ idBd });
    await bdTableaux.set(idTableau, {
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
    await this._confirmerPermission({ idBd });

    // D'abord effacer l'entrée dans notre liste de tableaux
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: idBd,
      type: "ordered-keyvalue",
    });

    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdTableaux,
      type: "ordered-keyvalue",
      schéma: schémaBdTableauxDeBd,
    });
    await bdTableaux.del(idTableau);
    await fOublier();

    // Enfin, effacer les données et le tableau lui-même
    await this.client.tableaux.effacerTableau({ idTableau });
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
      type: "ordered-keyvalue",
    });
    if (!idBdTableaux) throw new Error("Id Bd Tableau non obtenable.");
    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdTableaux,
      type: "ordered-keyvalue",
      schéma: schémaBdTableauxDeBd,
    });

    const infoExistante = await bdTableaux.get(idTableau);
    if (infoExistante) {
      infoExistante.value.clef = clef;
      bdTableaux.set(idTableau, infoExistante.value);
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
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
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
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    bd.set("statut", { statut: "obsolète", idNouvelle });
    await fOublier();
  }

  async marquerActive({ idBd }: { idBd: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    bd.set("statut", { statut: "active" });
    await fOublier();
  }

  async marquerJouet({ idBd }: { idBd: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    bd.set("statut", { statut: "jouet" });
    await fOublier();
  }

  async marquerInterne({ idBd }: { idBd: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    bd.set("statut", { statut: "interne" });
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
      type: "nested",
      schéma: schémaStructureBdBd,
      f: async (bd) => {
        const licence = await bd.get("licence");
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
      type: "nested",
      schéma: schémaStructureBdBd,
      f: async (bd) => {
        const licenceContenu = await bd.get("licenceContenu");
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
    image: { contenu: Uint8Array; nomFichier: string };
  }): Promise<void> {
    if (image.contenu.byteLength > MAX_TAILLE_IMAGE) {
      throw new Error("Taille maximale excédée");
    }
    const idImage = await this.client.ajouterÀSFIP(image);
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    await bd.set("image", idImage);
    await fOublier();
  }

  async effacerImage({ idBd }: { idBd: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
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
    f: schémaFonctionSuivi<{ image: Uint8Array; idImage: string } | null>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
      f: async (bd) => {
        const idImage = await bd.get("image");
        if (!idImage) {
          await f(null);
        } else {
          const image = await this.client.obtFichierSFIP({
            id: idImage,
            max: MAX_TAILLE_IMAGE_VIS,
          });
          await f(image ? { image, idImage: idImage } : null);
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
    const noms: {
      deNuées: TraducsNom[];
      deBd: TraducsNom;
    } = { deNuées: [], deBd: {} };
    const fFinale = async () => {
      const nomsFinaux = {};
      for (const source of [...noms.deNuées, noms.deBd]) {
        Object.assign(nomsFinaux, source);
      }
      return await f(nomsFinaux);
    };
    const constl = this.client;
    const fOublierNomsNuées = await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (éléments: string[]) => Promise<void>;
      }) => {
        return await constl.bds.suivreNuéesBd({ idBd, f: fSuivreRacine });
      },
      fBranche: async ({
        id: idNuée,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: schémaFonctionSuivi<TraducsNom>;
      }): Promise<schémaFonctionOublier> => {
        return await constl.nuées.suivreNomsNuée({ idNuée, f: fSuivreBranche });
      },
      f: async (nomsNuées: TraducsNom[]) => {
        noms.deNuées = nomsNuées;
        await fFinale();
      },
    });
    const fOublierNomsBd = await this.client.suivreBd({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
      f: async (bd) => {
        noms.deBd = await bd.get("noms") || {};
        await fFinale();
      },
    });
    return async () => {
      await Promise.allSettled([fOublierNomsBd(), fOublierNomsNuées()]);
    };
  }

  @cacheSuivi
  async suivreDescriptionsBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
      f: async bd => {
        await f(await bd.get("descriptions") || {})
      },
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
    const motsClefs: { deNuées?: string[][]; deBd?: string[] } = {};
    const fFinale = async () => {
      const motsClefsFinaux = [...new Set(motsClefs.deNuées?.flat() || [])];
      for (const motClef of motsClefs.deBd || []) {
        if (!motsClefsFinaux.includes(motClef)) motsClefsFinaux.push(motClef);
      }

      return await f(motsClefsFinaux);
    };
    const constl = this.client;
    const fOublierMotsClefsNuées = await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (éléments: string[]) => Promise<void>;
      }) => {
        return await constl.bds.suivreNuéesBd({ idBd, f: fSuivreRacine });
      },
      fBranche: async ({
        id: idNuée,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: schémaFonctionSuivi<string[]>;
      }): Promise<schémaFonctionOublier> => {
        return await constl.nuées.suivreMotsClefsNuée({
          idNuée,
          f: fSuivreBranche,
        });
      },
      f: async (motsClefsNuées: string[][]) => {
        motsClefs.deNuées = motsClefsNuées;
        await fFinale();
      },
    });
    const fOublierMotsClefsBd = await this.client.suivreBdListeDeClef({
      id: idBd,
      clef: "motsClefs",
      schéma: { type: "string" },
      f: async (motsClefsBd: string[]) => {
        motsClefs.deBd = motsClefsBd;
        await fFinale();
      },
    });

    return async () => {
      await Promise.allSettled([
        fOublierMotsClefsBd(),
        fOublierMotsClefsNuées(),
      ]);
    };
  }

  @cacheSuivi
  async suivreTableauxBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<infoTableauAvecId[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (
      infos: { key: string; value: { clef: string } }[],
    ) => {
      const tableaux: infoTableauAvecId[] = infos.map((info) => {
        return {
          id: info.key,
          ...info.value,
        };
      });
      await f(tableaux);
    };

    return await this.client.suivreBdDicOrdonnéeDeClef({
      id: idBd,
      clef: "tableaux",
      schéma: schémaBdTableauxDeBd,
      f: fFinale,
    });
  }

  @cacheSuivi
  async suivreNomsTableau({
    idBd,
    idTableau,
    f,
  }: {
    idBd: string;
    idTableau: string;
    f: schémaFonctionSuivi<TraducsNom>;
  }): Promise<schémaFonctionOublier> {
    const noms: {
      deTableau: TraducsNom;
      deNuées: TraducsNom[];
    } = {
      deNuées: [],
      deTableau: {},
    };
    const fFinale = async () =>
      await f(Object.assign({}, ...noms.deNuées, noms.deTableau));
    const fOublierTableau = await this.client.tableaux.suivreNomsTableau({
      idTableau,
      f: async (nomsTableau) => {
        noms.deTableau = nomsTableau;
        await fFinale();
      },
    });

    const fOublierNuée = await suivreFonctionImbriquée({
      fRacine: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: schémaFonctionSuivi<string | undefined>;
      }) => {
        return await this.suivreClefTableauParId({
          idBd,
          idTableau,
          f: fSuivreRacine,
        });
      },
      fSuivre: async ({
        id: clefTableau,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: schémaFonctionSuivi<TraducsNom[]>;
      }) => {
        return await suivreDeFonctionListe({
          fListe: async ({
            fSuivreRacine,
          }: {
            fSuivreRacine: schémaFonctionSuivi<string[]>;
          }) => {
            return await this.suivreNuéesBd({
              idBd,
              f: fSuivreRacine,
            });
          },
          fBranche: async ({
            id: idNuée,
            fSuivreBranche,
          }: {
            id: string;
            fSuivreBranche: schémaFonctionSuivi<TraducsNom>;
          }) => {
            return await this.client.nuées.suivreNomsTableauNuée({
              idNuée,
              clefTableau,
              f: fSuivreBranche,
            });
          },
          f: fSuivreBd,
        });
      },
      f: async (deNuées?: TraducsNom[]) => {
        noms.deNuées = deNuées || [];
        return await fFinale();
      },
    });

    return async () => {
      await Promise.allSettled([fOublierTableau(), fOublierNuée()]);
    };
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
        0,
      );
      const dénominateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.dénominateur,
        0,
      );
      await f(dénominateur === 0 ? undefined : numérateur / dénominateur);
    };

    const fBranche = async ({
      id: idTableau,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<scoreTableau>;
    }): Promise<schémaFonctionOublier> => {
      const info: { cols?: InfoColAvecCatégorie[]; règles?: règleColonne[] } =
        {};

      const fFinaleBranche = async () => {
        const { cols, règles } = info;

        if (cols !== undefined && règles !== undefined) {
          const colsÉligibles = cols.filter(
            (c) =>
              c.catégorie &&
              ["numérique", "catégorique"].includes(c.catégorie.catégorie),
          );

          const dénominateur = colsÉligibles.length;
          const numérateur = colsÉligibles.filter((c) =>
            règles.some(
              (r) =>
                r.règle.règle.typeRègle !== "catégorie" && r.colonne === c.id,
            ),
          ).length;
          await fSuivreBranche({ numérateur, dénominateur });
        }
      };

      const fOublierCols =
        await this.client.tableaux.suivreColonnesEtCatégoriesTableau({
          idTableau,
          f: async (cols) => {
            info.cols = cols;
            await fFinaleBranche();
          },
        });

      const fOublierRègles = await this.client.tableaux.suivreRègles({
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

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd({
        idBd,
        f: (tableaux) => fSuivreRacine(tableaux.map((x) => x.id)),
      });
    };

    return await suivreDeFonctionListe({
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
        0,
      );
      const dénominateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.dénominateur,
        0,
      );
      await f(dénominateur === 0 ? undefined : numérateur / dénominateur);
    };

    const fBranche = async ({
      id: idTableau,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<scoreTableau>;
    }): Promise<schémaFonctionOublier> => {
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
              ["numérique", "catégorique"].includes(c.catégorie.catégorie),
          );

          const déjàVus: { id: string; idColonne: string }[] = [];
          const nCellulesÉrronnées = erreurs
            .map((e) => {
              return {
                id: e.id,
                idColonne: e.erreur.règle.colonne,
              };
            })
            .filter((x) => {
              const déjàVu = déjàVus.find(
                (y) => y.id === x.id && y.idColonne === x.idColonne,
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
                  .length,
            )
            .reduce((a, b) => a + b, 0);

          const numérateur = dénominateur - nCellulesÉrronnées;

          fSuivreBranche({ numérateur, dénominateur });
        }
      };

      const fOublierDonnées = await this.client.tableaux.suivreDonnées({
        idTableau,
        f: (données) => {
          info.données = données;
          fFinaleBranche();
        },
      });

      const fOublierErreurs = await this.client.tableaux.suivreValidDonnées({
        idTableau,
        f: (erreurs) => {
          info.erreurs = erreurs;
          fFinaleBranche();
        },
      });

      const fOublierColonnes =
        await this.client.tableaux.suivreColonnesEtCatégoriesTableau({
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

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd({
        idBd,
        f: (tableaux) => fSuivreRacine(tableaux.map((t) => t.id)),
      });
    };

    return await suivreDeFonctionListe({
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
      f: async (accès) => {
        info.accès = accès;
        await fFinale();
      },
    });
    const oublierCouverture = await this.suivreScoreCouvertureBd({
      idBd,
      f: async (couverture) => {
        info.couverture = couverture;
        await fFinale();
      },
    });
    const oublierValide = await this.suivreScoreValideBd({
      idBd,
      f: async (valide) => {
        info.valide = valide;
        await fFinale();
      },
    });

    const oublierLicence = await this.suivreLicenceBd({
      idBd,
      f: async (licence) => {
        info.licence = licence ? 1 : 0;
        await fFinale();
      },
    });
    return async () => {
      await Promise.allSettled([
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

    const fBranche = async ({
      id: idTableau,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<string[]>;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.tableaux.suivreVariables({
        idTableau,
        f: fSuivreBranche,
      });
    };

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd({
        idBd,
        f: (x) => fSuivreRacine(x.map((x) => x.id)),
      });
    };

    return await suivreDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  async suivreDonnéesExportation({
    idBd,
    langues,
    f,
  }: {
    idBd: string;
    langues?: string[];
    f: schémaFonctionSuivi<donnéesBdExportation>;
  }): Promise<schémaFonctionOublier> {
    const info: {
      nomsBd?: TraducsNom;
      données?: donnéesTableauExportation[];
    } = {};
    const fsOublier: schémaFonctionOublier[] = [];

    const fFinale = async () => {
      const { nomsBd, données } = info;
      if (!données) return;

      const idCourt = idBd.split("/").pop()!;
      const nomBd =
        nomsBd && langues ? traduire(nomsBd, langues) || idCourt : idCourt;
      await f({
        nomBd,
        tableaux: données,
      });
    };

    const fOublierDonnées = await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (éléments: infoTableauAvecId[]) => Promise<void>;
      }) => {
        return await this.suivreTableauxBd({ idBd, f: fSuivreRacine });
      },
      f: async (données: donnéesTableauExportation[]) => {
        info.données = données;
        await fFinale();
      },
      fBranche: async ({
        id,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: schémaFonctionSuivi<donnéesTableauExportation>;
      }): Promise<schémaFonctionOublier> => {
        return await this.client.tableaux.suivreDonnéesExportation({
          idTableau: id,
          langues,
          f: async (données) => {
            return await fSuivreBranche(données);
          },
        });
      },
      fIdDeBranche: (x) => x.id,
    });
    fsOublier.push(fOublierDonnées);

    if (langues) {
      const fOublierNomsBd = await this.suivreNomsBd({
        idBd,
        f: async (noms) => {
          info.nomsBd = noms;
          await fFinale();
        },
      });
      fsOublier.push(fOublierNomsBd);
    }

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
  }

  async exporterDonnées({
    idBd,
    langues,
    nomFichier,
    patience = 500,
  }: {
    idBd: string;
    langues?: string[];
    nomFichier?: string;
    patience?: number;
  }): Promise<donnéesBdExportées> {
    const doc = xlsxUtils.book_new();

    const données = await uneFois(
      async (
        fSuivi: schémaFonctionSuivi<donnéesBdExportation>,
      ): Promise<schémaFonctionOublier> => {
        return await this.suivreDonnéesExportation({
          idBd,
          langues,
          f: fSuivi,
        });
      },
      attendreStabilité(patience),
    );

    nomFichier = nomFichier || données.nomBd;

    const fichiersSFIP = new Set<string>();

    for (const tableau of données.tableaux) {
      tableau.fichiersSFIP.forEach((x) => fichiersSFIP.add(x));

      /* Créer le tableau */
      const tableauXLSX = xlsxUtils.json_to_sheet(tableau.données);

      /* Ajouter la feuille au document. XLSX n'accepte pas les noms de colonne > 31 caractères */
      xlsxUtils.book_append_sheet(
        doc,
        tableauXLSX,
        tableau.nomTableau.slice(0, 30),
      );
    }
    return { doc, fichiersSFIP, nomFichier };
  }

  async documentDonnéesÀFichier({
    données,
    formatDoc,
    dossier = "",
    inclureDocuments = true,
  }: {
    données: donnéesBdExportées;
    formatDoc: xlsx.BookType | "xls";
    dossier?: string;
    inclureDocuments?: boolean;
  }): Promise<string> {
    const { doc, fichiersSFIP, nomFichier } = données;

    const conversionsTypes: { [key: string]: xlsx.BookType } = {
      xls: "biff8",
    };
    const bookType: xlsx.BookType = conversionsTypes[formatDoc] || formatDoc;

    // Créer le dossier si nécessaire. Sinon, xlsx n'écrit rien, et ce, sans se plaindre.
    if (!(isBrowser || isWebWorker)) {
      const fs = await import("fs");
      if (!fs.existsSync(dossier)) {
        // Mais juste si on n'est pas dans le navigateur ! Dans le navigateur, ça télécharge sans problème.
        fs.mkdirSync(dossier, { recursive: true });
      }
    }

    if (inclureDocuments) {
      const adresseFinale = path.join(dossier, `${nomFichier}.zip`);

      const fichierDoc = {
        octets: xlsxWrite(doc, { bookType, type: "buffer" }),
        nom: `${nomFichier}.${formatDoc}`,
      };
      const fichiersDeSFIP = await Promise.all(
        [...fichiersSFIP].map(async (fichier) => {
          return {
            nom: fichier.replace("/", "-"),
            octets: await toBuffer(
              await this.client.obtItérableAsyncSFIP({ id: fichier }),
            ),
          };
        }),
      );
      // Effacer le fichier s'il existe déjà (uniquement nécessaire pour `zipper`)
      if (!(isBrowser || isWebWorker)) {
        const fs = await import("fs");
        if (fs.existsSync(adresseFinale)) {
          fs.rmSync(adresseFinale);
        }
      }
      await zipper(
        [fichierDoc],
        fichiersDeSFIP,
        path.join(dossier, nomFichier),
      );
      return adresseFinale;
    } else {
      const adresseFinale = path.join(dossier, `${nomFichier}.${formatDoc}`);
      if (isNode || isElectronMain) {
        xlsxWriteFile(doc, adresseFinale, {
          bookType,
        });
      } else {
        const document = xlsxWrite(doc, {
          bookType,
          type: "buffer",
        }) as ArrayBuffer;
        saveAs(
          new Blob([new Uint8Array(document)]),
          `${nomFichier}.${formatDoc}`,
        );
      }
      return adresseFinale;
    }
  }

  async exporterBdÀFichier({
    idBd,
    langues,
    nomFichier,
    patience = 500,
    formatDoc,
    dossier = "",
    inclureDocuments = true,
  }: {
    idBd: string;
    langues?: string[];
    nomFichier?: string;
    patience?: number;
    formatDoc: xlsx.BookType | "xls";
    dossier?: string;
    inclureDocuments?: boolean;
  }): Promise<string> {
    const donnéesExportées = await this.exporterDonnées({
      idBd,
      langues,
      nomFichier,
      patience,
    });
    return await this.documentDonnéesÀFichier({
      données: donnéesExportées,
      formatDoc,
      dossier,
      inclureDocuments,
    });
  }

  async effacerBd({ idBd }: { idBd: string }): Promise<void> {
    // D'abord effacer l'entrée dans notre liste de BDs
    await this.client.favoris.désépinglerFavori({ idObjet: idBd });
    await this.enleverDeMesBds({ idBd });

    // Et puis maintenant aussi effacer les données et la BD elle-même
    const { bd: bdBd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    const contenuBd = await bdBd.all();

    for (const item of contenuBd) {
      if (item.key === "tableaux") continue;
      if (typeof item.value === "string" && adresseOrbiteValide(item.value))
        await this.client.effacerBd({ id: item.value });
    }
    await fOublier();

    const idBdTableaux = await bdBd.get("tableaux")
    if (idBdTableaux) {
      const { bd: bdTableaux, fOublier: fOublierTableaux } =
        await this.client.ouvrirBdTypée({
          id: idBdTableaux,
          type: "ordered-keyvalue",
          schéma: schémaBdTableauxDeBd,
        });
      const tableaux: string[] = (await bdTableaux.all()).map((t) => t.key);
      for (const t of tableaux) {
        await this.client.tableaux.effacerTableau({ idTableau: t });
      }
      fOublierTableaux();
    }

    await this.client.effacerBd({ id: idBd });
  }
}
