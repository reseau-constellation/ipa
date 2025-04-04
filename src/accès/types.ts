import type { rôles } from "@/accès/consts.js";

export type élémentBdAccès = {
  rôle: (typeof rôles)[number];
  id: string;
};

export type infoUtilisateur = {
  rôle: (typeof rôles)[number];
  idCompte: string;
};

export type objRôles = { [key in (typeof rôles)[number]]: Set<string> };
