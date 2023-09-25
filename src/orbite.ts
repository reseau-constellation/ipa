import type { IPFS } from "ipfs-core";
import type { schémaFonctionOublier, élémentsBd } from "./types.js";

import { v4 as uuidv4 } from "uuid";
import {
  createOrbitDB,
  OrbitDBDatabaseOptions,
  type OrbitDB,
  AccessController,
  useDatabaseType,
  type Log,
} from "@orbitdb/core";
import { enregistrerContrôleurs } from "@/accès/index.js";
import { isElectronMain, isNode } from "wherearewe";
import Ajv, { type JSONSchemaType, type ValidateFunction } from "ajv";

import Semaphore from "@chriscdn/promise-semaphore";
import Feed from "./bdsOrbite/feed.js";
import type SetDatabase from "./bdsOrbite/set.js";
import OrderedKeyValue from "./bdsOrbite/ordered-keyvalue.js";
import EventEmitter from "events";

export type Store = FeedStore | SetStore | KeyValueStore | OrderedKeyValueStore;

export type FeedStore = Awaited<ReturnType<ReturnType<typeof Feed>>>;
export type FeedStoreTypé<T extends élémentsBd> = Omit<
  FeedStore,
  "add" | "all"
> & {
  add: (value: T) => Promise<string>;
  all: () => Promise<
    {
      value: T;
      hash: string;
    }[]
  >;
};

export type SetStore = Awaited<ReturnType<ReturnType<typeof SetDatabase>>>;
export type SetStoreTypé<T extends élémentsBd> = Omit<
  SetStore,
  "put" | "set" | "del" | "all"
> & {
  put: (value: T) => Promise<string>;
  set: SetStoreTypé<T>["put"];
  del: (value: T) => Promise<string>;
  all: () => Promise<
    {
      value: T;
      hash: string;
    }[]
  >;
};

export type OrderedKeyValueStore = Awaited<
  ReturnType<ReturnType<typeof OrderedKeyValue>>
>;
export type OrderedKeyValueStoreTypé<T extends { [clef: string]: unknown }> =
  Omit<OrderedKeyValueStore, "put" | "set" | "del" | "move" | "get" | "all"> & {
    put: <K extends keyof T>(
      key: K,
      value: T[K],
      position?: number
    ) => Promise<string>;
    set: OrderedKeyValueStoreTypé<T>["put"];
    del: <K extends keyof T>(key: K) => Promise<string>;
    move: <K extends keyof T>(key: K, position: number) => Promise<string>;
    get: <K extends keyof T>(key: K) => Promise<T[K] | undefined>;
    all: () => Promise<
      {
        key: keyof T;
        value: T[keyof T];
        hash: string;
      }[]
    >;
  };

export type KeyValueStore = {
  type: "keyvalue";
  address: string;
  put(key: string, value: unknown): Promise<string>;
  set: KeyValueStore["put"];
  del(key: string): Promise<string>;
  get(key: string): Promise<unknown | undefined>;
  all(): Promise<{ key: string; value: unknown; hash: string }[]>;
  close(): Promise<void>;
  drop(): Promise<void>;
  events: EventEmitter;
  access: AccessController;
  log: Log;
};
export type KeyValueStoreTypé<T extends { [clef: string]: unknown }> = Omit<
  KeyValueStore,
  "put" | "set" | "del" | "get" | "all"
> & {
  put<K extends keyof T>(key: K, value: T[K]): Promise<string>;
  set: KeyValueStoreTypé<T>["put"];
  del<K extends keyof T>(key: K): Promise<string>;
  get<K extends keyof T>(key: K): Promise<T[K] | undefined>;
  all(): Promise<T>;
};

const ajv = new Ajv();

export default async function initOrbite({
  sfip,
  dossierOrbite,
}: {
  sfip: IPFS;
  dossierOrbite?: string;
}): Promise<OrbitDB> {
  let dossierOrbiteFinal: string | undefined = dossierOrbite;
  if (isElectronMain || isNode) {
    const path = await import("path");
    dossierOrbiteFinal = dossierOrbite || path.join(".", "orbite");
  } else {
    dossierOrbiteFinal = dossierOrbite || "./orbite";
  }

  enregistrerContrôleurs();
  useDatabaseType(Feed);

  const orbite = await createOrbitDB({
    ipfs: sfip,
    directory: dossierOrbiteFinal,
  });


  return orbite;
}

