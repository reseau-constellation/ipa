import { EventEmitter } from "events";
import type FeedStore from "orbit-db-feedstore";
import * as XLSX from "xlsx";

import Semaphore from "@chriscdn/promise-semaphore";
import { isNode, isElectronMain } from "wherearewe";
import { v4 as uuidv4 } from "uuid";
import deepcopy from "deepcopy";

import type { default as ClientConstellation } from "@/client.js";
import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  faisRien,
} from "@/utils/index.js";
import {
  importerFeuilleCalculDURL,
  importerJSONdURL,
} from "@/importateur/index.js";
import ImportateurFeuilleCalcul from "@/importateur/xlsx.js";
import ImportateurDonnéesJSON, { clefsExtraction } from "@/importateur/json.js";

if (isElectronMain || isNode) {
  import("fs").then((fs) => XLSX.set_fs(fs));
  import("stream").then((stream) => XLSX.stream.set_readable(stream.Readable));
}

const MESSAGE_NON_DISPO_NAVIGATEUR =
  "L'automatisation de l'importation des fichiers locaux n'est pas disponible sur la version apli internet de Constellation.";

export type formatTélécharger = XLSX.BookType | "xls";

export type fréquence = {
  unités:
    | "années"
    | "mois"
    | "semaines"
    | "jours"
    | "heures"
    | "minutes"
    | "secondes"
    | "millisecondes";
  n: number;
};

export type typeObjetExportation = "nuée" | "projet" | "bd" | "tableau";

export type SpécificationAutomatisation =
  | SpécificationExporter
  | SpécificationImporter;

type BaseSpécificationAutomatisation = {
  fréquence?: fréquence;
  type: "importation" | "exportation";
  id: string;
};

export type SpécificationExporter = BaseSpécificationAutomatisation & {
  type: "exportation";
  idObjet: string;
  typeObjet: typeObjetExportation;
  formatDoc: formatTélécharger;
  dossier?: string;
  langues?: string[];
  dispositifs: string[];
  inclureFichiersSFIP: boolean;
};

export type infoImporter = infoImporterJSON | infoImporterFeuilleCalcul;

export type infoImporterJSON = {
  formatDonnées: "json";
  clefsRacine: clefsExtraction;
  clefsÉléments: clefsExtraction;
  cols: { [key: string]: clefsExtraction };
};

// Il faut copier ça ici parce qu'elles sont exportées de XLSX en
// tant qu'interfaces
export type XLSXCommonOptions = {
  /**
   * If true, throw errors when features are not understood
   * @default false
   */
  WTF?: boolean;

  /**
   * When reading a file with VBA macros, expose CFB blob to `vbaraw` field
   * When writing BIFF8/XLSB/XLSM, reseat `vbaraw` and export to file
   * @default false
   */
  bookVBA?: boolean;

  /**
   * When reading a file, store dates as type d (default is n)
   * When writing XLSX/XLSM file, use native date (default uses date codes)
   * @default false
   */
  cellDates?: boolean;

  /**
   * Create cell objects for stub cells
   * @default false
   */
  sheetStubs?: boolean;

  /**
   * When reading a file, save style/theme info to the .s field
   * When writing a file, export style/theme info
   * @default false
   */
  cellStyles?: boolean;

  /**
   * If defined and file is encrypted, use password
   * @default ''
   */
  password?: string;
};

