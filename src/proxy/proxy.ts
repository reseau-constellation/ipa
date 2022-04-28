import { v4 as uuidv4 } from "uuid";
import { EventEmitter, once } from "events";

import ClientConstellation from "@/client";
import { schémaFonctionSuivi, schémaFonctionOublier } from "@/utils";
import {
  MessagePourTravailleur,
  MessagePrêtPourTravailleur,
  MessageSuivrePourTravailleur,
  MessageOublierPourTravailleur,
  MessageActionPourTravailleur,
  MessageDeTravailleur,
  MessageSuivreDeTravailleur,
  MessageActionDeTravailleur,
  MessageSuivrePrêtDeTravailleur,
  MessageErreurDeTravailleur,
} from "./messages";

interface Tâche {
  id: string;
  fSuivre: schémaFonctionSuivi<unknown>;
  fOublier: schémaFonctionOublier;
}

class Callable extends Function {
  _bound: Callable;

  // Code obtenu de https://replit.com/@arccoza/Javascript-Callable-Object-using-bind?ref=hackernoon.com
  constructor() {
    // We create a new Function object using `super`, with a `this` reference
    // to itself (the Function object) provided by binding it to `this`,
    // then returning the bound Function object (which is a wrapper around the
    // the original `this`/Function object). We then also have to store
    // a reference to the bound Function object, as `_bound` on the unbound `this`,
    // so the bound function has access to the new bound object.
    // Pro: Works well, doesn't rely on deprecated features.
    // Con: A little convoluted, and requires wrapping `this` in a bound object.

    super("...args", "return this._bound.__call__(...args)");
    // Or without the spread/rest operator:
    // super('return this._bound._call.apply(this._bound, arguments)')
    this._bound = this.bind(this);

    return this._bound;
  }
}

export abstract class téléClient extends EventEmitter {
  abstract recevoirMessage(message: MessagePourTravailleur): void;
}

export class IPAParallèle extends Callable {
  événements: EventEmitter;
  client: téléClient;
  tâches: { [key: string]: Tâche };
  ipaPrêt: boolean;
  messagesEnAttente: MessagePourTravailleur[];
  erreurs: { erreur: Error; id?: string }[];
  souleverErreurs: boolean;

  constructor(client: téléClient, souleverErreurs: boolean) {
    super();

    this.client = client;
    this.souleverErreurs = souleverErreurs;

    this.événements = new EventEmitter();
    this.tâches = {};
    this.ipaPrêt = false;
    this.messagesEnAttente = [];
    this.erreurs = [];

    this.client.on("erreur", (e) => {
      this.erreur(e);
    });
    this.client.on("message", (m: MessageDeTravailleur) => {
      try {
        const { type } = m;
        switch (type) {
          case "prêt": {
            this.ipaActivé();
            break;
          }
          case "suivre": {
            const { id, données } = m as MessageSuivreDeTravailleur;
            const { fSuivre } = this.tâches[id];
            fSuivre(données);
            break;
          }
          case "suivrePrêt": {
            const { id } = m as MessageSuivrePrêtDeTravailleur;
            this.événements.emit(id);
            break;
          }
          case "action": {
            const { id, résultat } = m as MessageActionDeTravailleur;
            this.événements.emit(id, résultat);
            break;
          }
          case "erreur": {
            const { erreur, id } = m as MessageErreurDeTravailleur;
            this.erreur(erreur, id);
            break;
          }
          default: {
            this.erreur(new Error(`Type inconnu ${type} dans message ${m}.`));
          }
        }
      } catch (err) {
        this.erreur(err as Error);
      }
    });

    const messagePrêt: MessagePrêtPourTravailleur = {
      type: "prêt ?"
    }
    this.client.recevoirMessage(messagePrêt);
  }

