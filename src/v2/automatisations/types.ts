import { JSONSchemaType } from "ajv";
import * as XLSX from "xlsx";
import { PartielRécursif } from "../types.js";
import { ClefsExtraction } from "../importateur/json.js";
import { ConversionDonnées } from "../tableaux.js";

// Types XLSX

/* Il faut copier ça ici parce qu'elles sont exportées d'XLSX en
tant qu'interfaces. */
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

// Types automatisations

export type SpécificationAutomatisation =
  | SpécificationExporter
  | SpécificationImporter;

export type TypeObjetExportation = "nuée" | "projet" | "bd" | "tableau";

export type FormatTélécharger = XLSX.BookType;

export type CopiesExportation = CopiesExportationN | CopiesExportationTemps;

export type CopiesExportationN = {
  type: "n";
  n: number;
};

export type CopiesExportationTemps = {
  type: "temps";
  temps: FréquenceFixe;
};

export type BaseSpécificationAutomatisation = {
  fréquence: Fréquence;
  type: "importation" | "exportation";
  id: string;
};

export type BaseSpécificationExporter = BaseSpécificationAutomatisation & {
  type: "exportation";
  idObjet: string;
  formatDoc: FormatTélécharger;
  dossier?: string;
  langues?: string[];
  dispositifs: string[];
  inclureDocuments: boolean;

  copies?: CopiesExportation;
};

export type SpécificationExporterNuée = BaseSpécificationExporter & {
  typeObjet: "nuée";
  nRésultatsDésirés?: number;
  héritage?: ("descendance" | "ascendance")[];
};
export type SpécificationExporterObjet = BaseSpécificationExporter & {
  typeObjet: Exclude<TypeObjetExportation, "nuée">;
};

export type SpécificationExporter =
  | SpécificationExporterObjet
  | SpécificationExporterNuée;

export type SpécificationImporter<T extends InfoImporter = InfoImporter> =
  BaseSpécificationAutomatisation & {
    type: "importation";
    idTableau: string;
    dispositif: string;
    source: SourceDonnéesImportationAdresseOptionel<T>;
    conversions?: { [idCol: string]: ConversionDonnées };
  };

export type InfoImporter = InfoImporterJSON | InfoImporterFeuilleCalcul;

export type InfoImporterJSON = {
  formatDonnées: "json";
  clefsRacine: ClefsExtraction;
  clefsÉléments: ClefsExtraction;
  cols: { [key: string]: ClefsExtraction };
};

export type InfoImporterFeuilleCalcul = {
  formatDonnées: "feuilleCalcul";
  nomTableau: string;
  cols: { [key: string]: string };
  optionsXLSX?: XLSXParsingOptions;
};

export type SourceDonnéesImportation<T extends InfoImporter> =
  | SourceDonnéesImportationURL<T>
  | SourceDonnéesImportationFichier<T>;

export type SourceDonnéesImportationAdresseOptionel<T extends InfoImporter> =
  | SourceDonnéesImportationURL<T>
  | SourceDonnéesImportationFichierAdresseOptionel<T>;

export type SourceDonnéesImportationURL<T extends InfoImporter> = {
  typeSource: "url";
  url: string;
  info: T;
};

export type SourceDonnéesImportationFichierAdresseOptionel<
  T extends InfoImporter,
> = {
  typeSource: "fichier";
  adresseFichier?: string;
  info: T;
};

export type SourceDonnéesImportationFichier<T extends InfoImporter> =
  SourceDonnéesImportationFichierAdresseOptionel<T> & {
    adresseFichier: string;
  };

export type SpécificationImporterAvecFichier<
  T extends InfoImporter = InfoImporter,
> = SpécificationImporter<T> & { source: SourceDonnéesImportation<T> };

// Types fréquence

export type Fréquence = FréquenceFixe | FréquenceDynamique | FréquenceManuelle;
export type FréquenceFixe = {
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
export type FréquenceDynamique = {
  type: "dynamique";
};
export type FréquenceManuelle = {
  type: "manuelle";
};

// Types état

export type ÉtatAutomatisation =
  | ÉtatErreur
  | ÉtatÉcoute
  | ÉtatAttente
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

export interface ÉtatAttente {
  type: "attente";
}

export interface ÉtatEnSync {
  type: "sync";
  depuis: number;
}

export interface ÉtatProgrammée {
  type: "programmée";
  à: number;
}

// Types service

export type StructureServiceAutomatisations = {
  [id: string]: SpécificationAutomatisation;
};

export const schémaSpécificationAutomatisation: JSONSchemaType<SpécificationAutomatisation> =
  {
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
  };

export const schémaServiceAutomatisations: JSONSchemaType<
  PartielRécursif<StructureServiceAutomatisations>
> = {
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
        required: [],
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
            required: [],
          },
          conversions: {
            type: "object",
            nullable: true,
            additionalProperties: true,
            required: [],
          },
        },
        required: [],
      },
    ],
    required: [],
  },
  required: [],
};
