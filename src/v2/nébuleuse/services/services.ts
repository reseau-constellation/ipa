import {
  asSplitKey,
  isNestedValue,
  joinKey,
  splitKey,
} from "@orbitdb/nested-db";
import { ServiceAppli } from "@/v2/nébuleuse/appli/index.js";
import type { DagCborEncodable } from "@orbitdb/core";
import type { NestedValue } from "@orbitdb/nested-db";
import type { TypedNested } from "@constl/bohr-db";
import type { JSONSchemaType } from "ajv";
import type {
  ExtractKeys,
  ExtractKeysAsList,
  GetValueFromKey,
  GetValueFromKeyList,
  GetValueFromNestedKey,
} from "node_modules/@constl/bohr-db/dist/types.js";
import type {
  NestedValueWithUndefined,
  RecursivePartial,
} from "node_modules/@orbitdb/nested-db/dist/types.js";
import type { OptionsCommunes } from "@/v2/nébuleuse/appli/appli.js";

import type { PartielRécursif } from "@/v2/types.js";
import type { Oublier, Suivi } from "../types.js";
import type { ServicesLibp2pNébuleuse } from "./libp2p/libp2p.js";
import type {
  ServiceCompte,
  ServicesNécessairesCompte,
} from "./compte/compte.js";

export type ClefDeBranche<T extends NestedValue> = keyof {
  [C in ExtractKeys<T> as GetValueFromKey<T, C> extends NestedValue
    ? C
    : never]: unknown;
};

export const brancheBd = <T extends NestedValue, C extends string>({
  bd,
  clef,
}: {
  bd: TypedNested<Record<C, T>>;
  clef: C;
}): TypedNested<T> => {
  return new Proxy(bd, {
    get(target, prop) {
      if (prop === "insert") {
        const insertBranche = async <
          K extends ExtractKeys<T> | ExtractKeysAsList<T> | RecursivePartial<T>,
        >(
          clefOuValeur: K,
          valeur?: K extends ExtractKeys<T>
            ? GetValueFromKey<T, K>
            : K extends ExtractKeysAsList<T>
              ? GetValueFromKeyList<T, K>
              : undefined,
        ): Promise<string[]> => {
          if (typeof clefOuValeur === "string" || Array.isArray(clefOuValeur)) {
            const clefFinale = joinKey([
              clef as string,
              ...asSplitKey(clefOuValeur),
            ]) as ExtractKeys<Record<C, T>>;
            // @ts-expect-error ça me dépasse pour l'instant
            return await target.insert(clefFinale, valeur!);
          } else {
            return await target.insert(
              clef as ExtractKeys<Record<C, T>>,
              clefOuValeur,
            );
          }
        };
        return insertBranche;
      } else if (prop === "del") {
        const delBranche: TypedNested<T>["del"] = async (...args) => {
          const [sousClef] = args;
          const clefFinale = joinKey([
            clef,
            ...asSplitKey(sousClef),
          ]) as ExtractKeys<Record<C, T>>;
          return await target.del(clefFinale);
        };
        return delBranche;
      } else if (prop === "get") {
        const getBranche = async (
          sousClef: ExtractKeys<T> | ExtractKeysAsList<T>,
        ) => {
          const clefFinale = joinKey([
            clef,
            ...asSplitKey(sousClef),
          ]) as ExtractKeys<Record<C, T>>;
          return await target.get(clefFinale);
        };
        return getBranche;
      } else if (prop === "put" || prop === "set") {
        const putBranche = async <
          K extends ExtractKeys<T> | ExtractKeysAsList<T>,
        >(
          sousClef: K,
          valeur: GetValueFromNestedKey<T, K>,
        ): Promise<string[]> => {
          const clefFinale = joinKey([
            clef as string,
            ...asSplitKey(sousClef),
          ]) as ExtractKeys<Record<C, T>>;
          return await target.put(
            clefFinale,
            valeur as GetValueFromKey<Record<C, T>, ExtractKeys<Record<C, T>>>,
          );
        };
        return putBranche;
      } else if (prop === "all") {
        const allBranche: TypedNested<T>["all"] = async () => {
          return (await target.all())[clef] || {};
        };
        return allBranche;
      } else {
        return target[prop as keyof typeof target];
      }
    },
  }) as TypedNested<T>;
};

export type ServicesNécessairesDonnées<
  S extends { [clef: string]: NestedValue },
> = ServicesNécessairesCompte & { compte: ServiceCompte<S> };

export type OptionsServiceDonnées<Structure extends NestedValue> = {
  schéma: JSONSchemaType<PartielRécursif<Structure>>;
};

export type ServicesAditionnelsDonnéesAppli = Record<
  Exclude<string, "compte" | keyof ServicesNécessairesCompte>,
  ServiceAppli<string>
>;

export abstract class ServiceDonnéesAppli<
  T extends string,
  Structure extends NestedValue,
  Services extends ServicesAditionnelsDonnéesAppli = Record<
    Exclude<string, keyof ServicesAditionnelsDonnéesAppli>,
    never
  >,
  RetourDémarré = unknown,
  Options extends { schéma: JSONSchemaType<PartielRécursif<Structure>> } = {
    schéma: JSONSchemaType<PartielRécursif<Structure>>;
  },
> extends ServiceAppli<
  T,
  Services & ServicesNécessairesDonnées<Record<T, Structure>>,
  RetourDémarré,
  Options
> {
  schéma: JSONSchemaType<PartielRécursif<Structure>>;

  constructor({
    clef,
    services,
    dépendances = [],
    options,
  }: {
    clef: T;
    services: ServicesNécessairesDonnées<Record<T, Structure>> & Services;
    dépendances?: NoInfer<
      (keyof (Services & ServicesNécessairesDonnées<Record<T, Structure>>))[]
    >;
    options: NoInfer<Options> & OptionsCommunes;
  }) {
    super({
      clef,
      services,
      dépendances: [...dépendances, "compte"],
      options,
    });
    this.schéma = options.schéma;
  }

  async bd(): Promise<TypedNested<Structure>> {
    const bdCompte = await this.service("compte").bd();

    return brancheBd<Structure, T>({
      bd: bdCompte,
      clef: this.clef as T,
    });
  }

  async suivreBd<T extends ExtractKeys<Structure> | undefined = undefined>({
    f,
    idCompte,
    clef,
  }: {
    f: Suivi<
      | (T extends ExtractKeys<Structure>
          ? GetValueFromKey<Structure, T>
          : PartielRécursif<Structure>)
      | undefined
    >;
    clef?: T;
    idCompte?: string;
  }): Promise<Oublier> {
    const compte = this.service("compte");
    return compte.suivreBd({
      f: async (bd) => {
        if (!bd) {
          await f(undefined);
          return;
        }
        let données: NestedValueWithUndefined | DagCborEncodable =
          await bd.all();
        for (const k of asSplitKey(
          clef ? joinKey([this.clef, ...splitKey(clef)]) : this.clef,
        )) {
          if (isNestedValue<DagCborEncodable>(données))
            données = (données as NestedValue)[k];
          else {
            return await f(undefined);
          }
        }
        await f(
          données as T extends ExtractKeys<Structure>
            ? GetValueFromKey<Structure, T>
            : PartielRécursif<Structure>,
        );
      },
      idCompte,
    });
  }
}
