import {
  générerMandataire,
  MandataireConstellation,
  Mandatairifiable,
  MessageDIpa,
  MessageErreurDIpa,
  MessagePourIpa,
} from "@constl/mandataire";

import { Crabe } from "../index.js";
import { EnveloppeCrabe } from "./enveloppe.js";

export class MandataireProc<T extends Crabe> extends Mandatairifiable {
  crabe: EnveloppeCrabe<T>;

  constructor(créerCrabe: () => Promise<T>) {
    super();

    this.crabe = new EnveloppeCrabe(
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
      créerCrabe,
    );
  }

  envoyerMessageÀIpa(message: MessagePourIpa) {
    this.crabe.gérerMessage(message);
  }
}

export const générerMandataireProcessus = <T extends Crabe>(
  créerCrabe: () => Promise<T>,
): MandataireConstellation<T> => {
  return générerMandataire(new MandataireProc(créerCrabe));
};