const typerFeedStore = <T extends élémentsBd>({
  bd,
  schéma,
}: {
  bd: FeedStore;
  schéma: JSONSchemaType<T>;
}): FeedStoreTypé<T> => {
  const validateur = ajv.compile(schéma);
  const valider = (v: unknown): v is T => {
    const valid = validateur(v);
    if (valid) return true;
    else console.error(v, JSON.stringify(validateur.errors, undefined, 2));
    return false;
  };

  return new Proxy(bd, {
    get(target, prop) {
      if (prop === "all") {
        return async (): Promise<{ value: T; hash: string }[]> => {
          const tous = await target[prop]();
          const valides = tous.filter((x) => valider(x.value)) as {
            value: T;
            hash: string;
          }[];
          return valides;
        };
      } else if (prop === "add") {
        return async (data: T): Promise<string> => {
          const valide = valider(data);
          if (valide) {
            return await target.add(data);
          }
          throw new Error(
            data.toString() + JSON.stringify(validateur.errors, undefined, 2)
          );
        };
      } else {
        return target[prop as keyof typeof target];
      }
    },
  }) as FeedStoreTypé<T>;
};

const typerKeyValueStore = <T extends { [clef: string]: élémentsBd }>({
  bd,
  schéma,
}: {
  bd: KeyValueStore;
  schéma: JSONSchemaType<Partial<T>>;
}): KeyValueStoreTypé<T> => {
  const validateur = ajv.compile(schéma);
  const compilerSchémaClef = (
    s: JSONSchemaType<T[keyof T]> | JSONSchemaType<T[keyof T]>["properties"]
  ) => {
    // Apparemment nécessaire pour éviter que AJV donne une erreur si `nullable: true` et la valeur est `undefined`
    if (s === true) {
      return () => true;
    }

    if (s.nullable) {
      const f = ajv.compile(s);
      return (v: unknown) => {
        return f(v === undefined ? null : v);
      };
    } else {
      return ajv.compile(s);
    }
  };
  const validateurs = Object.fromEntries(
    (
      Object.entries(schéma.properties || {}) as [
        keyof T,
        JSONSchemaType<T[keyof T]>
      ][]
    ).map(([c, p]) => [c, compilerSchémaClef(p)])
  ) as { [clef in keyof T]: ValidateFunction<T[clef]> };
  const validPropriétésAditionnelles = schéma.additionalProperties
    ? compilerSchémaClef(schéma.additionalProperties)
    : () => false;

  const validerClef = <K extends keyof T>(v: unknown, clef: K): v is T[K] => {
    const vld = validateurs[clef] || validPropriétésAditionnelles;
    return vld(v);
  };

  const valider = (v: unknown): v is T => {
    return validateur(v);
  };

  return new Proxy(bd, {
    get(target, prop) {
      if (prop === "get") {
        return async (
          key: Extract<keyof T, string>
        ): Promise<T[typeof key] | undefined> => {
          const val = await target.get(key);
          if (val === undefined) return val;
          const valide = validerClef(val, key);
          return valide ? val : undefined;
        };
      } else if (prop === "put" || prop === "set") {
        return async (
          key: Extract<keyof T, string>,
          value: T[typeof key]
        ): Promise<string> => {
          const valide = validerClef(value, key);
          if (valide) return await target.put(key, value);
          else
            throw new Error(
              validateurs[key]
                ? JSON.stringify(validateurs[key].errors, undefined, 2)
                : `Clef ${key} non supportée.`
            );
        };
      } else if (prop === "all") {
        return async () => {
          const tous = await target.all();
          const données = Object.fromEntries(tous.map((x) => [x.key, x.value]));
          const valide = valider(données);
          if (valide) {
            return données;
          } else {
            throw new Error(JSON.stringify(validateur.errors, undefined, 2));
          }
        };
      } else {
        return target[prop as keyof typeof target];
      }
    },
  }) as unknown as KeyValueStoreTypé<T>;
};

