import type { Constellation, optsConstellation } from "@/client.js";

import {
  générerMandataire,
  Mandatairifiable,
  MandataireConstellation,
  MessageDIpa,
  MessagePourIpa,
  MessageErreurDIpa,
} from "@constl/mandataire";
import { EnveloppeIpa } from "@/mandataire/enveloppe.js";

export class MandataireProc extends Mandatairifiable {
  ipa: EnveloppeIpa;

  constructor(opts: optsConstellation | Constellation = {}) {
    super();

    this.ipa = new EnveloppeIpa(
      (m: MessageDIpa) => this.recevoirMessageDIpa(m),
      ({
        erreur,
        idRequête,
        code,
      }: {
        erreur: string;
        idRequête?: string;
        code?: string;
      }) => {
        const messageErreur: MessageErreurDIpa = {
          type: "erreur",
          idRequête,
          erreur,
          codeErreur: code,
        };
        this.recevoirMessageDIpa(messageErreur);
      },
      opts,
    );
  }

  envoyerMessageÀIpa(message: MessagePourIpa) {
    this.ipa.gérerMessage(message);
  }
}

export const générerMandataireProc = (
  opts: optsConstellation = {},
): MandataireConstellation<Constellation> => {
  return générerMandataire(new MandataireProc(opts));
};