export type XLSXParsingOptions = XLSXCommonOptions & {
  /** Input data encoding */
  type?: "base64" | "binary" | "buffer" | "file" | "array" | "string";

  /**
   * Default codepage for legacy files
   *
   * This requires encoding support to be loaded.  It is automatically loaded
   * in `xlsx.full.min.js` and in CommonJS / Extendscript, but an extra step
   * is required in React / Angular / Webpack ESM deployments.
   *
   * Check the relevant guide https://docs.sheetjs.com/docs/getting-started/
   */
  codepage?: number;

  /**
   * Save formulae to the .f field
   * @default true
   */
  cellFormula?: boolean;

  /**
   * Parse rich text and save HTML to the .h field
   * @default true
   */
  cellHTML?: boolean;

  /**
   * Save number format string to the .z field
   * @default false
   */
  cellNF?: boolean;

  /**
   * Generate formatted text to the .w field
   * @default true
   */
  cellText?: boolean;

  /** Override default date format (code 14) */
  dateNF?: string;

  /** Field Separator ("Delimiter" override) */
  FS?: string;

  /**
   * If >0, read the first sheetRows rows
   * @default 0
   */
  sheetRows?: number;

  /**
   * If true, parse calculation chains
   * @default false
   */
  bookDeps?: boolean;

  /**
   * If true, add raw files to book object
   * @default false
   */
  bookFiles?: boolean;

  /**
   * If true, only parse enough to get book metadata
   * @default false
   */
  bookProps?: boolean;

  /**
   * If true, only parse enough to get the sheet names
   * @default false
   */
  bookSheets?: boolean;

  /** If specified, only parse the specified sheets or sheet names */
  sheets?: number | string | Array<number | string>;

  /** If true, plaintext parsing will not parse values */
  raw?: boolean;

  /** If true, ignore "dimensions" records and guess range using every cell */
  nodim?: boolean;

  /** If true, preserve _xlfn. prefixes in formula function names */
  xlfn?: boolean;

  dense?: boolean;

  PRN?: boolean;
};

export type infoImporterFeuilleCalcul = {
  formatDonnées: "feuilleCalcul";
  nomTableau: string;
  cols: { [key: string]: string };
  optionsXLSX?: XLSXParsingOptions;
};

export type SourceDonnéesImportation<T extends infoImporter> =
  | SourceDonnéesImportationURL<T>
  | SourceDonnéesImportationFichier<T>;

export type SourceDonnéesImportationAdresseOptionel<T extends infoImporter> =
  | SourceDonnéesImportationURL<T>
  | SourceDonnéesImportationFichierAdresseOptionel<T>;

export type SourceDonnéesImportationURL<T extends infoImporter> = {
  typeSource: "url";
  url: string;
  info: T;
};

export type SourceDonnéesImportationFichierAdresseOptionel<
  T extends infoImporter
> = {
  typeSource: "fichier";
  adresseFichier?: string;
  info: T;
};

export type SourceDonnéesImportationFichier<T extends infoImporter> =
  SourceDonnéesImportationFichierAdresseOptionel<T> & {
    adresseFichier: string;
  };

export type SpécificationImporter<T extends infoImporter = infoImporter> =
  BaseSpécificationAutomatisation & {
    type: "importation";
    idTableau: string;
    dispositif: string;
    source: SourceDonnéesImportationAdresseOptionel<T>;
  };

export type SpécificationImporterAvecFichier<
  T extends infoImporter = infoImporter
> = SpécificationImporter<T> & { source: SourceDonnéesImportation<T> };

export type ÉtatAutomatisation =
  | ÉtatErreur
  | ÉtatÉcoute
  | ÉtatEnSync
  | ÉtatProgrammée;

export interface ÉtatErreur {
  type: "erreur";
  erreur: string;
  prochaineProgramméeÀ?: number;
}

export interface ÉtatÉcoute {
  type: "écoute";
}

export interface ÉtatEnSync {
  type: "sync";
  depuis: number;
}

export interface ÉtatProgrammée {
  type: "programmée";
  à: number;
}

const obtTempsInterval = (fréq: fréquence): number => {
  const { n, unités } = fréq;
  switch (unités) {
    case "années":
      return n * 365.25 * 24 * 60 * 60 * 1000;

    case "mois":
      return n * 30 * 24 * 60 * 60 * 1000;

    case "semaines":
      return n * 7 * 24 * 60 * 60 * 1000;

    case "jours":
      return n * 24 * 60 * 60 * 1000;

    case "heures":
      return n * 60 * 60 * 1000;

    case "minutes":
      return n * 60 * 1000;

    case "secondes":
      return n * 1000;

    case "millisecondes":
      return n;

    default:
      throw new Error(unités);
  }
};