const typerOrderedKeyValueStore = <T extends { [clef: string]: élémentsBd }>({
  bd,
  schéma,
}: {
  bd: OrderedKeyValueStore;
  schéma: JSONSchemaType<Partial<T>>;
}): OrderedKeyValueStoreTypé<T> => {
  const validateur = ajv.compile(schéma);
  const compilerSchémaClef = (
    s: JSONSchemaType<T[keyof T]> | JSONSchemaType<T[keyof T]>["properties"]
  ) => {
    // Apparemment nécessaire pour éviter que AJV donne une erreur si `nullable: true` et la valeur est `undefined`
    if (s === true) {
      return () => true;
    }

    if (s.nullable) {
      const f = ajv.compile(s);
      return (v: unknown) => {
        return f(v === undefined ? null : v);
      };
    } else {
      return ajv.compile(s);
    }
  };
  const validateurs = Object.fromEntries(
    (
      Object.entries(schéma.properties || {}) as [
        keyof T,
        JSONSchemaType<T[keyof T]>
      ][]
    ).map(([c, p]) => [c, compilerSchémaClef(p)])
  ) as { [clef in keyof T]: ValidateFunction<T[clef]> };
  const validPropriétésAditionnelles = schéma.additionalProperties
    ? compilerSchémaClef(schéma.additionalProperties)
    : () => false;

  const validerClef = <K extends keyof T>(v: unknown, clef: K): v is T[K] => {
    const vld = validateurs[clef] || validPropriétésAditionnelles;
    return vld(v);
  };

  const valider = (v: unknown): v is T => {
    return validateur(v);
  };

  return new Proxy(bd, {
    get(target, prop) {
      if (prop === "get") {
        return async (
          key: Extract<keyof T, string>
        ): Promise<{ value: T[typeof key]; position: number } | undefined> => {
          const val = await target.get(key);
          if (val === undefined) return val;
          const { value, position } = val;
          const valide = validerClef(value, key);
          if (valide) return { value: value, position };
          else return undefined;
        };
      } else if (prop === "put" || prop === "set") {
        return async (
          key: Extract<keyof T, string>,
          value: T[typeof key],
          position?: number
        ): Promise<string> => {
          const valide = validerClef(value, key);
          if (valide) return await target.put(key, value, position);
          else
            throw new Error(
              validateurs[key]
                ? JSON.stringify(validateurs[key].errors, undefined, 2)
                : `Clef ${key} non supportée.`
            );
        };
      } else if (prop === "all") {
        return async () => {
          const tous = await target.all();
          const données = Object.fromEntries(tous.map((x) => [x.key, x.value]));
          const valide = valider(données);
          if (valide) {
            return données;
          } else {
            throw new Error(JSON.stringify(validateur.errors, undefined, 2));
          }
        };
      } else {
        return target[prop as keyof typeof target];
      }
    },
  }) as unknown as OrderedKeyValueStoreTypé<T>;
};

const typerSetStore = <T extends élémentsBd>({
  bd,
  schéma,
}: {
  bd: SetStore;
  schéma: JSONSchemaType<T>;
}): SetStoreTypé<T> => {
  const validateur = ajv.compile(schéma);
  const valider = (v: unknown): v is T => {
    const valid = validateur(v);
    if (valid) return true;
    else console.error(v, JSON.stringify(validateur.errors, undefined, 2));
    return false;
  };

  return new Proxy(bd, {
    get(target, prop) {
      if (prop === "all") {
        return async (): Promise<{ value: T; hash: string }[]> => {
          const tous = await target[prop]();
          const valides = tous.filter((x) => valider(x.value)) as {
            value: T;
            hash: string;
          }[];
          return valides;
        };
      } else if (prop === "put" || prop === "set") {
        return async (data: T): Promise<string> => {
          const valide = valider(data);
          if (valide) {
            return await target.put(data);
          }
          throw new Error(
            data.toString() + JSON.stringify(validateur.errors, undefined, 2)
          );
        };
      } else {
        return target[prop as keyof typeof target];
      }
    },
  }) as SetStoreTypé<T>;
};

type Typer<
  T extends Store,
  U extends T extends KeyValueStore | OrderedKeyValueStore
    ? { [clef: string]: élémentsBd }
    : élémentsBd
> = T extends KeyValueStore
  ? KeyValueStoreTypé<Extract<U, { [clef: string]: élémentsBd }>>
  : T extends FeedStore
  ? FeedStoreTypé<U>
  : T extends SetStore
  ? SetStoreTypé<U>
  : T extends OrderedKeyValueStore
  ? OrderedKeyValueStoreTypé<Extract<U, { [clef: string]: élémentsBd }>>
  : never;

