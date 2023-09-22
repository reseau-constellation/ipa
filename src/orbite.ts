import type { IPFS } from "ipfs-core";
import type KeyValueStore from "orbit-db-kvstore";
import FeedStore from "orbit-db-feedstore";
import Store from "orbit-db-store";
import type { schémaFonctionOublier, élémentsBd } from "./types.js";

import { v4 as uuidv4 } from "uuid";
import {createOrbitDB, OrbitDBDatabaseOptions, type OrbitDB} from "@orbitdb/core";
import {enregistrerContrôleurs} from "@/accès/index.js";
import { isElectronMain, isNode } from "wherearewe";
import Ajv, { type JSONSchemaType, type ValidateFunction } from "ajv";
import { adresseOrbiteValide } from "@constl/utils-ipa";
import Semaphore from "@chriscdn/promise-semaphore";
import { OptionsContrôleurConstellation } from "./accès/cntrlConstellation.js";

enregistrerContrôleurs();

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

  return await createOrbitDB({
    ipfs: sfip,
    directory: dossierOrbiteFinal,
  });
}
export function vérifierTypesBdOrbite<T extends élémentsBd>({
  bd,
  schéma,
}: {
  bd: FeedStore<T>;
  schéma?: JSONSchemaType<T>;
}): FeedStore<T>;
export function vérifierTypesBdOrbite<
  T extends { [clef: string]: élémentsBd }
>({
  bd,
  schéma,
}: {
  bd: KeyValueStore<T>;
  schéma?: JSONSchemaType<T>;
}): KeyValueStore<T>;
export function vérifierTypesBdOrbite<
  T extends { [clef: string]: élémentsBd } | élémentsBd
>({ bd, schéma }: { bd: Store; schéma?: JSONSchemaType<T> }): Store {
  if (!schéma) return bd;
  if (bd.type === "feed") {
    const bdListe = bd as FeedStore<T>;
    return validerTypesListeOrbite({ bd: bdListe, schéma });
  } else if (bd.type === "keyvalue") {
    const bdDic = bd as KeyValueStore<
      Extract<T, { [clef: string]: élémentsBd }>
    >;
    return validerTypesDicOrbite({
      bd: bdDic,
      schéma: schéma as JSONSchemaType<
        Extract<T, { [clef: string]: élémentsBd }>
      >,
    });
  }
  return bd;
}

const validerTypesListeOrbite = <T extends élémentsBd>({
  bd,
  schéma,
}: {
  bd: FeedStore<T>;
  schéma: JSONSchemaType<T>;
}): FeedStore<T> => {
  const validateur = ajv.compile(schéma);
  const valider = (v: unknown) => {
    const valid = validateur(v);
    if (valid) return true;
    else console.error(v, JSON.stringify(validateur.errors, undefined, 2));
    return false;
  };

  return new Proxy(bd, {
    get(target, prop) {
      if (prop === "all") {
        return target[prop].filter((x) => valider(x.payload.value));
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
      } else if (prop === "get") {
        return (hash: string): LogEntry<T> => {
          const données = target.get(hash);
          const valide = valider(données.payload.value);
          if (valide) {
            return données;
          }
          throw new Error(JSON.stringify(validateur.errors, undefined, 2));
        };
      } else if (prop === "iterator") {
        return (options?: {
          gt?: string;
          gte?: string;
          lt?: string;
          lte?: string;
          limit?: number;
          reverse?: boolean;
        }): {
          [Symbol.iterator](): Iterator<LogEntry<T>>;
          next(): { value?: LogEntry<T>; done: boolean };
          collect(): LogEntry<T>[];
        } => {
          const itérateurBd = target.iterator(options);

          const itérateurType = {
            *[Symbol.iterator](): Iterator<LogEntry<T>> {
              for (const x of itérateurBd) {
                if (valider(x.payload.value)) {
                  yield x;
                }
              }
            },
            next(): { value?: LogEntry<T>; done: boolean } {
              let suivant = itérateurBd.next();
              while (!valider(suivant.value.payload.value)) {
                if (suivant.done) return { done: true };
                suivant = itérateurBd.next();
              }
              return suivant;
            },
            collect(): LogEntry<T>[] {
              return itérateurBd
                .collect()
                .filter((x) => valider(x.payload.value));
            },
          };
          return itérateurType;
        };
      } else {
        return target[prop as keyof typeof target];
      }
    },
  });
};

