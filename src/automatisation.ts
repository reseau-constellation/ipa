import { EventEmitter } from "events";
import Semaphore from "@chriscdn/promise-semaphore";
import { faisRien } from "@constl/utils-ipa";
import deepcopy from "deepcopy";
import { v4 as uuidv4 } from "uuid";
import { isElectronMain, isNode } from "wherearewe";
import * as XLSX from "xlsx";
import { ComposanteClientDic } from "@/composanteClient.js";
import {
  importerFeuilleCalculDURL,
  importerJSONdURL,
} from "@/importateur/index.js";
import { ImportateurDonnéesJSON, clefsExtraction } from "@/importateur/json.js";
import { ImportateurFeuilleCalcul } from "@/importateur/xlsx.js";
import type { Constellation } from "@/client.js";
import type { JSONSchemaType } from "ajv";
import type { conversionDonnées } from "@/tableaux.js";
import type { schémaFonctionOublier, schémaFonctionSuivi } from "@/types.js";

if (isElectronMain || isNode) {
  import("fs").then((fs) => XLSX.set_fs(fs));
  import("stream").then((stream) => XLSX.stream.set_readable(stream.Readable));
}

const MESSAGE_NON_DISPO_NAVIGATEUR =
  "L'automatisation de l'importation des fichiers locaux n'est pas disponible sur la version apli internet de Constellation.";

export type formatTélécharger = XLSX.BookType;