const typerBd = <
  T extends Store,
  U extends T extends KeyValueStore | OrderedKeyValueStore
    ? { [clef: string]: élémentsBd }
    : élémentsBd
>({
  bd,
  schéma,
}: {
  bd: T;
  schéma: JSONSchemaType<U>;
}): Typer<T, U> => {
  switch (bd.type) {
    case "feed":
      return typerFeedStore({
        bd,
        schéma: schéma as JSONSchemaType<U>,
      }) as Typer<T, U>;

    case "set":
      return typerSetStore({
        bd,
        schéma: schéma as JSONSchemaType<U>,
      }) as Typer<T, U>;

    case "keyvalue":
      return typerKeyValueStore({
        bd,
        schéma: schéma as JSONSchemaType<U>,
      }) as Typer<T, U>;

    case "ordered-keyvalue":
      return typerOrderedKeyValueStore({
        bd,
        schéma: schéma as JSONSchemaType<U>,
      }) as unknown as Typer<T, U>;

    default:
      throw new Error("Type de bd non reconnu.");
  }
};

type bdOuverte<T extends Store> = { bd: T; idsRequètes: Set<string> };

export class GestionnaireOrbite {
  orbite: OrbitDB;
  _bdsOrbite: { [key: string]: bdOuverte<Store> };
  verrouOuvertureBd: Semaphore;
  _oublierNettoyageBdsOuvertes?: schémaFonctionOublier;

  constructor(orbite: OrbitDB) {
    this.orbite = orbite;

    this._bdsOrbite = {};
    this.verrouOuvertureBd = new Semaphore();

    this._oublierNettoyageBdsOuvertes = this.lancerNettoyageBdsOuvertes();
  }

  get identity(): OrbitDB["identity"] {
    return this.orbite.identity;
  }

