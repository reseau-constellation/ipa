import { optsConstellation } from "@/client.js";

import {
  générerProxy,
  ClientProxifiable,
  ProxyClientConstellation,
} from "./proxy.js";
import {
  MessageDeTravailleur,
  MessagePourTravailleur,
  MessageErreurDeTravailleur,
} from "./messages.js";
import GestionnaireClient from "./gestionnaireClient.js";

export class ProxyClientProc extends ClientProxifiable {
  client: GestionnaireClient;

  constructor(opts: optsConstellation = {}) {
    super();

    this.client = new GestionnaireClient(
      (m: MessageDeTravailleur) => {
        this.événements.emit("message", m);
      },
      (erreur: string, id?: string) => {
        const messageErreur: MessageErreurDeTravailleur = {
          type: "erreur",
          id,
          erreur,
        };
        this.événements.emit("message", messageErreur);
      },
      opts
    );
  }

  envoyerMessage(message: MessagePourTravailleur) {
    this.client.gérerMessage(message);
  }
}

export const générerProxyProc = (
  opts: optsConstellation = {},
): ProxyClientConstellation => {
  return générerProxy(new ProxyClientProc(opts));
};

export default générerProxyProc;
