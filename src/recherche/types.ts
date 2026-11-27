import type { ServicesNécessairesRecherche } from "./recherche.js";
import type { ServicesAppli } from "../nébuleuse/appli/appli.js";
import type { Oublier } from "../../src/nébuleuse/types.js";
import type {
  InfoRésultat,
  RésultatObjectifRecherche,
} from "@constl/interface";

export type SuivreObjectifRecherche<
  T extends InfoRésultat = InfoRésultat,
  S extends ServicesNécessairesRecherche = ServicesNécessairesRecherche,
> = (args: {
  services: AccesseurService<S>;
  idObjet: string;
  f: SuiviRecherche<T>;
}) => Promise<Oublier>;

export type SuiviRecherche<T extends InfoRésultat> = (
  résultat?: RésultatObjectifRecherche<T>,
) => Promise<void> | void;

export type AccesseurService<T extends ServicesAppli> = <S extends keyof T>(
  service: S,
) => T[S];