  async ouvrirBd<T extends KeyValueStore>({
    id,
    type,
    options,
  }: {
    id: string;
    type: "keyvalue";
    options?: Omit<OrbitDBDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends FeedStore>({
    id,
    type,
    options,
  }: {
    id: string;
    type: "feed";
    options?: Omit<OrbitDBDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends SetStore>({
    id,
    type,
    options,
  }: {
    id: string;
    type: "set";
    options?: Omit<OrbitDBDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends OrderedKeyValueStore>({
    id,
    type,
    options,
  }: {
    id: string;
    type: "ordered-keyvalue";
    options?: Omit<OrbitDBDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends Store>({
    id,
  }: {
    id: string;
    options?: Omit<OrbitDBDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends Store>({
    id,
    type,
    options,
  }: {
    id: string;
    type?: "keyvalue" | "feed" | "set" | "ordered-keyvalue";
    options?: Omit<OrbitDBDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends Store>({
    id,
    type,
    options,
  }: {
    id: string;
    type?: "keyvalue" | "feed" | "set" | "ordered-keyvalue";
    options?: Omit<OrbitDBDatabaseOptions, "type">;
  }): Promise<{
    bd: T;
    fOublier: schémaFonctionOublier;
  }> {
    // Nous avons besoin d'un verrou afin d'éviter la concurrence
    await this.verrouOuvertureBd.acquire(id);
    const existante = this._bdsOrbite[id];

    const idRequète = uuidv4();

    const fOublier = async () => {
      // Si la BD a été effacée entre-temps par `client.effacerBd`,
      // elle ne sera plus disponible ici
      if (!this._bdsOrbite[id]) return;

      this._bdsOrbite[id].idsRequètes.delete(idRequète);
    };

    // Fonction utilitaire pour vérifier le type de la bd
    const vérifierTypeBd = (bd: Store): boolean => {
      const { type: typeBd } = bd;
      if (type === undefined) return true;
      return typeBd === type;
    };

    if (existante) {
      this._bdsOrbite[id].idsRequètes.add(idRequète);
      this.verrouOuvertureBd.release(id);

      if (!vérifierTypeBd(existante.bd))
        throw new Error(
          `La bd est de type ${existante.bd.type}, et non ${type}.`
        );

      return {
        bd: existante.bd as T,
        fOublier,
      };
    }

    try {
      const bd = await this.orbite!.open(id, { type, ...options }) as T;

      this._bdsOrbite[id] = { bd, idsRequètes: new Set([idRequète]) };

      // Maintenant que la BD a été créée, on peut relâcher le verrou
      this.verrouOuvertureBd.release(id);

      return {
        bd,
        fOublier,
      };
    } catch (e) {
      console.error((e as Error).toString());
      throw e;
    }
  }

  async ouvrirBdTypée<
    U extends { [clef: string]: élémentsBd },
    T = KeyValueStoreTypé<U>
  >({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    type: "keyvalue";
    schéma: JSONSchemaType<U>;
    options?: Omit<OrbitDBDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBdTypée<U extends élémentsBd, T = FeedStoreTypé<U>>({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    type: "feed";
    schéma: JSONSchemaType<U>;
    options?: Omit<OrbitDBDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBdTypée<U extends élémentsBd, T = SetStoreTypé<U>>({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    type: "set";
    schéma: JSONSchemaType<U>;
    options?: Omit<OrbitDBDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBdTypée<
    U extends { [clef: string]: élémentsBd },
    T = OrderedKeyValueStoreTypé<U>
  >({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    type: "ordered-keyvalue";
    schéma: JSONSchemaType<U>;
    options?: Omit<OrbitDBDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBdTypée<U extends élémentsBd, T>({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    type: "ordered-keyvalue" | "set" | "keyvalue" | "feed";
    schéma: JSONSchemaType<U>;
    options?: Omit<OrbitDBDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }> {
    const { bd, fOublier } = await this.ouvrirBd({
      id,
      type,
      options,
    });

    return {
      bd: typerBd({ bd, schéma }) as T,
      fOublier,
    };
  }

  async créerBdIndépendante({
    type,
    options,
    nom,
  }: {
    type: "set" | "ordered-keyvalue" | "keyvalue" | "feed";
    options: Omit<OrbitDBDatabaseOptions, "type">;
    nom?: string;
  }): Promise<string> {
    const bd = await this.orbite.open(nom || uuidv4(), {
      type,
      options,
    }) as Store;
    const { address } = bd;

    this._bdsOrbite[address] = { bd, idsRequètes: new Set() };

    return address;
  }

  async effacerBd({ id }: { id: string }): Promise<void> {
    const { bd } = await this.ouvrirBd({ id });
    await bd.drop();
    delete this._bdsOrbite[id];
  }

  private lancerNettoyageBdsOuvertes(): schémaFonctionOublier {
    const fNettoyer = async () => {
      await Promise.all(
        Object.keys(this._bdsOrbite).map(async (id) => {
          const { bd, idsRequètes } = this._bdsOrbite[id];
          if (!idsRequètes.size) {
            delete this._bdsOrbite[id];
            await bd.close();
          }
        })
      );
    };
    const i = setInterval(fNettoyer, 1000 * 60 * 5);
    return async () => clearInterval(i);
  }

  async fermer({ arrêterOrbite }: { arrêterOrbite: boolean }): Promise<void> {
    if (this._oublierNettoyageBdsOuvertes) this._oublierNettoyageBdsOuvertes();
    if (arrêterOrbite) {
      await this.orbite.stop();
    }
  }
}

export class GestionnaireOrbiteGénéral {
  gestionnaires: { [idOrbite: string]: GestionnaireOrbite };

  constructor() {
    this.gestionnaires = {};
  }

  obtGestionnaireOrbite({ orbite }: { orbite: OrbitDB }): GestionnaireOrbite {
    if (!this.gestionnaires[orbite.identity.id]) {
      this.gestionnaires[orbite.identity.id] = new GestionnaireOrbite(orbite);
    }
    return this.gestionnaires[orbite.identity.id];
  }

  async fermer({
    orbite,
    arrêterOrbite,
  }: {
    orbite: OrbitDB;
    arrêterOrbite: boolean;
  }): Promise<void> {
    const gestionnaireOrbite = this.obtGestionnaireOrbite({ orbite });
    await gestionnaireOrbite.fermer({ arrêterOrbite });
    delete this.gestionnaires[orbite.identity.id];
  }
}

export const gestionnaireOrbiteGénéral = new GestionnaireOrbiteGénéral();
