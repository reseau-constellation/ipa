import ClientConstellation, { schémaFonctionOublier } from "../client";

import {
  MessagePourTravailleur,
  MessageDeTravailleur,
  MessageInitPourTravailleur,
  MessagePrêtDeTravailleur,
  MessageActionPourTravailleur,
  MessageActionDeTravailleur,
  MessageSuivrePourTravailleur,
  MessageSuivreDeTravailleur,
  MessageSuivrePrêtDeTravailleur,
  MessageOublierPourTravailleur,
} from "./proxy";

export default class GestionnaireClient {
  ipa?: ClientConstellation;
  dicFOublier: { [key: string]: schémaFonctionOublier };

  fMessage: (m: MessageDeTravailleur) => void;
  fErreur: (e: Error) => void;

  constructor(
    fMessage: (m: MessageDeTravailleur) => void,
    fErreur: (e: Error) => void
  ) {

    this.fMessage = fMessage;
    this.fErreur = fErreur;
    this.dicFOublier = {};
  }

  async gérerMessage(message: MessagePourTravailleur): Promise<void> {
    const { type } = message;
    switch (type) {
      case "init": {
        if (this.ipa) return; //Au cas où

        const { idBdRacine, orbite, sujetRéseau } = message as MessageInitPourTravailleur;
        this.ipa = new ClientConstellation(idBdRacine, undefined, orbite, sujetRéseau);

        await this.ipa.initialiser();
        const messageRetour: MessagePrêtDeTravailleur = {
          type: "prêt",
        };

        this.fMessage(messageRetour);
        break;
      }
      case "suivre": {
        if (!this.ipa) this.fErreur(new Error("IPA non initialisé"));

        const { id, fonction, args, iArgFonction } =
          message as MessageSuivrePourTravailleur;
        const fonctionIPA = this.extraireFonctionIPA(fonction);
        if (!fonctionIPA) return; //L'erreur est déjà envoyée par extraireFonctionIPA

        const fFinale = (données: unknown) => {
          const messageRetour: MessageSuivreDeTravailleur = {
            type: "suivre",
            id,
            données,
          };
          this.fMessage(messageRetour);
        };

        args.splice(iArgFonction, 0, fFinale);
        const fSuivre = (await fonctionIPA(...args)) as schémaFonctionOublier;

        this.dicFOublier[id] = fSuivre;
        const messageRetour: MessageSuivrePrêtDeTravailleur = {
          type: "suivrePrêt",
          id,
        };
        this.fMessage(messageRetour);
        break;
      }
      case "action": {
        if (!this.ipa) this.fErreur(new Error("IPA non initialisé"));
        const { id, fonction, args } = message as MessageActionPourTravailleur;
        const fonctionIPA = this.extraireFonctionIPA(fonction);
        if (!fonctionIPA) return; //L'erreur est déjà envoyée par extraireFonctionIPA

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
          )
        );
        break;
      }
    }
  }

  extraireFonctionIPA(
    adresseFonction: string[]
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
          //@ts-ignore
          fonctionIPA = fonctionIPA[attr].bind(fonctionIPA);
        } else {
          this.fErreur(erreur);
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
          this.fErreur(erreur);
          return;
        }
      }

      if (!fonctionIPA) {
        this.fErreur(erreur);
        return;
      }
    }
    if (typeof fonctionIPA !== "function") {
      this.fErreur(erreur);
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
