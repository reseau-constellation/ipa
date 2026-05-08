import { générerMandataire, Mandatairifiable } from "@constl/mandataire";
import { EnveloppeNébuleuse } from "./enveloppe.js";
import type {
  MandataireConstellation,
  MessageDIpa,
  MessageErreurDIpa,
  MessagePourIpa,
} from "@constl/mandataire";

import type { Nébuleuse } from "../index.js";

export class MandataireProc<T extends Nébuleuse> extends Mandatairifiable {
  nébuleuse: EnveloppeNébuleuse<T>;

  constructor(créerNébuleuse: () => Promise<T>) {
    super();

    this.nébuleuse = new EnveloppeNébuleuse(
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
      créerNébuleuse,
    );
  }

  envoyerMessageÀIpa(message: MessagePourIpa) {
    this.nébuleuse.gérerMessage(message);
  }
}

export const générerMandataireProcessus = <T extends Nébuleuse>(
  créerNébuleuse: () => Promise<T>,
): MandataireConstellation<T> => {
  return générerMandataire(new MandataireProc(créerNébuleuse));
};
