export type MessageRéseauAvecExpéditeur = {
  message: MessageRéseau;
  expéditeur: string;
};

export type MessageRéseau =
  | MessageAcceptationRequêteRejoindreCompte
  | MessageAcceptationInvitationRejoindreCompte;

export const ACCEPTATION_REQUÊTE_REJOINDRE_COMPTE =
  "Requête rejoindre compte acceptée";
export type MessageAcceptationRequêteRejoindreCompte = {
  type: typeof ACCEPTATION_REQUÊTE_REJOINDRE_COMPTE;
  idCompte: string;
  codeSecret: string;
};

export const ACCEPTATION_INVITATION_REJOINDRE_COMPTE =
  "Invitation rejoindre compte acceptée";
export type MessageAcceptationInvitationRejoindreCompte = {
  type: typeof ACCEPTATION_INVITATION_REJOINDRE_COMPTE;
  idDispositif: string;
  codeSecret: string;
};
