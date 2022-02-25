import { optsConstellation } from "@/client";

import générerProxy, { téléClient, ProxyClientConstellation } from "./proxy";

import { MessageDeTravailleur, MessagePourTravailleur } from "./messages";

export class IPATravailleur extends téléClient {
  travailleur: Worker;

  constructor(opts: optsIpaTravailleur) {
    super();

    this.travailleur = new Worker(new URL("./travailleur.js"));
    this.travailleur.onerror = (e: ErrorEvent) => {
      this.emit("erreur", e.error);
    };
    this.travailleur.onmessage = (e: MessageEvent<MessageDeTravailleur>) => {
      this.emit("message", e.data);
    };

    this.travailleur.postMessage({ type: "init", opts });
  }

  recevoirMessage(message: MessagePourTravailleur): void {
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
  return générerProxy(new IPATravailleur(opts), souleverErreurs);
};
