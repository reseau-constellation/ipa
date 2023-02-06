import type { optsConstellation } from "@/client.js";

import {
  générerMandataire,
  ClientMandatairifiable,
  MandataireClientConstellation,
} from "@constl/mandataire";

import type {
  MessageDeTravailleur,
  MessagePourTravailleur,
} from "@/mandataire/messages.js";

export class MandataireClientTravailleur extends ClientMandatairifiable {
  travailleur: Worker;

  constructor(opts: optsIpaTravailleur) {
    super();

    this.travailleur = new Worker(new URL("./travailleur.js"));
    this.travailleur.onerror = (e: ErrorEvent) => {
      this.événements.emit("erreur", { erreur: e.error });
    };
    this.travailleur.onmessage = (e: MessageEvent<MessageDeTravailleur>) => {
      this.événements.emit("message", e.data);
    };

    this.travailleur.postMessage({ type: "init", opts });
  }

  envoyerMessage(message: MessagePourTravailleur): void {
    this.travailleur.postMessage(message);
  }
}

export interface optsIpaTravailleur extends optsConstellation {
  compte?: string;
  sujetRéseau?: string;
  orbite?: {
    dossier?: string;
    sfip?: {
      dossier?: string;
    };
  };
}

export default (opts: optsIpaTravailleur = {}): MandataireClientConstellation => {
  return générerMandataire(new MandataireClientTravailleur(opts));
};
