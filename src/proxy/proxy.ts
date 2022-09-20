import { v4 as uuidv4 } from "uuid";
import { EventEmitter, once } from "events";

import ClientConstellation from "@/client";
import { schémaFonctionSuivi, schémaFonctionOublier } from "@/utils";
import {
  MessagePourTravailleur,
  MessageSuivrePourTravailleur,
  MessageRetourPourTravailleur,
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
  fRetour: (fonction: string, args?: unknown[]) => void;
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

export abstract class ClientProxifiable extends Callable {
  événements: EventEmitter;
  tâches: { [key: string]: Tâche };
  erreurs: { erreur: string; id?: string }[];

  constructor() {
    super();

    this.événements = new EventEmitter();

    this.tâches = {};
    this.erreurs = [];

    this.événements.on("message", (m: MessageDeTravailleur) => {
      const { type } = m;
      switch (type) {
        case "suivre": {
          const { id, données } = m as MessageSuivreDeTravailleur;
          const { fSuivre } = this.tâches[id];
          fSuivre(données);
          break;
        }
        case "suivrePrêt": {
          const { id, fonctions } = m as MessageSuivrePrêtDeTravailleur;
          this.événements.emit(id, { fonctions });
          break;
        }
        case "action": {
          const { id, résultat } = m as MessageActionDeTravailleur;
          this.événements.emit(id, { résultat });
          break;
        }
        case "erreur": {
          const { erreur, id } = m as MessageErreurDeTravailleur;
          if (id) this.événements.emit(id, { erreur });
          else this.erreur({ erreur, id });
          break;
        }
        default: {
          this.erreur({
            erreur: `Type inconnu ${type} dans message ${m}.`,
            id: m.id,
          });
        }
      }
    });
  }

  __call__(
    fonction: string[],
    args: { [key: string]: unknown } = {}
  ): Promise<unknown> {
    if (typeof args !== "object")
      throw `La fonction ${fonction.join(
        "."
      )} fut appelée avec arguments ${args}. Toute fonction proxy Constellation doit être appelée avec un seul argument en format d'objet (dictionnaire).`;
    const id = uuidv4();
    const nomArgFonction = Object.entries(args).find(
      (x) => typeof x[1] === "function"
    )?.[0];

    if (nomArgFonction) {
      return this.appelerFonctionSuivre(id, fonction, args, nomArgFonction);
    } else {
      return this.appelerFonctionAction(id, fonction, args);
    }
  }

  async appelerFonctionSuivre(
    id: string,
    fonction: string[],
    args: { [key: string]: unknown },
    nomArgFonction: string
  ): Promise<
    schémaFonctionOublier | { [key: string]: (...args: unknown[]) => void }
  > {
    const f = args[nomArgFonction] as schémaFonctionSuivi<unknown>;
    const argsSansF = Object.fromEntries(
      Object.entries(args).filter((x) => typeof x[1] !== "function")
    );
    if (Object.keys(args).length !== Object.keys(argsSansF).length + 1) {
      this.erreur({
        erreur: "Plus d'un argument est une fonction : " + JSON.stringify(args),
        id,
      });
      return new Promise((_resolve, reject) => reject());
    }

    const message: MessageSuivrePourTravailleur = {
      type: "suivre",
      id,
      fonction,
      args: argsSansF,
      nomArgFonction,
    };

    const fRetour = (fonction: string, args?: unknown[]) => {
      const messageRetour: MessageRetourPourTravailleur = {
        type: "retour",
        id,
        fonction,
        args,
      };
      this.envoyerMessage(messageRetour);
    };

    const tâche: Tâche = {
      id,
      fSuivre: f,
      fRetour,
    };
    this.tâches[id] = tâche;

    const fOublierTâche = () => {
      this.oublierTâche(id);
    };

    this.envoyerMessage(message);

    const { fonctions, erreur } = (await once(this.événements, id))[0] as
      | { fonctions?: string[]; erreur?: string }
      | undefined;
    if (erreur) {
      this.erreur({ erreur, id });
      throw erreur;
    }

    if (fonctions && fonctions[0]) {
      const retour: { [key: string]: (...args: unknown[]) => void } = {
        fOublier: fOublierTâche,
      };
      for (const f of fonctions) {
        retour[f] = (...args: unknown[]) => {
          this.tâches[id]?.fRetour(f, args);
        };
      }
      return retour;
    } else {
      return fOublierTâche;
    }
  }

  async appelerFonctionAction<T extends unknown>(
    id: string,
    fonction: string[],
    args: { [key: string]: unknown }
  ): Promise<T> {
    const message: MessageActionPourTravailleur = {
      type: "action",
      id,
      fonction,
      args: args,
    };

    const promesse = new Promise<T>(async (résoudre, rejeter) => {
      const { résultat, erreur } = (await once(this.événements, id))[0];
      if (erreur) rejeter(new Error(erreur));
      else résoudre(résultat);
    });

    this.envoyerMessage(message);

    return promesse;
  }

  erreur({ erreur, id }: { erreur: string; id?: string }): void {
    const infoErreur = { erreur, id };
    this.événements.emit("erreur", {
      nouvelle: infoErreur,
      toutes: this.erreurs,
    });
    throw new Error(infoErreur.toString());
  }

  oublierTâche(id: string): void {
    const tâche = this.tâches[id];
    if (tâche) tâche.fRetour("fOublier");
    delete this.tâches[id];
  }

  abstract envoyerMessage(message: MessagePourTravailleur): void;
}

class Handler {
  listeAtributs: string[];

  constructor(listeAtributs?: string[]) {
    this.listeAtributs = listeAtributs || [];
  }

  get(obj: ClientProxifiable, prop: string): unknown {
    const directes = ["événements", "erreurs"];
    if (directes.includes(prop)) {
      return obj[prop as keyof ClientProxifiable];
    } else {
      const listeAtributs = [...this.listeAtributs, prop];
      const h = new Handler(listeAtributs);
      return new Proxy(obj, h);
    }
  }

  apply(
    target: ClientProxifiable,
    _thisArg: Handler,
    args: [{ [key: string]: unknown }]
  ) {
    return target.__call__(this.listeAtributs, args[0]);
  }
}

export type ProxyClientConstellation = ClientConstellation & ClientProxifiable;

export const générerProxy = (
  proxyClient: ClientProxifiable
): ProxyClientConstellation => {
  const handler = new Handler();
  return new Proxy<ClientProxifiable>(
    proxyClient,
    handler
  ) as ProxyClientConstellation;
};
