import type { Constellation, optsConstellation } from "@/client.js";

import {
  générerMandataire,
  Mandatairifiable,
  MandataireConstellation,
  MessageDIpa,
  MessagePourIpa,
  MessageErreurDIpa,
} from "@constl/mandataire";
import { GestionnaireClient } from "@/mandataire/gestionnaireClient.js";

export class MandataireProc extends Mandatairifiable {
  client: GestionnaireClient;

  constructor(opts: optsConstellation | Constellation = {}) {
    super();

    this.client = new GestionnaireClient(
      (m: MessageDIpa) => this.recevoirMessageDIpa(m),
      ({
        erreur,
        idRequète,
        code,
      }: {
        erreur: string;
        idRequète?: string;
        code?: string;
      }) => {
        const messageErreur: MessageErreurDIpa = {
          type: "erreur",
          id: idRequète,
          erreur,
          codeErreur: code,
        };
        this.recevoirMessageDIpa(messageErreur);
      },
      opts,
    );
  }

  envoyerMessageÀIpa(message: MessagePourIpa) {
    this.client.gérerMessage(message);
  }
}

export const générerMandataireProc = (
  opts: optsConstellation = {},
): MandataireConstellation<Constellation> => {
  return générerMandataire(new MandataireProc(opts));
};
