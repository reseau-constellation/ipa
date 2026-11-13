import type { Signature } from "../orbite/orbite.js";
import type { InfosComplètesPair } from "./réseau.js";

export type MessageRéseauAvecExpéditeur = {
  message: MessageRéseau;
  expéditeur: string;
};

export type MessageRéseau =
  | MessageAcceptationRequêteRejoindreCompte
  | MessageAcceptationInvitationRejoindreCompte
  | MessageIdentitéCompte
  | MessageInfosPairs
  | MessageTexte;

export const IDENTITÉ_COMPTE = "identité compte";
export type MessageIdentitéCompte = {
  type: typeof IDENTITÉ_COMPTE;
  signature: Signature;
  identité: {
    idDispositif: string;
    idCompte: string;
    idPair: string;
  };
};

export const INFO_PAIRS = "infos pairs";
export type MessageInfosPairs = {
  type: typeof INFO_PAIRS;
  pairs: InfosComplètesPair[];
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

export const ENVOIE_TEXTE = "texte";
export type MessageTexte = {
  type: typeof ENVOIE_TEXTE;
  message: string;
};
