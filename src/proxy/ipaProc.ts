import OrbitDB from "orbit-db";

import générerProxy, { téléClient, ProxyClientConstellation } from "./proxy";
import {
  MessageDeTravailleur,
  MessagePourTravailleur,
  MessageErreurDeTravailleur,
} from "./messages";
import GestionnaireClient from "./gestionnaireClient";

export class IPAProc extends téléClient {
  client: GestionnaireClient;

  constructor() {
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
      }
    );
  }

  recevoirMessage(message: MessagePourTravailleur) {
    this.client.gérerMessage(message);
  }
}

export const générerProxyProc = (
  idBdRacine?: string,
  souleverErreurs = false,
  orbite?: OrbitDB,
  sujetRéseau?: string
): ProxyClientConstellation => {
  return générerProxy(
    new IPAProc(),
    souleverErreurs,
    idBdRacine,
    orbite,
    sujetRéseau
  );
};

export default générerProxyProc;