export const obtDonnéesImportation = async <
  T extends infoImporterJSON | infoImporterFeuilleCalcul
>(
  spéc: SpécificationImporter<T>,
  résoudreAdresse: (x?: string) => Promise<string | undefined> = async (x) => x
) => {
  const { typeSource } = spéc.source;
  const { formatDonnées } = spéc.source.info;

  switch (typeSource) {
    case "url": {
      const { url } = spéc.source;
      switch (formatDonnées) {
        case "json": {
          const { clefsRacine, clefsÉléments, cols } = spéc.source.info;
          const donnéesJson = await importerJSONdURL(url);
          const importateur = new ImportateurDonnéesJSON(donnéesJson);
          return importateur.obtDonnées(clefsRacine, clefsÉléments, cols);
        }

        case "feuilleCalcul": {
          const { nomTableau, cols, optionsXLSX } = spéc.source.info;
          const docXLSX = await importerFeuilleCalculDURL(url, optionsXLSX);
          const importateur = new ImportateurFeuilleCalcul(docXLSX);
          return importateur.obtDonnées(nomTableau, cols);
        }

        default:
          throw new Error(formatDonnées);
      }
    }
    case "fichier": {
      if (!isElectronMain && !isNode)
        throw new Error(MESSAGE_NON_DISPO_NAVIGATEUR);
      const fs = await import("fs");
      const { adresseFichier } = spéc.source;
      const adresseFichierRésolue = await résoudreAdresse(adresseFichier);
      if (!adresseFichierRésolue || !fs.existsSync(adresseFichierRésolue))
        throw new Error(`Fichier ${adresseFichierRésolue} introuvable.`);

      switch (formatDonnées) {
        case "json": {
          const { clefsRacine, clefsÉléments, cols } = spéc.source.info;

          const contenuFichier = await fs.promises.readFile(
            adresseFichierRésolue
          );
          const donnéesJson = JSON.parse(contenuFichier.toString());
          const importateur = new ImportateurDonnéesJSON(donnéesJson);

          return importateur.obtDonnées(clefsRacine, clefsÉléments, cols);
        }

        case "feuilleCalcul": {
          const { nomTableau, cols } = spéc.source.info;

          const docXLSX = XLSX.readFile(adresseFichierRésolue);
          const importateur = new ImportateurFeuilleCalcul(docXLSX);
          return importateur.obtDonnées(nomTableau, cols);
        }

        default:
          throw new Error(formatDonnées);
      }
    }

    default:
      throw new Error(typeSource);
  }
};

const générerFExportation = (
  spéc: SpécificationExporter,
  client: ClientConstellation
): (() => Promise<void>) => {
  return async () => {
    const os = await import("os");
    const path = await import("path");
    const dossier = spéc.dossier ? await client.automatisations!.résoudreAdressePrivéeFichier({
      clef: spéc.dossier,
    }) : path.join(os.homedir(), 'constellation');
    
    if (!dossier) throw new Error("Dossier introuvable");
    switch (spéc.typeObjet) {
      case "tableau": {
        const donnéesExp = await client.tableaux!.exporterDonnées({
          idTableau: spéc.idObjet,
          langues: spéc.langues,
        });

        await client.bds!.exporterDocumentDonnées({
          données: donnéesExp,
          formatDoc: spéc.formatDoc,
          dossier,
          inclureFichiersSFIP: spéc.inclureFichiersSFIP,
        });
        break;
      }

      case "bd": {
        const donnéesExp = await client.bds!.exporterDonnées({
          id: spéc.idObjet,
          langues: spéc.langues,
        });
        await client.bds!.exporterDocumentDonnées({
          données: donnéesExp,
          formatDoc: spéc.formatDoc,
          dossier,
          inclureFichiersSFIP: spéc.inclureFichiersSFIP,
        });
        break;
      }

      case "projet": {
        const donnéesExp = await client.projets!.exporterDonnées({
          id: spéc.idObjet,
          langues: spéc.langues,
        });
        await client.projets!.exporterDocumentDonnées({
          données: donnéesExp,
          formatDoc: spéc.formatDoc,
          dossier,
          inclureFichiersSFIP: spéc.inclureFichiersSFIP,
        });
        break;
      }

      case "nuée": {
        const donnéesNuée = await client.nuées!.exporterDonnéesNuée({
          idNuée: spéc.idObjet,
          langues: spéc.langues,
        });
        await client.bds!.exporterDocumentDonnées({
          données: donnéesNuée,
          formatDoc: spéc.formatDoc,
          dossier,
          inclureFichiersSFIP: spéc.inclureFichiersSFIP,
        });
        break;
      }

      default:
        throw new Error(spéc.typeObjet);
    }
  };
};

