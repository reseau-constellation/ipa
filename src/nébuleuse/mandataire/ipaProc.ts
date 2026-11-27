import {
  générerMandataire,
  Mandatairifiable,
  EnveloppeAppli,
} from "@constl/mandataire";
import type { NestedValue } from "@orbitdb/nested-db";
import type {
  MandataireConstellation,
  MessageDIpa,
  MessageErreurDIpa,
  MessagePourIpa,
} from "@constl/mandataire";
import type { Nébuleuse } from "../index.ts";
import type { ServicesAppli } from "../appli/appli.ts";
import type { ServicesLibp2pNébuleuse } from "../services/libp2p/libp2p.ts";

export class MandataireProc<
  T extends { [clef: string]: NestedValue } = { [clef: string]: NestedValue },
  S extends ServicesAppli = ServicesAppli,
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> extends Mandatairifiable {
  nébuleuse: EnveloppeAppli<Nébuleuse<T, S, L>>;

  constructor(créerNébuleuse: () => Nébuleuse<T, S, L>) {
    super();

    this.nébuleuse = new EnveloppeAppli<Nébuleuse<T, S, L>>(
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

export const générerMandataireProcessus = <
  T extends { [clef: string]: NestedValue } = { [clef: string]: NestedValue },
  S extends ServicesAppli = ServicesAppli,
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
>(
  créerNébuleuse: () => Nébuleuse<T, S, L>,
): MandataireConstellation<Nébuleuse<T, S, L>> => {
  return générerMandataire(new MandataireProc<T, S, L>(créerNébuleuse));
};
