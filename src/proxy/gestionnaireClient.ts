import Semaphore from "@chriscdn/promise-semaphore";

import ClientConstellation, { optsConstellation } from "@/client";
import { schémaFonctionOublier } from "@/utils";
import {
  MessagePourTravailleur,
  MessageDeTravailleur,
  MessagePrêtDeTravailleur,
  MessageActionPourTravailleur,
  MessageActionDeTravailleur,
  MessageSuivrePourTravailleur,
  MessageSuivreDeTravailleur,
  MessageSuivrePrêtDeTravailleur,
  MessageOublierPourTravailleur,
} from "./messages";

export default class GestionnaireClient {
  ipa?: ClientConstellation;
  dicFOublier: { [key: string]: schémaFonctionOublier };
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
    this.dicFOublier = {};

    this._verrou = new Semaphore();
    this.init();
  }

  async init(): Promise<void> {
    this._verrou.acquire("init");
    const messageRetour: MessagePrêtDeTravailleur = {
      type: "prêt",
    };

    if (this.ipa) {
      this.fMessage(messageRetour);
      return;
    } // Nécessaire si on a plus qu'un client connecté au même client (serveur) Constellation

    this.ipa = new ClientConstellation(this.opts);

    await this.ipa.initialiser();

    this.fMessage(messageRetour);

    this._verrou.release("init");
  }

  async gérerMessage(message: MessagePourTravailleur): Promise<void> {
    const { type } = message;
    switch (type) {
      case "suivre": {
        const { id } = message as MessageSuivrePourTravailleur;
        if (!this.ipa) this.fErreur(new Error("IPA non initialisé"), id);

        const { fonction, args, iArgFonction } =
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

        args.splice(iArgFonction, 0, fFinale);
        const fOublier = (await fonctionIPA(...args)) as schémaFonctionOublier;

        this.dicFOublier[id] = fOublier;
        const messageRetour: MessageSuivrePrêtDeTravailleur = {
          type: "suivrePrêt",
          id,
        };
        this.fMessage(messageRetour);
        break;
      }
      case "action": {
        const { id } = message as MessageActionPourTravailleur;
        if (!this.ipa) this.fErreur(new Error("IPA non initialisé"), id);

        const { fonction, args } = message as MessageActionPourTravailleur;
        const fonctionIPA = this.extraireFonctionIPA(fonction, id);
        if (!fonctionIPA) return; // L'erreur est déjà envoyée par extraireFonctionIPA

        const résultat = await fonctionIPA(...args);
        const messageRetour: MessageActionDeTravailleur = {
          type: "action",
          id,
          résultat,
        };
        this.fMessage(messageRetour);
        break;
      }
      case "oublier": {
        const { id } = message as MessageOublierPourTravailleur;
        const fOublier = this.dicFOublier[id];
        if (fOublier) fOublier();
        delete this.dicFOublier[id];
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
      | ((...args: unknown[]) => Promise<unknown>) = this.ipa;

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