const générerFAuto = <T extends SpécificationAutomatisation>(
  spéc: T,
  client: ClientConstellation
): (() => Promise<void>) => {
  switch (spéc.type) {
    case "importation": {
      return async () => {
        const résoudreAdresse = async (
          adresse?: string
        ): Promise<string | undefined> => {
          return (
            (await client.automatisations!.résoudreAdressePrivéeFichier({
              clef: adresse,
            })) || undefined
          );
        };
        const données = await obtDonnéesImportation(spéc, résoudreAdresse);
        await client.tableaux!.importerDonnées({
          idTableau: spéc.idTableau,
          données,
        });
      };
    }

    case "exportation": {
      return générerFExportation(spéc, client);
    }

    default:
      throw new Error(spéc);
  }
};

const lancerAutomatisation = async <T extends SpécificationAutomatisation>({
  spéc,
  idSpéc,
  client,
  fÉtat,
}: {
  spéc: T;
  idSpéc: string;
  client: ClientConstellation;
  fÉtat: (état: ÉtatAutomatisation) => void;
}): Promise<schémaFonctionOublier> => {
  const fAuto = générerFAuto(spéc, client);
  const clefStockageDernièreFois = `auto: ${idSpéc}`;

  const tempsInterval = spéc.fréquence
    ? obtTempsInterval(spéc.fréquence)
    : undefined;

  const verrou = new Semaphore();
  let idDernièreRequèteOpération = "";

  const fAutoAvecÉtats = async (requète: string) => {
    const requèteDernièreModifImportée = await client.obtDeStockageLocal({
      clef: clefStockageDernièreFois,
    });

    if (requète === requèteDernièreModifImportée) return;

    idDernièreRequèteOpération = requète;

    await verrou.acquire("opération");
    if (requète !== idDernièreRequèteOpération) {
      verrou.release("opération");
      return;
    }
    await client.sauvegarderAuStockageLocal({
      clef: clefStockageDernièreFois,
      val: requète,
    });

    const nouvelÉtat: ÉtatEnSync = {
      type: "sync",
      depuis: new Date().getTime(),
    };
    fÉtat(nouvelÉtat);

    try {
      await fAuto();
      if (tempsInterval) {
        const nouvelÉtat: ÉtatProgrammée = {
          type: "programmée",
          à: Date.now() + tempsInterval,
        };
        fÉtat(nouvelÉtat);
      } else {
        const nouvelÉtat: ÉtatÉcoute = {
          type: "écoute",
        };
        fÉtat(nouvelÉtat);
      }
    } catch (e) {
      const nouvelÉtat: ÉtatErreur = {
        type: "erreur",
        erreur: (e as Error).toString(),
        prochaineProgramméeÀ: tempsInterval
          ? Date.now() + tempsInterval
          : undefined,
      };
      fÉtat(nouvelÉtat);
    }
    verrou.release("opération");
  };

  if (spéc.fréquence) {
    const nouvelÉtat: ÉtatProgrammée = {
      type: "programmée",
      à: tempsInterval!,
    };
    fÉtat(nouvelÉtat);
    const dicFOublierIntervale: { f?: schémaFonctionOublier } = {};

    const fAutoAvecÉtatsRécursif = async () => {
      const maintenant = new Date().getTime();
      await fAutoAvecÉtats(maintenant.toString());

      const crono = setTimeout(fAutoAvecÉtatsRécursif, tempsInterval);
      dicFOublierIntervale.f = async () => clearTimeout(crono);
    };

    const maintenant = new Date().getTime();
    const dernièreFoisChaîne = await client.obtDeStockageLocal({
      clef: clefStockageDernièreFois,
    });
    const dernièreFois = dernièreFoisChaîne
      ? parseInt(dernièreFoisChaîne)
      : -Infinity;
    const tempsDepuisDernièreFois = maintenant - dernièreFois;
    const crono = setTimeout(
      fAutoAvecÉtatsRécursif,
      Math.max(tempsInterval! - tempsDepuisDernièreFois, 0)
    );
    dicFOublierIntervale.f = async () => clearTimeout(crono);

    const fOublier = async () => {
      if (dicFOublierIntervale.f) await dicFOublierIntervale.f();
    };
    return fOublier;
  } else {
    const nouvelÉtat: ÉtatÉcoute = {
      type: "écoute",
    };
    fÉtat(nouvelÉtat);

    switch (spéc.type) {
      case "exportation": {
        if (spéc.typeObjet === "nuée") {
          const fOublier = await client.nuées!.suivreEmpreinteTêtesBdsNuée({
            idNuée: spéc.idObjet,
            f: fAutoAvecÉtats,
          });
          return fOublier;
        } else {
          const fOublier = await client.suivreEmpreinteTêtesBdRécursive({
            idBd: spéc.idObjet,
            f: fAutoAvecÉtats,
          });
          return fOublier;
        }
      }

      case "importation": {
        switch (spéc.source.typeSource) {
          case "fichier": {
            if (!isNode && !isElectronMain) {
              throw new Error(MESSAGE_NON_DISPO_NAVIGATEUR);
            }
            const chokidar = await import("chokidar");
            const fs = await import("fs");
            const { adresseFichier } = spéc.source;

            const adresseFichierRésolue =
              await client.automatisations!.résoudreAdressePrivéeFichier({
                clef: adresseFichier,
              });
            if (!adresseFichierRésolue || !fs.existsSync(adresseFichierRésolue))
              throw new Error(`Fichier ${adresseFichier} introuvable.`);

            const écouteur = chokidar.watch(adresseFichierRésolue);
            écouteur.on("change", async () => {
              const maintenant = new Date().getTime().toString();
              fAutoAvecÉtats(maintenant);
            });

            const dernièreModif = fs
              .statSync(adresseFichierRésolue)
              .mtime.getTime();
            const dernièreImportation = await client.obtDeStockageLocal({
              clef: clefStockageDernièreFois,
            });
            const fichierModifié = dernièreImportation
              ? dernièreModif > parseInt(dernièreImportation)
              : true;
            if (fichierModifié) {
              const maintenant = new Date().getTime().toString();
              fAutoAvecÉtats(maintenant);
            }

            const fOublier = async () => await écouteur.close();
            return fOublier;
          }

          case "url": {
            const étatErreur: ÉtatErreur = {
              type: "erreur",
              erreur:
                "La fréquence d'une automatisation d'importation d'URL doit être spécifiée.",
              prochaineProgramméeÀ: undefined,
            };
            fÉtat(étatErreur);
            return faisRien;
          }

          default:
            throw new Error(spéc.source);
        }
      }

      default:
        throw new Error(spéc);
    }
  }
};

