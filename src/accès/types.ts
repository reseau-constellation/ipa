import { rôles } from "./consts";

export type entréeBDAccès = {
  rôle: typeof rôles[number];
  id: string;
};

export type infoUtilisateur = {
  rôle: typeof rôles[number];
  idBdRacine: string;
};

export type objRôles = { [key in typeof rôles[number]]: string[] };
