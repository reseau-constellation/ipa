import { objRôles } from "@/accès/types";
import ClientConstellation from "@/client";

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

export interface schémaStatut {
  statut: TYPES_STATUT;
  idNouvelle?: string;
}

export type dicTrads = { [key: string]: string };

export type schémaFonctionSuivi<T> = (x: T) => void;

export type schémaFonctionOublier = () => void;

export interface infoRésultatTexte {
  texte: string;
  début: number;
  fin: number;
}

export interface infoRésultatVide {}

export interface infoRésultatRecherche {
  de: string;
  clef?: string;
  info: infoRésultatTexte | infoRésultatVide | infoRésultatRecherche;
}

export interface résultatRecherche extends infoRésultatRecherche {
  score: number;
}

export type schémaFonctionRecherche = (
  client: ClientConstellation,
  id: string,
  f: schémaFonctionSuivi<résultatRecherche|undefined>
) => Promise<schémaFonctionOublier>;

export type schémaFonctionSuiviRecherche = (x?: résultatRecherche) => void;
