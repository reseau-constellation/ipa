export interface MessageDeTravailleur {
  type: "prêt" | "suivre" | "suivrePrêt" | "action" | "erreur";
  id?: string;
}

export interface MessagePrêtDeTravailleur extends MessageDeTravailleur {
  type: "prêt";
}

export interface MessageSuivreDeTravailleur extends MessageDeTravailleur {
  type: "suivre";
  id: string;
  données: unknown;
}

export interface MessageSuivrePrêtDeTravailleur extends MessageDeTravailleur {
  type: "suivrePrêt";
  id: string;
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
  type: "oublier" | "suivre" | "action";
  id?: string;
}

export interface MessageSuivrePourTravailleur extends MessagePourTravailleur {
  type: "suivre";
  id: string;
  fonction: string[];
  args: unknown[];
  iArgFonction: number;
}

export interface MessageActionPourTravailleur extends MessagePourTravailleur {
  type: "action";
  id: string;
  fonction: string[];
  args: unknown[];
}

export interface MessageOublierPourTravailleur extends MessagePourTravailleur {
  type: "oublier";
  id: string;
}
