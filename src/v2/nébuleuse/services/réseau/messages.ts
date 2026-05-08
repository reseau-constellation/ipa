import type { Signature } from "../orbite/orbite.js";

export type MessageRéseauAvecExpéditeur = {
  message: MessageRéseau;
  expéditeur: string;
};

export type MessageRéseau =
  | MessageAcceptationRequêteRejoindreCompte
  | MessageAcceptationInvitationRejoindreCompte
  | MessageIdentitéCompte;

export const IDENTITÉ_COMPTE = "identité compte";
export type MessageIdentitéCompte = {
  type: typeof IDENTITÉ_COMPTE;
  idDispositif: string;
  idCompte: string;
  signature: Signature;
};

export const ACCEPTATION_REQUÊTE_REJOINDRE_COMPTE =
  "Requête rejoindre compte acceptée";
export type MessageAcceptationRequêteRejoindreCompte = {
  type: typeof ACCEPTATION_REQUÊTE_REJOINDRE_COMPTE;
  idCompte: string;
  empreinteCode: string;
};

export const ACCEPTATION_INVITATION_REJOINDRE_COMPTE =
  "Invitation rejoindre compte acceptée";
export type MessageAcceptationInvitationRejoindreCompte = {
  type: typeof ACCEPTATION_INVITATION_REJOINDRE_COMPTE;
  idDispositif: string;
  empreinteCode: string;
};
