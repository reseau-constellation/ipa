export type MessageDeTravailleur = MessageSuivreDeTravailleur | MessageSuivrePrêtDeTravailleur | MessageActionDeTravailleur | MessageErreurDeTravailleur;

export interface MessageSuivreDeTravailleur {
  type: "suivre";
  id: string;
  données: unknown;
}

export interface MessageSuivrePrêtDeTravailleur {
  type: "suivrePrêt";
  id: string;
  fonctions?: string[];
}

export interface MessageActionDeTravailleur {
  type: "action";
  id: string;
  résultat: unknown;
}

export interface MessageErreurDeTravailleur {
  type: "erreur";
  id?: string;
  erreur: string;
}

export type MessagePourTravailleur = MessageSuivrePourTravailleur | MessageActionPourTravailleur | MessageRetourPourTravailleur;

export interface MessageSuivrePourTravailleur {
  type: "suivre";
  id: string;
  fonction: string[];
  args: { [key: string]: unknown };
  nomArgFonction: string;
}

export interface MessageActionPourTravailleur {
  type: "action";
  id: string;
  fonction: string[];
  args: { [key: string]: unknown };
}

export interface MessageRetourPourTravailleur {
  type: "retour";
  id: string;
  fonction: string;
  args?: unknown[];
}
