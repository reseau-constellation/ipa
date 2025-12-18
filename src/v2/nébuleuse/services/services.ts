import { asSplitKey, joinKey, splitKey } from "@orbitdb/nested-db";
import { ServiceAppli } from "@/v2/nébuleuse/appli/index.js";
import { mapÀObjet } from "../utils.js";
import type { NestedValueObject } from "@orbitdb/nested-db";
import type { TypedNested } from "@constl/bohr-db";
import type { JSONSchemaType } from "ajv";
import type {
  ExtractKeys,
  ExtractKeysAsList,
  GetValueFromKey,
  GetValueFromKeyList,
} from "node_modules/@constl/bohr-db/dist/types.js";
import type { RecursivePartial } from "node_modules/@orbitdb/nested-db/dist/types.js";
import type { OptionsCommunes, ServicesAppli } from "@/v2/nébuleuse/appli/appli.js";

import type { PartielRécursif } from "@/v2/types.js";
import type { Oublier, Suivi } from "../types.js";
import type { ServicesLibp2pNébuleuse } from "./libp2p/libp2p.js";
import type { ServiceCompte, ServicesNécessairesCompte } from "./compte/compte.js";

export type ClefDeBranche<T extends NestedValueObject> = keyof {
  [C in ExtractKeys<T> as GetValueFromKey<T, C> extends NestedValueObject
    ? C
    : never]: unknown;
};

export const brancheBd = <
  T extends NestedValueObject,
  C extends ClefDeBranche<T>,
>({
  bd,
  clef,
}: {
  bd: TypedNested<T>;
  clef: C;
}): T[C] extends NestedValueObject ? TypedNested<T[C]> : never => {
  return new Proxy(bd, {
    get(target, prop) {
      if (prop === "put" || prop === "set") {
        const putBranche = async <
          K extends
            | ExtractKeys<T[C]>
            | ExtractKeysAsList<T[C]>
            | RecursivePartial<T[C]>,
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
            ]) as ExtractKeys<T>;
            return await target.put(clefFinale, valeur, position);
          } else {
            return await target.put(clef, clefOuValeur);
          }
        };
        return putBranche;
      } else if (prop === "del") {
        const delBranche: TypedNested<T[C]>["del"] = async (...args) => {
          const [sousClef] = args;
          const clefFinale = joinKey([
            clef,
            ...asSplitKey(sousClef),
          ]) as ExtractKeys<T>;
          return await target.del(clefFinale);
        };
        return delBranche;
      } else if (prop === "get") {
        const getBranche = async (
          sousClef: ExtractKeys<T[C]> | ExtractKeysAsList<T[C]>,
        ) => {
          const clefFinale = joinKey([
            clef,
            ...asSplitKey(sousClef),
          ]) as ExtractKeys<T>;
          return await target.get(clefFinale);
        };
        return getBranche;
      } else if (prop === "all") {
        const allBranche = async () => {
          return (await target.all()).get(clef);
        };
        return allBranche;
      } else {
        return target[prop as keyof typeof target];
      }
    },
  }) as unknown as T[C] extends NestedValueObject ? TypedNested<T[C]> : never;
};

export type ServicesNécessairesDonnées<S extends NestedValueObject, L extends ServicesLibp2pNébuleuse> = ServicesNécessairesCompte<L> & { compte: ServiceCompte<S, L> }

export type OptionsServiceDonnées<Structure extends NestedValueObject> = {
  schéma: JSONSchemaType<PartielRécursif<Structure>>;
}

export class ServiceDonnéesAppli<
  T extends string,
  Structure extends NestedValueObject,
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
  Services extends ServicesAppli = ServicesAppli,
  RetourDémarré = unknown,
  Options extends { schéma: JSONSchemaType<PartielRécursif<Structure>> } = {
    schéma: JSONSchemaType<PartielRécursif<Structure>>;
  },
> extends ServiceAppli<
  Services & ServicesNécessairesDonnées<Structure, L>,
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
    services: Services & ServicesNécessairesDonnées<Structure, L>,
    dépendances?: Extract<
      keyof Services & ServicesNécessairesDonnées<Structure, L>,
      string
    >[];
    options: Options & OptionsCommunes;
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

    return brancheBd<Record<T, Structure>, T>({
      bd: bdCompte,
      clef: this.clef,
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
      | null
      | undefined
    >;
    clef?: T;
    idCompte?: string;
  }): Promise<Oublier> {
    return this.service("compte").suivreBd({
      f: async (bd) => {
        if (!bd) {
          await f(undefined);
          return;
        }
        let données = mapÀObjet(await bd.all());
        for (const k of asSplitKey(
          clef ? joinKey([this.clef, ...splitKey(clef)]) : this.clef,
        )) {
          données = données[k];
          if (données === undefined) {
            données = null;
            break;
          }
        }
        await f(données);
      },
      idCompte,
    });
  }
}
