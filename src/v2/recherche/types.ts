import type { ServicesNécessairesRecherche } from "./recherche.js";
import type { ServicesAppli } from "../nébuleuse/appli/appli.js";
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

export type SuivreObjectifRecherche<T extends InfoRésultat = InfoRésultat, S extends ServicesNécessairesRecherche = ServicesNécessairesRecherche> =
  (args: {
    services: AccesseurService<S>;
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

export type AccesseurService<T extends ServicesAppli> = <S extends keyof T>(
  service: S,
) => T[S];