class AutomatisationActive extends EventEmitter {
  client: ClientConstellation;

  état?: ÉtatAutomatisation;
  fOublier?: schémaFonctionOublier;

  constructor(
    spéc: SpécificationAutomatisation,
    idSpéc: string,
    client: ClientConstellation
  ) {
    super();

    this.client = client;
    lancerAutomatisation({
      spéc,
      idSpéc,
      client: this.client,
      fÉtat: (état: ÉtatAutomatisation) => {
        this.état = état;
        this.emit("misÀJour");
      },
    }).then((fOublier) => {
      this.fOublier = fOublier;
      this.emit("prêt");
    });
  }

  async fermer(): Promise<void> {
    if (!this.fOublier) {
      await new Promise<void>((résoudre) => {
        this.once("prêt", () => {
          résoudre();
        });
      });
    }
    this.fOublier!();
  }
}

const activePourCeDispositif = <T extends SpécificationAutomatisation>(
  spéc: T,
  monIdOrbite: string
): boolean => {
  switch (spéc.type) {
    case "importation": {
      return spéc.dispositif === monIdOrbite;
    }

    case "exportation": {
      return spéc.dispositifs.includes(monIdOrbite);
    }

    default:
      throw new Error(spéc);
  }
};

const verrou = new Semaphore();