export type fréquence = fréquenceFixe | fréquenceDynamique | fréquenceManuelle;
export type fréquenceFixe = {
  type: "fixe";
  détails: {
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
};
export type fréquenceDynamique = {
  type: "dynamique";
};
export type fréquenceManuelle = {
  type: "manuelle";
};

export type typeObjetExportation = "nuée" | "projet" | "bd" | "tableau";

export type SpécificationAutomatisation =
  | SpécificationExporter
  | SpécificationImporter;

const schémaBdAutomatisations: JSONSchemaType<{
  [id: string]: SpécificationAutomatisation;
}> = {
  type: "object",
  additionalProperties: {
    type: "object",
    anyOf: [
      {
        type: "object",
        properties: {
          type: { type: "string" },
          id: { type: "string" },
          fréquence: {
            type: "object",
            properties: {
              type: { type: "string" },
              détails: {
                type: "object",
                properties: {
                  n: { type: "number" },
                  unités: { type: "string" },
                },
                nullable: true,
              },
            },
          },
          idObjet: { type: "string" },
          typeObjet: { type: "string" },
          formatDoc: { type: "string" },
          dossier: { type: "string", nullable: true },
          langues: {
            type: "array",
            items: {
              type: "string",
            },
            nullable: true,
          },
          dispositifs: {
            type: "array",
            items: { type: "string" },
          },
          inclureDocuments: {
            type: "boolean",
          },
          nRésultatsDésirésNuée: {
            type: "integer",
            nullable: true,
          },
        },
        required: [
          "type",
          "idObjet",
          "typeObjet",
          "formatDoc",
          "dispositifs",
          "fréquence",
          "inclureDocuments",
        ],
      },
      {
        type: "object",
        properties: {
          id: { type: "string" },
          fréquence: {
            type: "object",
            properties: {
              type: { type: "string" },
              détails: {
                type: "object",
                properties: {
                  n: { type: "number" },
                  unités: { type: "string" },
                },
                nullable: true,
              },
            },
          },
          idTableau: { type: "string" },
          dispositif: { type: "string" },
          source: {
            type: "object",
            properties: {
              typeSource: { type: "string" },
              adresseFichier: { type: "string", nullable: true },
              info: {
                type: "object",
                additionalProperties: true,
                required: [],
              },
            },
            required: ["info", "typeSource"],
          },
          conversions: {
            type: "object",
            nullable: true,
            additionalProperties: true,
            required: [],
          },
        },
        required: ["id", "idTableau", "dispositif", "source"],
      },
    ],
    required: ["id", "type"],
  },
  required: [],
};

export type copiesExportation = copiesExportationN | copiesExportationTemps;

export type copiesExportationN = {
  type: "n";
  n: number;
};

export type copiesExportationTemps = {
  type: "temps";
  temps: fréquenceFixe;
};

type BaseSpécificationAutomatisation = {
  fréquence: fréquence;
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
  inclureDocuments: boolean;
  nRésultatsDésirésNuée?: number;
  héritage?: ("descendance" | "ascendance")[];
  copies?: copiesExportation;
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
  T extends infoImporter,
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
    conversions?: { [idCol: string]: conversionDonnées };
  };

export type SpécificationImporterAvecFichier<
  T extends infoImporter = infoImporter,
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

const obtTempsInterval = (fréq: fréquenceFixe): number => {
  const { n, unités } = fréq.détails;
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

const générerFExportation = (
  spéc: SpécificationExporter,
  client: Constellation,
): (() => Promise<void>) => {
  return async () => {
    const os = await import("os");
    const path = await import("path");
    const fs = await import("fs");
    const dossier = spéc.dossier
      ? await client.automatisations.résoudreAdressePrivéeFichier({
          clef: spéc.dossier,
        })
      : path.join(os.homedir(), "constellation");
    if (!dossier) throw new Error("Dossier introuvable");

    let nomFichier: string;
    const ajouterÉtiquetteÀNomFichier = (nom: string): string => {
      const composantes = nom.split(".");
      return `${composantes[0]}-${Date.now()}.${composantes[1]}`;
    };
    switch (spéc.typeObjet) {
      case "tableau": {
        const donnéesExp = await client.tableaux.exporterDonnées({
          idTableau: spéc.idObjet,
          langues: spéc.langues,
        });
        nomFichier = donnéesExp.nomFichier;
        if (spéc.copies) nomFichier = ajouterÉtiquetteÀNomFichier(nomFichier);

        await client.bds.documentDonnéesÀFichier({
          données: donnéesExp,
          formatDoc: spéc.formatDoc,
          dossier,
          inclureDocuments: spéc.inclureDocuments,
        });
        break;
      }

      case "bd": {
        const donnéesExp = await client.bds.exporterDonnées({
          idBd: spéc.idObjet,
          langues: spéc.langues,
        });
        nomFichier = donnéesExp.nomFichier;
        if (spéc.copies) nomFichier = ajouterÉtiquetteÀNomFichier(nomFichier);

        await client.bds.documentDonnéesÀFichier({
          données: donnéesExp,
          formatDoc: spéc.formatDoc,
          dossier,
          inclureDocuments: spéc.inclureDocuments,
        });
        break;
      }

      case "projet": {
        const donnéesExp = await client.projets.exporterDonnées({
          idProjet: spéc.idObjet,
          langues: spéc.langues,
        });
        nomFichier = donnéesExp.nomFichier;
        if (spéc.copies) nomFichier = ajouterÉtiquetteÀNomFichier(nomFichier);

        await client.projets.documentDonnéesÀFichier({
          données: donnéesExp,
          formatDoc: spéc.formatDoc,
          dossier,
          inclureDocuments: spéc.inclureDocuments,
        });
        break;
      }

      case "nuée": {
        const donnéesNuée = await client.nuées.exporterDonnéesNuée({
          idNuée: spéc.idObjet,
          langues: spéc.langues,
          nRésultatsDésirés: spéc.nRésultatsDésirésNuée || 1000,
          héritage: spéc.héritage,
        });
        nomFichier = donnéesNuée.nomFichier;
        if (spéc.copies) nomFichier = ajouterÉtiquetteÀNomFichier(nomFichier);

        await client.bds.documentDonnéesÀFichier({
          données: donnéesNuée,
          formatDoc: spéc.formatDoc,
          dossier,
          inclureDocuments: spéc.inclureDocuments,
        });
        break;
      }

      default:
        throw new Error(spéc.typeObjet);
    }

    // Effacer les sauvegardes plus vieilles si nécessaire
    const correspondants = fs.readdirSync(dossier).filter((x) => {
      try {
        return (
          fs.statSync(x).isFile() &&
          nomsCorrespondent(path.basename(x), nomFichier)
        );
      } catch {
        return false;
      }
    });
    const nomsCorrespondent = (nom: string, réf: string): boolean => {
      const ext = nom.split(".").pop() || "";
      const nomBase = nom
        .slice(0, -(ext?.length + 1))
        .split("-")
        .slice(0, -1)
        .join("");
      return `${nomBase}.${ext}` === réf;
    };

    if (spéc.copies) {
      if (spéc.copies.type === "n") {
        const enTrop = spéc.copies.n - correspondants.length;
        if (enTrop > 0) {
          const fichiersAvecTempsModif = correspondants.map((fichier) => ({
            temps: new Date(fs.statSync(fichier).mtime).valueOf(),
            fichier,
          }));
          const fichiersOrdreModif = fichiersAvecTempsModif.sort((a, b) =>
            a.temps > b.temps ? 1 : -1,
          );
          const àEffacer = fichiersOrdreModif
            .slice(enTrop)
            .map((x) => x.fichier);
          àEffacer.forEach((fichier) => fs.rmSync(fichier));
        }
      } else if (spéc.copies.type === "temps") {
        const maintenant = Date.now();
        const { temps } = spéc.copies;
        const àEffacer = correspondants.filter((fichier) => {
          const dateModifFichier = new Date(
            fs.statSync(fichier).mtime,
          ).valueOf();
          return maintenant - dateModifFichier < obtTempsInterval(temps);
        });
        àEffacer.forEach((fichier) => fs.rmSync(fichier));
      }
    }
  };
};

const générerFAuto = <T extends SpécificationAutomatisation>(
  spéc: T,
  client: Constellation,
): (() => Promise<void>) => {
  switch (spéc.type) {
    case "importation": {
      return async () => {
        const résoudreAdresse = async (
          adresse?: string,
        ): Promise<string | undefined> => {
          return (
            (await client.automatisations.résoudreAdressePrivéeFichier({
              clef: adresse,
            })) || undefined
          );
        };
        const données = await client.automatisations.obtDonnéesImportation(
          spéc,
          résoudreAdresse,
        );

        // Adresse base des fichiers pour résoudre les entrées fichiers, si applicable. Fonctionne uniquement
        // sur Node et le processus principal d'Électron.
        const path = await import("path");

        let cheminBaseFichiers: string | undefined = undefined;
        if (
          spéc.source.typeSource === "fichier" &&
          spéc.source.adresseFichier
        ) {
          const fichierRésolu = await résoudreAdresse(
            spéc.source.adresseFichier,
          );
          if (fichierRésolu) cheminBaseFichiers = path.dirname(fichierRésolu);
        }

        await client.tableaux.importerDonnées({
          idTableau: spéc.idTableau,
          données,
          conversions: spéc.conversions,
          cheminBaseFichiers,
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
  client: Constellation;
  fÉtat: (état: ÉtatAutomatisation) => void;
}): Promise<{
  fOublier: schémaFonctionOublier;
  fLancer: () => Promise<void>;
}> => {
  const fAuto = générerFAuto(spéc, client);
  const clefStockageDernièreFois = `auto: ${idSpéc}`;

  const tempsInterval =
    spéc.fréquence?.type === "fixe"
      ? obtTempsInterval(spéc.fréquence)
      : undefined;

  const verrou = new Semaphore();
  let idDernièreRequêteOpération = "";
  const requêteDernièreModifImportée = await client.obtDeStockageLocal({
    clef: clefStockageDernièreFois,
  });
  const requêtesDéjàExécutées = new Set([requêteDernièreModifImportée]);

  const fAutoAvecÉtats = async (requête: string) => {
    if (requêtesDéjàExécutées.has(requête)) return;

    idDernièreRequêteOpération = requête;

    await verrou.acquire("opération");
    if (
      requête !== idDernièreRequêteOpération ||
      requêtesDéjàExécutées.has(requête)
    ) {
      verrou.release("opération");
      return;
    }
    await client.sauvegarderAuStockageLocal({
      clef: clefStockageDernièreFois,
      val: requête,
    });
    requêtesDéjàExécutées.add(requête);

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
        erreur: JSON.stringify(
          {
            nom: (e as Error).name,
            message: (e as Error).message,
            pile: (e as Error).stack,
            cause: (e as Error).cause,
          },
          undefined,
          2,
        ),
        prochaineProgramméeÀ: tempsInterval
          ? Date.now() + tempsInterval
          : undefined,
      };
      fÉtat(nouvelÉtat);
    }
    verrou.release("opération");
  };
  const fLancer = async () => await fAutoAvecÉtats(uuidv4());

  if (spéc.fréquence.type === "fixe") {
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
    const exécuterDans = Math.max(
      obtTempsInterval(spéc.fréquence) - tempsDepuisDernièreFois,
      0,
    );
    const nouvelÉtat: ÉtatProgrammée = {
      type: "programmée",
      à: Date.now() + exécuterDans,
    };
    fÉtat(nouvelÉtat);
    const crono = setTimeout(fAutoAvecÉtatsRécursif, exécuterDans);
    dicFOublierIntervale.f = async () => clearTimeout(crono);

    const fOublier = async () => {
      if (dicFOublierIntervale.f) await dicFOublierIntervale.f();
    };
    return { fOublier, fLancer };
  } else if (spéc.fréquence.type === "dynamique") {
    const nouvelÉtat: ÉtatÉcoute = {
      type: "écoute",
    };
    fÉtat(nouvelÉtat);

    switch (spéc.type) {
      case "exportation": {
        if (spéc.typeObjet === "nuée") {
          const fOublier = await client.nuées.suivreEmpreinteTêtesBdsNuée({
            idNuée: spéc.idObjet,
            f: fAutoAvecÉtats,
          });
          return { fOublier, fLancer };
        } else {
          const fOublier = await client.suivreEmpreinteTêtesBdRécursive({
            idBd: spéc.idObjet,
            f: fAutoAvecÉtats,
          });
          return { fOublier, fLancer };
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
              await client.automatisations.résoudreAdressePrivéeFichier({
                clef: adresseFichier,
              });
            if (!adresseFichierRésolue || !fs.existsSync(adresseFichierRésolue))
              throw new Error(`Fichier ${adresseFichier} introuvable.`);

            const écouteur = chokidar.watch(adresseFichierRésolue);
            const lorsqueFichierModifié = async () => {
              const maintenant = new Date().getTime().toString();
              fAutoAvecÉtats(maintenant);
            };
            écouteur.on("change", lorsqueFichierModifié);

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

            const fOublier = async () => {
              écouteur.off("change", lorsqueFichierModifié);
              return await écouteur.close();
            };
            return { fOublier, fLancer };
          }

          case "url": {
            const étatErreur: ÉtatErreur = {
              type: "erreur",
              erreur:
                "La fréquence d'une automatisation d'importation d'URL doit être spécifiée.",
              prochaineProgramméeÀ: undefined,
            };
            fÉtat(étatErreur);
            return { fOublier: faisRien, fLancer: faisRien };
          }

          default:
            throw new Error(spéc.source);
        }
      }

      default:
        throw new Error(spéc);
    }
  } else if (spéc.fréquence.type === "manuelle") {
    return {
      fOublier: faisRien,
      fLancer,
    };
  } else {
    throw new Error(spéc.fréquence);
  }
};

class AutomatisationActive extends EventEmitter {
  client: Constellation;

  état?: ÉtatAutomatisation;
  fOublier?: schémaFonctionOublier;
  fLancer?: () => Promise<void>;

  constructor(
    spéc: SpécificationAutomatisation,
    idSpéc: string,
    client: Constellation,
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
    }).then(({ fOublier, fLancer }) => {
      this.fOublier = fOublier;
      this.fLancer = fLancer;
      this.emit("prêt");
    });
  }

  async relancer() {
    if (!this.fOublier) {
      await new Promise<void>((résoudre) => {
        this.once("prêt", () => {
          résoudre();
        });
      });
    }
    await this.fLancer?.();
  }

  async fermer(): Promise<void> {
    if (!this.fOublier) {
      await new Promise<void>((résoudre) => {
        this.once("prêt", () => {
          résoudre();
        });
      });
    }
    await this.fOublier?.();
  }
}

const activePourCeDispositif = <T extends SpécificationAutomatisation>(
  spéc: T,
  monIdDispositif: string,
): boolean => {
  switch (spéc.type) {
    case "importation": {
      return spéc.dispositif === monIdDispositif;
    }

    case "exportation": {
      return spéc.dispositifs.includes(monIdDispositif);
    }

    default:
      throw new Error(spéc);
  }
};

const verrou = new Semaphore();

export class Automatisations extends ComposanteClientDic<{
  [id: string]: SpécificationAutomatisation;
}> {
  automatisations: { [key: string]: {auto: AutomatisationActive, fOublier: ()=>void} };
  événements: EventEmitter;

  fOublier?: schémaFonctionOublier;

  constructor({ client }: { client: Constellation }) {
    super({
      client,
      clef: "automatisations",
      schémaBdPrincipale: schémaBdAutomatisations,
    });

    this.automatisations = {};
    this.événements = new EventEmitter();

    this.initialiser();
  }

  async initialiser(): Promise<void> {
    this.fOublier = await this.suivreBdPrincipale({
      f: (autos) => this.mettreAutosÀJour(Object.values(autos)),
    });
  }

  async mettreAutosÀJour(autos: SpécificationAutomatisation[]): Promise<void> {
    await verrou.acquire("miseÀJour");
    const automatisationsDavant = Object.keys(this.automatisations);

    for (const id of automatisationsDavant) {
      if (!autos.find((a) => a.id === id)) await this.fermerAuto(id);
    }

    const ceDispositif = await this.client.obtIdDispositif();
    for (const a of autos) {
      if (activePourCeDispositif(a, ceDispositif)) {
        if (!Object.keys(this.automatisations).includes(a.id)) {
          const auto = new AutomatisationActive(a, a.id, this.client);
          const lorsquAutoMiseÀJour = () => this.événements.emit("misÀJour")
          auto.on("misÀJour", lorsquAutoMiseÀJour);
          this.automatisations[a.id] = {auto, fOublier: ()=>auto.off("misÀJour", lorsquAutoMiseÀJour)};
        }
      } else {
        const autoActif = this.automatisations[a.id];
        if (autoActif) {
          await this.fermerAuto(a.id);
        }
      }
    }

    verrou.release("miseÀJour");
  }

  async obtDonnéesImportation<
    T extends infoImporterJSON | infoImporterFeuilleCalcul,
  >(
    spéc: SpécificationImporter<T>,
    résoudreAdresse: (x?: string) => Promise<string | undefined> = async (x) =>
      x,
  ) {
    const { typeSource } = spéc.source;
    const { formatDonnées } = spéc.source.info;

    switch (typeSource) {
      case "url": {
        const { url } = spéc.source;
        switch (formatDonnées) {
          case "json": {
            const { clefsRacine, clefsÉléments, cols } = spéc.source.info;
            // À faire : inclure code pour importations "spéciales" comme epicollect, etc.
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
              adresseFichierRésolue,
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
  }

  async ajouterAutomatisationExporter({
    id,
    typeObjet,
    formatDoc,
    inclureDocuments,
    dossier,
    langues,
    fréquence,
    dispositifs,
    nRésultatsDésirésNuée,
    héritage,
    copies,
  }: {
    id: string;
    typeObjet: typeObjetExportation;
    formatDoc: formatTélécharger;
    inclureDocuments: boolean;
    dossier: string;
    fréquence: fréquence;
    langues?: string[];
    dispositifs?: string[];
    nRésultatsDésirésNuée?: number;
    héritage?: ("descendance" | "ascendance")[];
    copies?: copiesExportation;
  }): Promise<string> {
    const { orbite } = await this.client.attendreSfipEtOrbite();
    dispositifs = dispositifs || [orbite.identity.id];
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
      inclureDocuments,
      dossier: idDossier, // Pour des raisons de sécurité, on ne sauvegarde pas le nom du dossier directement
      nRésultatsDésirésNuée,
      héritage,
      copies,
    };

    // Enlever les options qui n'existent pas. (DLIP n'aime pas `undefined`.)
    Object.keys(élément).forEach((clef) => {
      if (élément[clef as keyof SpécificationExporter] === undefined) {
        delete élément[clef as keyof SpécificationExporter];
      }
    });
    const { bd, fOublier } = await this.obtBd();
    await bd.put(idAuto, élément);

    await fOublier();

    return idAuto;
  }

  async ajouterAutomatisationImporter<
    T extends infoImporterJSON | infoImporterFeuilleCalcul,
  >({
    idTableau,
    source,
    fréquence,
    dispositif,
  }: {
    idTableau: string;
    source: SourceDonnéesImportation<T>;
    fréquence: fréquence;
    dispositif?: string;
  }): Promise<string> {
    const { bd, fOublier } = await this.obtBd();
    const { orbite } = await this.client.attendreSfipEtOrbite();

    dispositif = dispositif || orbite.identity.id;
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

    await bd.put(id, élément);

    await fOublier();

    return id;
  }

  async annulerAutomatisation({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.obtBd();
    await bd.del(id);
    await fOublier();
  }

  async modifierAutomatisation({
    id,
    automatisation,
  }: {
    id: string;
    automatisation: SpécificationAutomatisation;
  }): Promise<void> {
    const { bd, fOublier } = await this.obtBd();
    bd.put(id, automatisation);
    await fOublier();
  }

  async résoudreAdressePrivéeFichier({
    clef,
  }: {
    clef?: string;
  }): Promise<string | null> {
    return clef ? await this.client.obtDeStockageLocal({ clef }) : null;
  }

  async sauvegarderAdressePrivéeFichier({
    fichier,
  }: {
    fichier: string;
  }): Promise<string> {
    const clef = "dossier." + uuidv4();
    await this.client.sauvegarderAuStockageLocal({ clef, val: fichier });
    return clef;
  }

  async suivreAutomatisations({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<SpécificationAutomatisation[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (autos: {
      [id: string]: SpécificationAutomatisation;
    }) => {
      const autosFinales = await Promise.all(
        Object.values(autos).map(async (a) => {
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
        }),
      );
      await f(autosFinales);
    };
    return await this.suivreBdPrincipale({
      idCompte,
      f: fFinale,
    });
  }

  async suivreÉtatAutomatisations({
    f,
  }: {
    f: schémaFonctionSuivi<{ [key: string]: ÉtatAutomatisation }>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async () => {
      const étatsAuto: { [key: string]: ÉtatAutomatisation } =
        Object.fromEntries(
          Object.keys(this.automatisations)
            .map((a) => [a, this.automatisations[a].auto.état])
            .filter((x) => x[1]),
        );
      await f(étatsAuto);
    };
    this.événements.on("misÀJour", fFinale);
    await fFinale();
    return async () => {
      this.événements.off("misÀJour", fFinale);
    };
  }

  async lancerManuellement({ id }: { id: string }) {
    await this.automatisations[id]?.auto.relancer();
  }

  async fermerAuto(id: string): Promise<void> {
    await this.automatisations[id]?.auto.fermer();
    this.automatisations[id]?.fOublier();
    delete this.automatisations[id];
  }

  async fermer(): Promise<void> {
    await Promise.all(
      Object.keys(this.automatisations).map((a) => {
        this.fermerAuto(a);
      }),
    );
    await this.fOublier?.();
  }
}
