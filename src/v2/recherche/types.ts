import type { ServicesConstellation } from "../constellation.js";
import type { Oublier, Suivi } from "../nébuleuse/types.js";

export interface InfoRésultatTexte {
  type: "texte";
  texte: string;
  début: number;
  fin: number;
}

export interface InfoRésultatVide {
  type: "vide";
}

export interface InfoRésultatRecherche<T extends InfoRésultat = InfoRésultat> {
  type: "résultat";
  de: string;
  clef?: string;
  info: T;
}

export type InfoRésultat =
  | InfoRésultatTexte
  | InfoRésultatVide
  | InfoRésultatRecherche;

export interface RésultatObjectifRecherche<
  T extends InfoRésultat = InfoRésultat,
> extends InfoRésultatRecherche<T> {
  score: number;
}

export interface RésultatRecherche<T extends InfoRésultat = InfoRésultat> {
  résultatObjectif: RésultatObjectifRecherche<T>;
  id: string;
}

export type SuivreObjectifRecherche<T extends InfoRésultat = InfoRésultat> =
  (args: {
    services: ServicesConstellation;
    idObjet: string;
    f: SuiviRecherche<T>;
  }) => Promise<Oublier>;

export type SuiviRecherche<T extends InfoRésultat> = (
  résultat?: RésultatObjectifRecherche<T>,
) => Promise<void> | void;

export type SuivreConfianceRecherche = (args: {
  idObjet: string;
  f: Suivi<number>;
}) => Promise<Oublier>;

export type SuivreQualitéRecherche = (args: {
  idObjet: string;
  f: Suivi<number>;
}) => Promise<Oublier>;
