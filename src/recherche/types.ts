import type { ServicesNécessairesRecherche } from "./recherche.js";
import type { ServicesAppli } from "../nébuleuse/appli/appli.js";
import type { InfoRésultat, SuiviRecherche } from "@constl/interface/recherche";
import type { Oublier } from "@constl/interface";

export type SuivreObjectifRecherche<
  T extends InfoRésultat = InfoRésultat,
  S extends ServicesNécessairesRecherche = ServicesNécessairesRecherche,
> = (args: {
  services: AccesseurService<S>;
  idObjet: string;
  f: SuiviRecherche<T>;
}) => Promise<Oublier>;

export type AccesseurService<T extends ServicesAppli> = <S extends keyof T>(
  service: S,
) => T[S];
