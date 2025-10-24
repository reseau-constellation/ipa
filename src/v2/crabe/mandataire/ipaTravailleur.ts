import {
  générerMandataire,
  MandataireConstellation,
  Mandatairifiable,
  type MessageDIpa,
  type MessagePourIpa,
} from "@constl/mandataire";
import { Constellation } from "@/client.js";
import { Crabe, OptionsDeCrabe } from "../crabe.js";

export class MandataireTravailleur<T extends Crabe> extends Mandatairifiable {
  travailleur: Worker;

  constructor(opts: OptionsDeCrabe<T>) {
    super();

    this.travailleur = new Worker(new URL("./travailleur.js"));
    this.travailleur.onerror = (e: ErrorEvent) => {
      this.recevoirMessageDIpa({ type: "erreur", erreur: e.error });
    };
    this.travailleur.onmessage = (e: MessageEvent<MessageDIpa>) => {
      this.recevoirMessageDIpa(e.data);
    };

    this.travailleur.postMessage({ type: "init", opts });
  }

  envoyerMessageÀIpa(message: MessagePourIpa): void {
    this.travailleur.postMessage(message);
  }
}

export const générerMandataireTravailleur = <T extends Crabe>(
  opts: OptionsDeCrabe<T>,
): MandataireConstellation<Constellation> => {
  return générerMandataire(new MandataireTravailleur(opts));
};
