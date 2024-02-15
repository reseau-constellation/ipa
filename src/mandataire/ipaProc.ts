import type { ClientConstellation, optsConstellation } from "@/client.js";

import {
  générerMandataire,
  ClientMandatairifiable,
  MandataireClientConstellation,
} from "@constl/mandataire";
import type {
  MessageDeTravailleur,
  MessagePourTravailleur,
  MessageErreurDeTravailleur,
} from "@/mandataire/messages.js";
import { GestionnaireClient } from "@/mandataire/gestionnaireClient.js";

export class MandataireClientProc extends ClientMandatairifiable {
  client: GestionnaireClient;

  constructor(opts: optsConstellation | ClientConstellation = {}) {
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
      opts,
    );
  }

  envoyerMessage(message: MessagePourTravailleur) {
    this.client.gérerMessage(message);
  }
}

export const générerMandataireProc = (
  opts: optsConstellation = {},
): MandataireClientConstellation<ClientConstellation> => {
  return générerMandataire(new MandataireClientProc(opts));
};
