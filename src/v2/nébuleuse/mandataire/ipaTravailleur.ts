import { générerMandataire, Mandatairifiable } from "@constl/mandataire";
import type {
  MessageDIpa,
  MessagePourIpa,
  MandataireConstellation,
} from "@constl/mandataire";
import type { Constellation } from "@/client.js";
import type { Nébuleuse, OptionsDeNébuleuse } from "../nébuleuse.js";

export class MandataireTravailleur<T extends Nébuleuse> extends Mandatairifiable {
  travailleur: Worker;

  constructor(opts: OptionsDeNébuleuse<T>) {
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

export const générerMandataireTravailleur = <T extends Nébuleuse>(
  opts: OptionsDeNébuleuse<T>,
): MandataireConstellation<Constellation> => {
  return générerMandataire(new MandataireTravailleur(opts));
};
