import OrbitDB from "orbit-db";

import { optsConstellation } from "@/client";

import générerProxy, { téléClient, ProxyClientConstellation } from "./proxy";
import {
  MessageDeTravailleur,
  MessagePourTravailleur,
  MessageErreurDeTravailleur,
} from "./messages";
import GestionnaireClient from "./gestionnaireClient";

export class IPAProc extends téléClient {
  client: GestionnaireClient;

  constructor(opts: optsConstellation = {}) {
    super();

    this.client = new GestionnaireClient(
      (e: MessageDeTravailleur) => {
        this.emit("message", e);
      },
      (erreur: Error, id?: string) => {
        const messageErreur: MessageErreurDeTravailleur = {
          type: "erreur",
          id,
          erreur,
        };
        this.emit("erreur", messageErreur);
      },
      opts
    );
  }

  recevoirMessage(message: MessagePourTravailleur) {
    this.client.gérerMessage(message);
  }
}

export const générerProxyProc = (
  opts: optsConstellation = {},
  souleverErreurs = false,
): ProxyClientConstellation => {
  return générerProxy(
    new IPAProc(opts),
    souleverErreurs,
  );
};

export default générerProxyProc;