export default class Automatisations extends EventEmitter {
  client: ClientConstellation;
  idBd: string;

  automatisations: { [key: string]: AutomatisationActive };
  fOublier?: schémaFonctionOublier;

  constructor({ client, id }: { client: ClientConstellation; id: string }) {
    super();

    this.client = client;
    this.idBd = id;

    this.automatisations = {};

    this.initialiser();
  }

  async initialiser(): Promise<void> {
    this.fOublier =
      await this.client.suivreBdListe<SpécificationAutomatisation>({
        id: this.idBd,
        f: (autos) => this.mettreAutosÀJour(autos),
        renvoyerValeur: false,
      });
  }

  async mettreAutosÀJour(
    autos: LogEntry<SpécificationAutomatisation>[]
  ): Promise<void> {
    await verrou.acquire("miseÀJour");
    const automatisationsDavant = Object.keys(this.automatisations);

    for (const id of automatisationsDavant) {
      if (!autos.find((a) => a.payload.value.id === id))
        await this.fermerAuto(id);
    }

    for (const a of autos) {
      const {
        payload: { value },
      } = a;

      if (activePourCeDispositif(value, this.client.orbite!.identity.id)) {
        if (!Object.keys(this.automatisations).includes(value.id)) {
          const auto = new AutomatisationActive(value, value.id, this.client);
          auto.on("misÀJour", () => this.emit("misÀJour"));
          this.automatisations[value.id] = auto;
        }
      } else {
        const autoActif = this.automatisations[value.id];
        if (autoActif) {
          await this.fermerAuto(value.id);
        }
      }
    }

    verrou.release("miseÀJour");
  }

  async ajouterAutomatisationExporter({
    id,
    typeObjet,
    formatDoc,
    inclureFichiersSFIP,
    dossier,
    langues,
    fréquence,
    dispositifs,
  }: {
    id: string;
    typeObjet: typeObjetExportation;
    formatDoc: formatTélécharger;
    inclureFichiersSFIP: boolean;
    dossier: string;
    langues?: string[];
    fréquence?: fréquence;
    dispositifs?: string[];
  }): Promise<string> {
    dispositifs = dispositifs || [this.client.orbite!.identity.id];
    const idAuto = uuidv4();
    const idDossier = await this.sauvegarderAdressePrivéeFichier({
      fichier: dossier,
    });

    const élément: SpécificationExporter = {
      type: "exportation",
      id: idAuto,
      idObjet: id,
      typeObjet,
      dispositifs,
      fréquence,
      formatDoc,
      langues,
      inclureFichiersSFIP,
      dossier: idDossier, // Pour des raisons de sécurité, on ne sauvegarde pas le nom du dossier directement
    };

    // Enlever les options qui n'existent pas. (DLIP n'aime pas `undefined`.)
    Object.keys(élément).forEach((clef) => {
      if (élément[clef as keyof SpécificationExporter] === undefined) {
        delete élément[clef as keyof SpécificationExporter];
      }
    });
    const { bd, fOublier } = await this.client.ouvrirBd<
      FeedStore<SpécificationAutomatisation>
    >({ id: this.idBd });
    await bd.add(élément);

    await fOublier();

    return idAuto;
  }

  async ajouterAutomatisationImporter<
    T extends infoImporterJSON | infoImporterFeuilleCalcul
  >({
    idTableau,
    source,
    fréquence,
    dispositif,
  }: {
    idTableau: string;
    source: SourceDonnéesImportation<T>;
    fréquence?: fréquence;
    dispositif?: string;
  }): Promise<string> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      FeedStore<SpécificationAutomatisation>
    >({ id: this.idBd });

