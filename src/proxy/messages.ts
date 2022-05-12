export interface MessageDeTravailleur {
  type: "suivre" | "suivrePrêt" | "action" | "erreur";
  id?: string;
}

export interface MessageSuivreDeTravailleur extends MessageDeTravailleur {
  type: "suivre";
  id: string;
  données: unknown;
}

export interface MessageSuivrePrêtDeTravailleur extends MessageDeTravailleur {
  type: "suivrePrêt";
  id: string;
  fonctions?: string[];
}

export interface MessageActionDeTravailleur extends MessageDeTravailleur {
  type: "action";
  id: string;
  résultat: unknown;
}

export interface MessageErreurDeTravailleur extends MessageDeTravailleur {
  type: "erreur";
  id?: string;
  erreur: Error;
}

export interface MessagePourTravailleur {
  type: "retour" | "suivre" | "action";
  id?: string;
}

export interface MessageSuivrePourTravailleur extends MessagePourTravailleur {
  type: "suivre";
  id: string;
  fonction: string[];
  args: { [key: string]: unknown };
  nomArgFonction: string;
}

export interface MessageActionPourTravailleur extends MessagePourTravailleur {
  type: "action";
  id: string;
  fonction: string[];
  args: { [key: string]: unknown };
}

export interface MessageRetourPourTravailleur extends MessagePourTravailleur {
  type: "retour";
  id: string;
  fonction: string;
  args?: unknown[];
}
