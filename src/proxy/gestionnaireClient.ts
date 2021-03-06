import Semaphore from "@chriscdn/promise-semaphore";

import ClientConstellation, { optsConstellation } from "@/client";
import { schémaFonctionOublier } from "@/utils";
import {
  MessagePourTravailleur,
  MessageDeTravailleur,
  MessageActionPourTravailleur,
  MessageActionDeTravailleur,
  MessageSuivrePourTravailleur,
  MessageSuivreDeTravailleur,
  MessageSuivrePrêtDeTravailleur,
  MessageRetourPourTravailleur,
} from "./messages";

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
  fErreur: (e: Error, idRequète?: string) => void;

  _verrou: Semaphore;

  constructor(
    fMessage: (m: MessageDeTravailleur) => void,
    fErreur: (e: Error, idRequète?: string) => void,
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
    this._verrou.acquire("init");

    if (this.ipa) {
      return;
    } // Nécessaire si on a plus qu'un proxy client connecté au même client Constellation

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
        if (!this.ipa) this.fErreur(new Error("IPA non initialisé"), id);

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
        break;
      }
      case "action": {
        const { id } = message as MessageActionPourTravailleur;
        if (!this.ipa) this.fErreur(new Error("IPA non initialisé"), id);

        const { fonction, args } = message as MessageActionPourTravailleur;
        const fonctionIPA = this.extraireFonctionIPA(fonction, id);
        if (!fonctionIPA) return; // L'erreur est déjà envoyée par extraireFonctionIPA

        const résultat = await fonctionIPA(args);
        const messageRetour: MessageActionDeTravailleur = {
          type: "action",
          id,
          résultat,
        };
        this.fMessage(messageRetour);
        break;
      }
      case "retour": {
        const { id, fonction } = message as MessageRetourPourTravailleur;
        const retour = this.dicFRetourSuivi[id];
        if (retour) retour[fonction]();
        if (fonction === "fOublier") delete this.dicFRetourSuivi[id];
        break;
      }
      default: {
        this.fErreur(
          new Error(
            `Type de requète ${type} non reconnu dans message ${message}`
          ),
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
    const erreur = new Error(
      `Fonction ClientConstellation.${adresseFonction.join(
        "."
      )} n'existe pas ou n'est pas une fonction.`
    );

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
          return;
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
          return;
        }
      }

      if (!fonctionIPA) {
        this.fErreur(erreur, idMessage);
        return;
      }
    }
    if (typeof fonctionIPA !== "function") {
      this.fErreur(erreur, idMessage);
      return;
    }
    return fonctionIPA;
  }

  async fermer(): Promise<void> {
    if (this.ipa) {
      await this.ipa.fermer();
    }
  }
}
