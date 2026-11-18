import type { rôles } from "@/nébuleuse/services/compte/accès/consts.js";

export type Rôle = (typeof rôles)[number];

export type AccèsUtilisateur = {
  rôle: Rôle;
  idCompte: string;
};

export type AccèsDispositif = {
  rôle: Rôle;
  idDispositif: string;
};