const validerTypesDicOrbite = <T extends { [clef: string]: élémentsBd }>({
  bd,
  schéma,
}: {
  bd: KeyValueStore<T>;
  schéma: JSONSchemaType<Partial<T>>;
}): KeyValueStore<Partial<T>> => {
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

  const valider = (v: unknown, clef?: string) => {
    const vld = clef
      ? validateurs[clef] || validPropriétésAditionnelles
      : validateur;
    const valid = vld(v);
    return valid;
  };

  return new Proxy(bd, {
    get(target, prop) {
      if (prop === "get") {
        return (key: Extract<keyof T, string>): T[typeof key] | undefined => {
          const val = target.get(key);
          if (val === undefined) return val;
          const valide = valider(val, key);
          if (valide) return val;
          else return undefined;
        };
      } else if (prop === "put" || prop === "set") {
        return async (
          key: Extract<keyof T, string>,
          value: T[typeof key],
          options?: object
        ): Promise<string> => {
          const valide = valider(value, key); // validateurs[key]?.(value);
          if (valide) return await target.put(key, value, options);
          else
            throw new Error(
              validateurs[key]
                ? JSON.stringify(validateurs[key].errors, undefined, 2)
                : `Clef ${key} non supportée.`
            );
        };
      } else if (prop === "all") {
        const données = target.all;
        const valide = valider(données); // validateur(données)
        if (valide) {
          return données;
        } else {
          throw new Error(JSON.stringify(validateur.errors, undefined, 2));
        }
      } else {
        return target[prop as keyof typeof target];
      }
    },
  });
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

  async ouvrirBd<
    U extends { [clef: string]: élémentsBd },
    T = KeyValueStore<U>
  >({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    type: "kvstore" | "keyvalue";
    options?: OrbitDBDatabaseOptions;
    schéma?: JSONSchemaType<U>;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<U extends élémentsBd, T = FeedStore<U>>({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    type: "feed";
    options?: OrbitDBDatabaseOptions;
    schéma?: JSONSchemaType<U>;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends Store>({
    id,
  }: {
    id: string;
    options?: OrbitDBDatabaseOptions;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<
    U,
    T extends
      | Store
      | KeyValueStore<{ [clef: string]: élémentsBd }>
      | FeedStore<élémentsBd>
  >({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    schéma?: JSONSchemaType<U>;
    type?: "kvstore" | "keyvalue" | "feed";
    options?: OrbitDBDatabaseOptions;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<
    U,
    T extends
      | Store
      | KeyValueStore<{ [clef: string]: élémentsBd }>
      | FeedStore<élémentsBd>
  >({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    schéma?: JSONSchemaType<U>;
    type?: "kvstore" | "keyvalue" | "feed";
    options?: OrbitDBDatabaseOptions;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }> {
    if (!adresseOrbiteValide(id))
      throw new Error(`Adresse "${id}" non valide.`);

    // Fonction utilitaire pour vérifier le type de la bd
    const vérifierTypeBd = (bd: Store): bd is T => {
      const { type: typeBd } = bd;
      if (type === undefined) return true;
      if (typeBd === "keyvalue" && type === "kvstore") return true;
      return typeBd === type;
    };

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

    if (existante) {
      this._bdsOrbite[id].idsRequètes.add(idRequète);
      this.verrouOuvertureBd.release(id);
      if (!vérifierTypeBd(existante.bd))
        throw new Error(
          `La bd est de type ${existante.bd.type}, et non ${type}.`
        );
      if (existante.bd.type === "feed") {
        return {
          bd: vérifierTypesBdOrbite({
            bd: existante.bd as Extract<T, FeedStore<U>>,
            schéma: schéma as JSONSchemaType<Extract<élémentsBd, U>>,
          }) as T,
          fOublier,
        };
      } else {
        return {
          bd: vérifierTypesBdOrbite({
            bd: existante.bd as Extract<
              T,
              KeyValueStore<Extract<{ [clef: string]: élémentsBd }, U>>
            >,
            schéma: schéma as JSONSchemaType<Extract<élémentsBd, U>>,
          }) as T,
          fOublier,
        };
      }
    }
    try {
      const bd = await this.orbite!.open(id, options);

      this._bdsOrbite[id] = { bd, idsRequètes: new Set([idRequète]) };
      await bd.load();

      // Maintenant que la BD a été créée, on peut relâcher le verrou
      this.verrouOuvertureBd.release(id);
      if (!vérifierTypeBd(bd)) {
        console.error(
          new Error(`La bd est de type ${bd.type}, et non ${type}.`).stack
        );
        throw new Error(`La bd est de type ${bd.type}, et non ${type}.`);
      }

      return {
        bd: (bd.type === "feed"
          ? vérifierTypesBdOrbite({
              bd: bd as Extract<T, FeedStore<U>>,
              schéma: schéma as JSONSchemaType<Extract<élémentsBd, U>>,
            })
          : vérifierTypesBdOrbite({
              bd: bd as Extract<
                T,
                KeyValueStore<Extract<{ [clef: string]: élémentsBd }, U>>
              >,
              schéma: schéma as JSONSchemaType<Extract<élémentsBd, U>>,
            })) as T,
        fOublier,
      };
    } catch (e) {
      console.error((e as Error).toString());
      throw e;
    }
  }

  async créerBdIndépendante({
    type,
    options,
    nom,
  }: {
    type: TStoreType;
    options: OrbitDBDatabaseOptions;
    nom?: string;
  }): Promise<string> {
    const bd: Store = await this.orbite.open(
      nom || uuidv4(),
      {
        type,
        options,
      }
    );
    const { id } = bd;

    this._bdsOrbite[id] = { bd, idsRequètes: new Set() };

    return id;
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