  __call__(fonction: string[], listeArgs: unknown[]): Promise<unknown> {
    const id = uuidv4();
    const iArgFonction = listeArgs.findIndex((a) => typeof a === "function");

    if (iArgFonction !== -1) {
      return this.appelerFonctionSuivre(id, fonction, listeArgs, iArgFonction);
    } else {
      return this.appelerFonctionAction(id, fonction, listeArgs);
    }
  }

  async appelerFonctionSuivre(
    id: string,
    fonction: string[],
    listeArgs: unknown[],
    iArgFonction: number
  ) {
    const f = listeArgs[iArgFonction] as schémaFonctionSuivi<unknown>;
    const args = listeArgs.filter((a) => typeof a !== "function");
    if (args.length !== listeArgs.length - 1) {
      this.erreur(new Error("Plus d'un argument est une fonction."), id);
      return new Promise((_resolve, reject) => reject());
    }

    const message: MessageSuivrePourTravailleur = {
      type: "suivre",
      id,
      fonction,
      args,
      iArgFonction,
    };

    const messageOublier: MessageOublierPourTravailleur = {
      type: "oublier",
      id,
    };

    const fOublier = () => {
      this.envoyerMessage(messageOublier);
    };

    const tâche: Tâche = {
      id,
      fSuivre: f,
      fOublier,
    };
    this.tâches[id] = tâche;

    const fOublierTâche = () => {
      this.oublierTâche(id);
    };

    this.envoyerMessage(message);

    await new Promise<void>(async (résoudre) => {
      await once(this.événements, id);
      résoudre();
    });

    return fOublierTâche;
  }

  async appelerFonctionAction<T = unknown>(
    id: string,
    fonction: string[],
    listeArgs: unknown[]
  ): Promise<T> {
    const message: MessageActionPourTravailleur = {
      type: "action",
      id,
      fonction,
      args: listeArgs,
    };

    const promesse = new Promise<T>(async (résoudre) => {
      const résultat = (await once(this.événements, id))[0];
      résoudre(résultat);
    });

    this.envoyerMessage(message);

    return await promesse;
  }

  ipaActivé(): void {
    if (this.ipaPrêt) return;
    this.messagesEnAttente.forEach((m) => this.client.recevoirMessage(m));

    this.messagesEnAttente = [];
    this.ipaPrêt = true;
  }

  envoyerMessage(message: MessagePourTravailleur): void {
    if (this.ipaPrêt) {
      this.client.recevoirMessage(message);
    } else {
      this.messagesEnAttente.push(message);
    }
  }

  erreur(erreur: Error, id?: string): void {
    const infoErreur = { erreur, id };
    this.erreurs.unshift(infoErreur);
    this.événements.emit("erreur", {
      nouvelle: infoErreur,
      toutes: this.erreurs,
    });
    if (this.souleverErreurs) throw infoErreur;
  }

  oublierTâche(id: string): void {
    const tâche = this.tâches[id];
    if (tâche) tâche.fOublier();
    delete this.tâches[id];
  }
}

class Handler {
  listeAtributs: string[];

  constructor(listeAtributs?: string[]) {
    this.listeAtributs = listeAtributs || [];
  }

  get(obj: IPAParallèle, prop: string): unknown {
    const directes = ["événements", "erreurs"];
    if (directes.includes(prop)) {
      return obj[prop as keyof IPAParallèle];
    } else {
      const listeAtributs = [...this.listeAtributs, prop];
      const h = new Handler(listeAtributs);
      return new Proxy(obj, h);
    }
  }

  apply(target: IPAParallèle, _thisArg: Handler, argumentsList: unknown[]) {
    return target.__call__(this.listeAtributs, argumentsList);
  }
}

export type ProxyClientConstellation = ClientConstellation & IPAParallèle;

export default (
  client: téléClient,
  souleverErreurs: boolean
): ProxyClientConstellation => {
  const handler = new Handler();
  const ipa = new IPAParallèle(client, souleverErreurs);
  return new Proxy<IPAParallèle>(ipa, handler) as ProxyClientConstellation;
};
