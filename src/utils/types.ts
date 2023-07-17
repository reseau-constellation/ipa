import type { objRôles } from "@/accès/types.js";
import type { default as ClientConstellation } from "@/client.js";
import { JSONSchemaType } from "ajv";

export interface infoAuteur {
  idBdCompte: string;
  accepté: boolean;
  rôle: keyof objRôles;
}

export type élémentsBd =
  | number
  | boolean
  | string
  | { [key: string]: élémentsBd }
  | Array<élémentsBd>;

export enum TYPES_STATUT {
  INTERNE = "interne",
  BÊTA = "bêta",
  ACTIVE = "active",
  OBSOLÈTE = "obsolète",
}

export type schémaStatut = {
  statut: TYPES_STATUT;
  idNouvelle?: string;
}

export type dicTrads = { [key: string]: string };

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
  fChangerN: (p: number) => Promise<void>;
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
  client: ClientConstellation,
  id: string,
  f: schémaFonctionSuiviRecherche<T>
) => Promise<schémaFonctionOublier>;

export type schémaFonctionSuiviRecherche<T extends infoRésultat> = (
  résultat?: résultatObjectifRecherche<T>
) => void;

export type schémaFonctionSuivreConfianceRecherche = (
  id: string,
  f: schémaFonctionSuivi<number>
) => Promise<schémaFonctionOublier>;

export type schémaFonctionSuivreQualitéRecherche = (
  id: string,
  f: schémaFonctionSuivi<number>
) => Promise<schémaFonctionOublier>;

export type structureBdNoms = {[langue: string]: string};
export const schémaStructureBdNoms: JSONSchemaType<structureBdNoms> = {
  type: "object",
  additionalProperties: {
    type: "string",
  },
  required: [],
}