    dispositif = dispositif || this.client.orbite!.identity.id;
    const id = uuidv4();

    if (source.typeSource === "fichier") {
      source.adresseFichier = await this.sauvegarderAdressePrivéeFichier({
        fichier: source.adresseFichier,
      });
    }

    const élément: SpécificationImporter<T> = {
      type: "importation",
      id,
      idTableau,
      dispositif,
      fréquence,
      source,
    };

    // Enlever les options qui n'existent pas. (DLIP n'aime pas `undefined`.)
    Object.keys(élément).forEach((clef) => {
      if (élément[clef as keyof SpécificationImporter<T>] === undefined) {
        delete élément[clef as keyof SpécificationImporter<T>];
      }
    });

    await bd.add(élément);

    await fOublier();

    return id;
  }

  async annulerAutomatisation({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      FeedStore<SpécificationAutomatisation>
    >({ id: this.idBd });
    await this.client.effacerÉlémentDeBdListe({
      bd,
      élément: (é) => é.payload.value.id === id,
    });
    await fOublier();
  }

  async résoudreAdressePrivéeFichier({
    clef,
  }: {
    clef?: string;
  }): Promise<string | null> {
    const x = clef ? await this.client.obtDeStockageLocal({ clef }) : null;
    return x;
  }

  async sauvegarderAdressePrivéeFichier({
    fichier,
  }: {
    fichier: string;
  }): Promise<string> {
    const clef = "dossier." + uuidv4();
    await this.client.sauvegarderAuStockageLocal({ clef, val: fichier });
    console.log({ clef });
    return clef;
  }

  async suivreAutomatisations({
    f,
    idRacine,
  }: {
    f: schémaFonctionSuivi<SpécificationAutomatisation[]>;
    idRacine?: string;
  }): Promise<schémaFonctionOublier> {
    idRacine = idRacine || this.idBd;
    const fFinale = async (autos: SpécificationAutomatisation[]) => {
      const autosFinales = await Promise.all(
        autos.map(async (a) => {
          const autoFinale = deepcopy(a);
          if (
            autoFinale.type === "importation" &&
            autoFinale.source.typeSource === "fichier"
          ) {
            const { adresseFichier } = autoFinale.source;
            if (adresseFichier) {
              const adresseRésolue = await this.résoudreAdressePrivéeFichier({
                clef: adresseFichier,
              });
              if (adresseRésolue) {
                autoFinale.source.adresseFichier = adresseRésolue;
              } else {
                delete autoFinale.source.adresseFichier;
              }
            }
          } else if (autoFinale.type === "exportation") {
            const { dossier } = autoFinale;
            if (dossier) {
              const dossierRésolu = await this.résoudreAdressePrivéeFichier({
                clef: dossier,
              });
              if (dossierRésolu) {
                autoFinale.dossier = dossierRésolu;
              } else {
                delete autoFinale.dossier;
              }
            }
          }
          return autoFinale;
        })
      );
      await f(autosFinales);
    };
    return await this.client.suivreBdListe({ id: idRacine, f: fFinale });
  }

  async suivreÉtatAutomatisations({
    f,
  }: {
    f: schémaFonctionSuivi<{ [key: string]: ÉtatAutomatisation }>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = () => {
      const étatsAuto: { [key: string]: ÉtatAutomatisation } =
        Object.fromEntries(
          Object.keys(this.automatisations)
            .map((a) => [a, this.automatisations[a].état])
            .filter((x) => x[1])
        );
      f(étatsAuto);
    };
    this.on("misÀJour", fFinale);
    return async () => {
      this.off("misÀJour", fFinale);
    };
  }

  async fermerAuto(empreinte: string): Promise<void> {
    await this.automatisations[empreinte].fermer();
    delete this.automatisations[empreinte];
  }

  async fermer(): Promise<void> {
    await Promise.all(
      Object.keys(this.automatisations).map((a) => {
        this.fermerAuto(a);
      })
    );
    if (this.fOublier) await this.fOublier();
  }
}
