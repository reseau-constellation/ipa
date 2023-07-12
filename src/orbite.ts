import type { IPFS } from "ipfs-core";
import type KeyValueStore from "orbit-db-kvstore";
import type FeedStore from "orbit-db-feedstore";
import type Store from "orbit-db-store";
import type { Identity } from "orbit-db-identity-provider";

import OrbitDB from "orbit-db";
import AccessControllers from "@/accès/index.js";
import { isElectronMain, isNode } from "wherearewe";
import Ajv, {type JSONSchemaType, type ValidateFunction} from "ajv";

const ajv  = new Ajv();

export default async function initOrbite({
  sfip,
  dossierOrbite,
}: {
  sfip: IPFS;
  dossierOrbite?: string;
}): Promise<OrbitDB> {
  let dossierOrbiteFinal: string | undefined = dossierOrbite;
  if (isElectronMain) {
    const electron = await import("electron");
    const path = await import("path");
    dossierOrbiteFinal =
      dossierOrbite ||
      path.join(electron.default.app.getPath("userData"), "orbite");
  } else if (isNode) {
    const path = await import("path");
    dossierOrbiteFinal = dossierOrbite || path.join(".", "orbite");
  }

  return await OrbitDB.createInstance(sfip, {
    directory: dossierOrbiteFinal,
    AccessControllers,
  });
}

export class EnveloppeOrbite<T extends Store> {
  bd: T;

  constructor({bd}: {bd: T}) {
    this.bd = bd;
  }

  get identity(): T["identity"] {
    return this.bd.identity
  };

  get address(): T["address"] {
    return this.bd.address;
  };

  get type(): T["type"] {
    return this.bd.type;
  };
  
  get key(): T["key"] { return this.bd.key };
  get replicationStatus(): IReplicationStatus {
    return this.bd.replicationStatus
  };
  get id(): T["id"] { return this.bd.id };

  get events(): T["events"] { return this.bd.events };

  get access(): T["access"] { return this.bd.access };
  get _oplog(): T["_oplog"] { return this.bd._oplog };
  
  async close(): Promise<void> {
    return await this.bd.close();
  };
  async drop(): Promise<void> {
    return await this.bd.drop()
  };

  setIdentity(identity: Identity): void {
    return this.bd.setIdentity(identity);
  };

  async load(amount?: number): Promise<void> {
    return await this.bd.load(amount);
  };
}

export class EnveloppeOrbiteDic<T> extends EnveloppeOrbite<KeyValueStore<T[keyof T]>> {
  validateur: ValidateFunction<T>;
  validateurs: {[clef in keyof T]: ValidateFunction<T[clef]>}

  constructor({bd, schéma}: {bd: KeyValueStore<T[keyof T]>, schéma: JSONSchemaType<T>}) {
    super({bd});
    this.validateur = ajv.compile(schéma)
    this.validateurs = Object.fromEntries((Object.entries(schéma.properties || {}) as [keyof T, JSONSchemaType<T[keyof T]>][]).map(([c, p])=>[c, ajv.compile(p.type)])) as  {[clef in keyof T]: ValidateFunction<T[clef]>};
  }
  get(key: Extract<keyof T, string>): T[typeof key] {
    const val = this.bd.get(key);
    const valide  = this.validateurs[key]?.(val);
    if (valide)
      return val
    else
      throw new Error(JSON.stringify(this.validateurs[key]?.errors, undefined, 2) || `Clef ${key} non supportée.`)
  };

  async put(key: Extract<keyof T, string>, value: T[typeof key], options?: object): Promise<string> {
    const valide = this.validateurs[key]?.(value);
    if (valide)
      return await this.bd.put(key, value,  options)
    else
    throw new Error(JSON.stringify(this.validateurs[key]?.errors, undefined, 2) || `Clef ${key} non supportée.`)
  };

  async set(key: Extract<keyof T, string>, value: T[typeof key], options?: object): Promise<string> {
    return await this.put(key, value, options);
  };

  async del(key: Extract<keyof T, string>, options?: object): Promise<string> {
    return await this.bd.del(key, options);
  };

  get all(): T {
    const données = this.bd.all
    const valide = this.validateur(données)
    if (valide) {
      return données
    } else {
      throw new Error(JSON.stringify(this.validateur.errors, undefined, 2))
    }
  };
}


export class EnveloppeOrbiteListe<T> extends EnveloppeOrbite<FeedStore<T>> {
  validateur: ValidateFunction<T>;

  constructor({bd, schéma}: {bd: FeedStore<T>, schéma: JSONSchemaType<T>}) {
    super({bd});
    this.validateur = ajv.compile(schéma);
  }

  async add(data: T): Promise<string> {
    const valide = this.validateur(data)
    if (valide) {
      return await this.bd.add(data)
    }
    throw new Error(JSON.stringify(this.validateur.errors, undefined, 2))
  };

  get(hash: string): LogEntry<T> {
    const données = this.bd.get(hash);
    const valide = this.validateur(données.payload.value)
    if (valide) {
      return données
    }
    throw new Error(JSON.stringify(this.validateur.errors, undefined, 2))
  };
  
  get all(): LogEntry<T>[] {
    return this.bd.all.filter(x => this.validateur(x.payload.value))
  };

  async remove(hash: string): Promise<string> {
    return await this.bd.remove(hash);
  };

  iterator(options?: {
      gt?: string,
      gte?: string,
      lt?: string,
      lte?: string,
      limit?: number,
      reverse?: boolean
  }): {
      [Symbol.iterator](): Iterator<LogEntry<T>>,
      next(): { value: LogEntry<T>, done: boolean },
      collect(): LogEntry<T>[]
  } {
    const itérateurBd = this.bd.iterator(options)
    const validateur = this.validateur;
    const itérateurType =  {
      *[Symbol.iterator](): Iterator<LogEntry<T>> {
          for (const x of itérateurBd) {
            if (validateur(x)) {
              yield x;
            }
          }
      },
      next(): { value: LogEntry<T>, done: boolean } {
        return itérateurBd.next();  // À vérifier: est-ce nécessaire de valider les valeurs ici ?
      },
      collect(): LogEntry<T>[] {
        return itérateurBd.collect().filter(x => validateur(x));
      }
    }
    return itérateurType
  };
}