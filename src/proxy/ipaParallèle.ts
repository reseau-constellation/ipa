import { v4 as uuidv4 } from "uuid";
import { EventEmitter, once } from "events";
import OrbitDB from "orbit-db";

import ClientConstellation, {
  schémaFonctionSuivi,
  schémaFonctionOublier,
} from "@/client";

interface Tâche {
  id: string;
  fSuivre: schémaFonctionSuivi<unknown>;
  fOublier: schémaFonctionOublier;
}

export interface MessageDeTravailleur {
  type: "prêt" | "suivre" | "suivrePrêt" | "action" | "erreur";
}

export interface MessagePrêtDeTravailleur extends MessageDeTravailleur {
  type: "prêt";
}

export interface MessageSuivreDeTravailleur extends MessageDeTravailleur {
  type: "suivre";
  id: string;
  données: unknown;
}

export interface MessageSuivrePrêtDeTravailleur extends MessageDeTravailleur {
  type: "suivrePrêt";
  id: string;
}

export interface MessageActionDeTravailleur extends MessageDeTravailleur {
  type: "action";
  id: string;
  résultat: unknown;
}

export interface MessageErreurDeTravailleur extends MessageDeTravailleur {
  type: "erreur";
  erreur: Error;
}

export interface MessagePourTravailleur {
  type: "oublier" | "suivre" | "action" | "init";
}

export interface MessageInitPourTravailleur extends MessagePourTravailleur {
  type: "init";
  idBdRacine?: string;
  orbite?: OrbitDB;
  sujetRéseau?: string;
}

export interface MessageSuivrePourTravailleur extends MessagePourTravailleur {
  type: "suivre";
  id: string;
  fonction: string[];
  args: unknown[];
  iArgFonction: number;
}

export interface MessageActionPourTravailleur extends MessagePourTravailleur {
  type: "action";
  id: string;
  fonction: string[];
  args: unknown[];
}

export interface MessageOublierPourTravailleur extends MessagePourTravailleur {
  type: "oublier";
  id: string;
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
  erreurs: (Error)[];

  constructor(client: téléClient, idBdRacine?: string, orbite?: OrbitDB, sujetRéseau?: string) {
    super();

    this.client = client;

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
            const { erreur } = m as MessageErreurDeTravailleur;
            this.erreur(erreur);
            break;
          }
          default: {
            this.erreur(
              new Error(`Type inconnu ${type} dans message ${m}.`)
            );
          }
        }
      } catch (err) {
        this.erreur(err as Error)
      }
    });
    const messageInit: MessageInitPourTravailleur = {
      type: "init",
      idBdRacine,
      orbite,
      sujetRéseau
    };
    this.client.recevoirMessage(messageInit);
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
      this.erreur(new Error("Plus d'un argument est une fonction."));
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

    await once(this.événements, id);
    return fOublierTâche;
  }

  async appelerFonctionAction(
    id: string,
    fonction: string[],
    listeArgs: unknown[]
  ): Promise<unknown> {
    const message: MessageActionPourTravailleur = {
      type: "action",
      id,
      fonction,
      args: listeArgs,
    };
    this.envoyerMessage(message);

    const événements = this.événements;
    const résultat = await once(événements, id);

    return résultat;
  }

  ipaActivé(): void {
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

  erreur(e: Error): void {
    this.erreurs.unshift(e);
    this.événements.emit("erreur", { nouvelle: e, toutes: this.erreurs });
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

export default (client: téléClient, idBdRacine?: string, orbite?: OrbitDB, sujetRéseau?: string): ProxyClientConstellation => {
  const handler = new Handler();
  const ipa = new IPAParallèle(client, idBdRacine, orbite, sujetRéseau);
  return new Proxy<IPAParallèle>(ipa, handler) as ProxyClientConstellation;
};
