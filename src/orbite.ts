import type { IPFS } from "ipfs-core";
import type KeyValueStore from "orbit-db-kvstore";
import FeedStore from "orbit-db-feedstore";
import Store from "orbit-db-store";

import type { élémentsBd } from "./utils/types.js";

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
  if (isElectronMain || isNode) {
    const path = await import("path");
    dossierOrbiteFinal = dossierOrbite || path.join(".", "orbite");
  } else {
    dossierOrbiteFinal = dossierOrbite || "./orbite"
  }

  return await OrbitDB.createInstance(sfip, {
    directory: dossierOrbiteFinal,
    AccessControllers,
  });
}
export function vérifierTypesBdOrbite<T extends élémentsBd>({bd, schéma}: {bd: FeedStore<T>, schéma?: JSONSchemaType<T>}): FeedStore<T>;
export function vérifierTypesBdOrbite<T extends {[clef: string]: élémentsBd}>({bd, schéma}: {bd: KeyValueStore<T>, schéma?: JSONSchemaType<T>}): KeyValueStore<T>
export function vérifierTypesBdOrbite<T extends ({[clef: string]: élémentsBd} | élémentsBd)>({bd, schéma}: {bd: Store, schéma?: JSONSchemaType<T>}): Store {
  if (!schéma) return bd;
  if (bd.type === 'feed') {
    const bdListe = bd as FeedStore<T>
    return validerTypesListeOrbite({bd: bdListe, schéma})
  } else if (bd.type === "keyvalue") {
    const bdDic = bd as KeyValueStore<Extract<T, {[clef: string]: élémentsBd}>>
    return validerTypesDicOrbite({bd: bdDic, schéma: schéma as JSONSchemaType<T>})
  }
  return bd;
}

const validerTypesListeOrbite = <T extends élémentsBd>({bd, schéma}: {bd: FeedStore<T>, schéma: JSONSchemaType<T>}): FeedStore<T> => {

  const validateur = ajv.compile(schéma);

  return new Proxy(bd, {
    get(target, prop) {
      if (prop === 'all') {
        return target[prop].filter(x => validateur(x.payload.value));
      } else if (prop === 'add') {
        return async (data: T): Promise<string> => {
          const valide = validateur(data)
          if (valide) {
            return await target.add(data)
          }
          throw new Error(JSON.stringify(validateur.errors, undefined, 2));
        }
      } else if (prop === 'get') {
        return (hash: string): LogEntry<T> => {
          const données = target.get(hash);
          const valide = validateur(données.payload.value)
          if (valide) {
            return données
          }
          throw new Error(JSON.stringify(validateur.errors, undefined, 2))
        }
      } else if (prop === 'iterator') {
        return (options?: {
            gt?: string,
            gte?: string,
            lt?: string,
            lte?: string,
            limit?: number,
            reverse?: boolean
        }): {
            [Symbol.iterator](): Iterator<LogEntry<T>>,
            next(): { value?: LogEntry<T>, done: boolean },
            collect(): LogEntry<T>[]
        } => {
          const itérateurBd = target.iterator(options);

          const itérateurType =  {
            *[Symbol.iterator](): Iterator<LogEntry<T>> {
                for (const x of itérateurBd) {
                  if (validateur(x)) {
                    yield x;
                  }
                }
            },
            next(): { value?: LogEntry<T>, done: boolean } {
              let suivant = itérateurBd.next();
              while (!validateur(suivant.value)) {
                if (suivant.done) return { done: true };
                suivant = itérateurBd.next();
              }
              return suivant
            },
            collect(): LogEntry<T>[] {
              return itérateurBd.collect().filter(x => validateur(x));
            }
          }
          return itérateurType
        };
      } else {
        return target[prop as keyof typeof target];
      };
    }
  })
}

const validerTypesDicOrbite = <T extends {[clef: string]: élémentsBd}>({bd, schéma}: {bd: KeyValueStore<T>, schéma: JSONSchemaType<T>}): KeyValueStore<T> => {
  const validateur = ajv.compile(schéma);
  const validateurs = Object.fromEntries((Object.entries(schéma.properties || {}) as [keyof T, JSONSchemaType<T[keyof T]>][]).map(([c, p])=>[c, ajv.compile(p.type)])) as  {[clef in keyof T]: ValidateFunction<T[clef]>};

  return new Proxy(bd, {
    get(target, prop) {
      if (prop === 'get') {
        return (key: Extract<keyof T, string>): T[typeof key] => {
          const val = target.get(key);
          const valide  = validateurs[key]?.(val);
          if (valide)
            return val
          else
            throw new Error(JSON.stringify(validateurs[key]?.errors, undefined, 2) || `Clef ${key} non supportée.`)
        };
      } else if (prop === 'put' || prop === 'set') {
        return async (key: Extract<keyof T, string>, value: T[typeof key], options?: object): Promise<string>  => {
          const valide = validateurs[key]?.(value);
          if (valide)
            return await target.put(key, value,  options)
          else
          throw new Error(JSON.stringify(validateurs[key]?.errors, undefined, 2) || `Clef ${key} non supportée.`)
        };
      } else if (prop === 'all') {
        const données = target.all
        const valide = validateur(données)
        if (valide) {
          return données
        } else {
          throw new Error(JSON.stringify(validateur.errors, undefined, 2))
        }
      } else {
        return target[prop as keyof typeof target]
      }
    }
  })
}
