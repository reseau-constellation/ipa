import { optsConstellation } from "@/client";

import {
  générerProxy,
  ClientProxifiable,
  ProxyClientConstellation,
} from "./proxy";

import { MessageDeTravailleur, MessagePourTravailleur } from "./messages";

export class ProxyClientTravailleur extends ClientProxifiable {
  travailleur: Worker;

  constructor(opts: optsIpaTravailleur, souleverErreurs = false) {
    super(souleverErreurs);

    this.travailleur = new Worker(new URL("./travailleur.js"));
    this.travailleur.onerror = (e: ErrorEvent) => {
      this.événements.emit("erreur", e.error);
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

export default (
  opts: optsIpaTravailleur = {},
  souleverErreurs = false
): ProxyClientConstellation => {
  return générerProxy(new ProxyClientTravailleur(opts, souleverErreurs));
};
