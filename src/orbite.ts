import type { IPFS } from "ipfs-core";
import type KeyValueStore from "orbit-db-kvstore";
import FeedStore from "orbit-db-feedstore";
import Store from "orbit-db-store";

import type { élémentsBd } from "./utils/types.js";

import OrbitDB from "orbit-db";
import AccessControllers from "@/accès/index.js";
import { isElectronMain, isNode } from "wherearewe";
import Ajv, { type JSONSchemaType, type ValidateFunction } from "ajv";

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

  return await OrbitDB.createInstance(sfip, {
    directory: dossierOrbiteFinal,
    AccessControllers,
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
          throw new Error(JSON.stringify(validateur.errors, undefined, 2));
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
    if (valid) return true;
    else
      console.error(
        new Error(
          JSON.stringify({ v, clef, erreurs: vld.errors }, undefined, 2)
        ).stack
      );
    return false;
  };

  return new Proxy(bd, {
    get(target, prop) {
      if (prop === "get") {
        return (key: Extract<keyof T, string>): T[typeof key] | undefined => {
          const val = target.get(key);
          const valide = valider(val, key); // validateurs[key]?.(val);
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
          console.error(JSON.stringify(validateur.errors, undefined, 2));
          throw new Error(JSON.stringify(validateur.errors, undefined, 2));
        }
      } else {
        return target[prop as keyof typeof target];
      }
    },
  });
};
