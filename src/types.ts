import { JSONSchemaType } from "ajv";
import type { objRôles } from "@/accès/types.js";
import type { Constellation } from "@/client.js";

// https://stackoverflow.com/questions/41980195/recursive-partialt-in-typescript
export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object | undefined
      ? RecursivePartial<T[P]>
      : T[P];
};

// https://hackernoon.com/mastering-type-safe-json-serialization-in-typescript
type PrimitifJson = string | number | boolean | null | undefined;
export type Jsonifiable =
  | PrimitifJson
  | Jsonifiable[]
  | {
      [key: string]: Jsonifiable;
    };

export interface infoAuteur {
  idCompte: string;
  accepté: boolean;
  rôle: keyof objRôles;
}

export type élémentsBd =
  | number
  | boolean
  | string
  | { [clef: string]: élémentsBd }
  | Array<élémentsBd>;

export type TYPES_STATUT = "interne" | "jouet" | "active" | "obsolète";

export type schémaStatut = {
  statut: TYPES_STATUT;
  idNouvelle?: string;
};

export type TraducsNom = { [langue: string]: string };

export type schémaFonctionSuivi<T> =
  | ((x: T) => void)
  | ((x: T) => Promise<void>);

export type schémaFonctionOublier = () => Promise<void>;

export type schémaRetourFonctionRechercheParProfondeur = {
  fOublier: schémaFonctionOublier;
  fChangerProfondeur: (p: number) => Promise<void>;
};

export type schémaRetourFonctionRechercheParN = {
  fOublier: schémaFonctionOublier;
  fChangerN: (n: number) => Promise<void>;
};

export interface infoRésultatTexte {
  type: "texte";
  texte: string;
  début: number;
  fin: number;
}

export interface infoRésultatVide {
  type: "vide";
}

export interface infoRésultatRecherche<T extends infoRésultat = infoRésultat> {
  type: "résultat";
  de: string;
  clef?: string;
  info: T;
}

export type infoRésultat =
  | infoRésultatTexte
  | infoRésultatVide
  | infoRésultatRecherche;

export interface résultatObjectifRecherche<T extends infoRésultat>
  extends infoRésultatRecherche<T> {
  score: number;
}

export interface résultatRecherche<T extends infoRésultat> {
  résultatObjectif: résultatObjectifRecherche<T>;
  id: string;
}

export type schémaFonctionSuivreObjectifRecherche<T extends infoRésultat> = (
  client: Constellation,
  id: string,
  f: schémaFonctionSuiviRecherche<T>,
) => Promise<schémaFonctionOublier>;

export type schémaFonctionSuiviRecherche<T extends infoRésultat> = (
  résultat?: résultatObjectifRecherche<T>,
) => Promise<void> | void;

export type schémaFonctionSuivreConfianceRecherche = (
  id: string,
  f: schémaFonctionSuivi<number>,
) => Promise<schémaFonctionOublier>;

export type schémaFonctionSuivreQualitéRecherche = (
  id: string,
  f: schémaFonctionSuivi<number>,
) => Promise<schémaFonctionOublier>;

export type structureBdNoms = { [langue: string]: string };
export const schémaStructureBdNoms: JSONSchemaType<structureBdNoms> = {
  type: "object",
  additionalProperties: {
    type: "string",
  },
  required: [],
};

export type structureBdMétadonnées = { [langue: string]: élémentsBd };
export const schémaStructureBdMétadonnées: JSONSchemaType<structureBdMétadonnées> =
  {
    type: "object",
    additionalProperties: true,
    required: [],
  };

export type PasNondéfini<T = unknown> = T extends undefined ? never : T;
