import Semaphore from "@chriscdn/promise-semaphore";

import ClientConstellation, { optsConstellation } from "@/client.js";
import type { schémaFonctionOublier } from "@/utils/index.js";
import type {
  MessagePourTravailleur,
  MessageDeTravailleur,
  MessageActionPourTravailleur,
  MessageActionDeTravailleur,
  MessageSuivrePourTravailleur,
  MessageSuivreDeTravailleur,
  MessageSuivrePrêtDeTravailleur,
  MessageRetourPourTravailleur,
} from "./messages.js";

export default class GestionnaireClient {
  ipa?: ClientConstellation;
  _messagesEnAttente: MessagePourTravailleur[];
  prêt: boolean;
  dicFRetourSuivi: {
    [key: string]: { fOublier: schémaFonctionOublier } & {
      [key: string]: (...args: unknown[]) => void;
    };
  };
  opts: optsConstellation;

  fMessage: (m: MessageDeTravailleur) => void;
  fErreur: (e: string, idRequète?: string) => void;

  _verrou: Semaphore;

  constructor(
    fMessage: (m: MessageDeTravailleur) => void,
    fErreur: (e: string, idRequète?: string) => void,
    opts: optsConstellation = {}
  ) {
    this.fMessage = fMessage;
    this.fErreur = fErreur;
    this.opts = opts;
    this.dicFRetourSuivi = {};

    this.prêt = false;
    this._messagesEnAttente = [];
    this._verrou = new Semaphore();

    this.init();
  }

  async init(): Promise<void> {
    await this._verrou.acquire("init");

    if (this.ipa) {
      this._verrou.release("init");
      return;
    } // Nécessaire si on a plus qu'un mandataire client connecté au même client Constellation

    this.ipa = await ClientConstellation.créer(this.opts);

    this._messagesEnAttente.forEach((m) => this._gérerMessage(m));
    this.prêt = true;
    this._verrou.release("init");
  }

  async gérerMessage(message: MessagePourTravailleur): Promise<void> {
    if (this.prêt) {
      await this._gérerMessage(message);
    } else {
      this._messagesEnAttente.unshift(message);
    }
  }

  async _gérerMessage(message: MessagePourTravailleur): Promise<void> {
    const { type } = message;
    switch (type) {
      case "suivre": {
        const { id } = message as MessageSuivrePourTravailleur;
        if (!this.ipa) this.fErreur("IPA non initialisé", id);

        const { fonction, args, nomArgFonction } =
          message as MessageSuivrePourTravailleur;
        const fonctionIPA = this.extraireFonctionIPA(fonction, id);
        if (!fonctionIPA) return; // L'erreur est déjà envoyée par extraireFonctionIPA

        const fFinale = (données: unknown) => {
          const messageRetour: MessageSuivreDeTravailleur = {
            type: "suivre",
            id,
            données,
          };
          this.fMessage(messageRetour);
        };

        args[nomArgFonction] = fFinale;

        try {
          const retour = (await fonctionIPA(args)) as
            | schémaFonctionOublier
            | {
                fOublier: schémaFonctionOublier;
                [key: string]: (...args: unknown[]) => void;
              };
          const retourFinal =
            typeof retour === "function" ? { fOublier: retour } : retour;

          this.dicFRetourSuivi[id] = retourFinal;
          const messageRetour: MessageSuivrePrêtDeTravailleur = {
            type: "suivrePrêt",
            id,
          };
          if (typeof retour !== "function")
            messageRetour.fonctions = Object.keys(retour);
          this.fMessage(messageRetour);
        } catch (e) {
          this.fErreur(e, id);
        }

        break;
      }
      case "action": {
        const { id } = message as MessageActionPourTravailleur;
        if (!this.ipa) this.fErreur("IPA non initialisé", id);

        const { fonction, args } = message as MessageActionPourTravailleur;
        const fonctionIPA = this.extraireFonctionIPA(fonction, id);
        if (!fonctionIPA) return; // L'erreur est déjà envoyée par extraireFonctionIPA

        try {
          const résultat = await fonctionIPA(args);
          const messageRetour: MessageActionDeTravailleur = {
            type: "action",
            id,
            résultat,
          };
          this.fMessage(messageRetour);
        } catch (e) {
          this.fErreur(e, id);
        }

        break;
      }
      case "retour": {
        const { id, fonction, args } = message as MessageRetourPourTravailleur;
        const retour = this.dicFRetourSuivi[id];
        if (retour) await retour[fonction](args);
        if (fonction === "fOublier") delete this.dicFRetourSuivi[id];
        break;
      }
      default: {
        this.fErreur(
          `Type de requète ${type} non reconnu dans message ${message}`,
          message.id
        );
        break;
      }
    }
  }

  extraireFonctionIPA(
    adresseFonction: string[],
    idMessage: string
  ): ((...args: any[]) => any) | undefined {
    const erreur = `Fonction ClientConstellation.${adresseFonction.join(
      "."
    )} n'existe pas ou n'est pas une fonction.`;

    let fonctionIPA:
      | ClientConstellation
      | ClientConstellation[keyof ClientConstellation]
      | ((args: { [key: string]: unknown }) => Promise<unknown>) = this.ipa;

    for (const [i, attr] of adresseFonction.entries()) {
      // Vive JavaScript et `this`!
      if (i === adresseFonction.length - 1) {
        if (
          typeof fonctionIPA === "object" &&
          attr in fonctionIPA &&
          fonctionIPA[attr as keyof typeof fonctionIPA]
        ) {
          // @ts-ignore
          fonctionIPA = fonctionIPA[attr].bind(fonctionIPA);
        } else {
          this.fErreur(erreur, idMessage);
          return undefined;
        }
      } else {
        if (
          typeof fonctionIPA === "object" &&
          attr in fonctionIPA &&
          fonctionIPA[attr as keyof typeof fonctionIPA]
        ) {
          fonctionIPA = fonctionIPA[attr as keyof typeof fonctionIPA];
        } else {
          this.fErreur(erreur, idMessage);
          return undefined;
        }
      }

      if (!fonctionIPA) {
        this.fErreur(erreur, idMessage);
        return undefined;
      }
    }
    if (typeof fonctionIPA !== "function") {
      this.fErreur(erreur, idMessage);
      return undefined;
    }
    return fonctionIPA;
  }

  async fermer(): Promise<void> {
    // Avant de fermer, il faut être sûr qu'on a bien initialisé !
    await this.init();
    await this.ipa.fermer();
  }
}
