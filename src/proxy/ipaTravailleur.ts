import { optsConstellation } from "@/client.js";

import {
  générerProxy,
  ClientProxifiable,
  ProxyClientConstellation,
} from "@/proxy/proxy.js";

import { MessageDeTravailleur, MessagePourTravailleur } from "@/proxy/messages.js";

export class ProxyClientTravailleur extends ClientProxifiable {
  travailleur: Worker;

  constructor(opts: optsIpaTravailleur) {
    super();

    this.travailleur = new Worker(new URL("./travailleur"));
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

export default (opts: optsIpaTravailleur = {}): ProxyClientConstellation => {
  return générerProxy(new ProxyClientTravailleur(opts));
};
