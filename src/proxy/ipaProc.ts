import { optsConstellation } from "@/client";

import { générerProxy, ClientProxifiable, ProxyClientConstellation } from "./proxy";
import {
  MessageDeTravailleur,
  MessagePourTravailleur,
  MessageErreurDeTravailleur,
} from "./messages";
import GestionnaireClient from "./gestionnaireClient";

export class ProxyClientProc extends ClientProxifiable {
  client: GestionnaireClient;

  constructor(opts: optsConstellation = {}, souleverErreurs = false) {
    super(souleverErreurs);

    this.client = new GestionnaireClient(
      (e: MessageDeTravailleur) => {
        this.événements.emit("message", e);
      },
      (erreur: Error, id?: string) => {
        const messageErreur: MessageErreurDeTravailleur = {
          type: "erreur",
          id,
          erreur,
        };
        this.événements.emit("erreur", messageErreur);
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
  souleverErreurs = false
): ProxyClientConstellation => {
  return générerProxy(new ProxyClientProc(opts, souleverErreurs));
};

export default générerProxyProc;
