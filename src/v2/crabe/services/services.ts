import { NestedValueObject, asSplitKey, joinKey } from "@orbitdb/nested-db";
import { TypedNested } from "@constl/bohr-db";
import { JSONSchemaType } from "ajv";
import {
  ExtractKeys,
  ExtractKeysAsList,
  GetValueFromKey,
  GetValueFromKeyList,
} from "node_modules/@constl/bohr-db/dist/types.js";
import { RecursivePartial } from "node_modules/@orbitdb/nested-db/dist/types.js";
import { suivreFonctionImbriquée } from "@constl/utils-ipa";
import {
  Nébuleuse,
  ServiceNébuleuse,
  ServicesNébuleuse,
} from "@/v2/nébuleuse/nébuleuse.js";

import { PartielRécursif } from "@/v2/types.js";
import { Oublier, Suivi } from "../types.js";
import { mapÀObjet } from "../utils.js";
import { ServicesLibp2pCrabe } from "./libp2p/libp2p.js";
import { ServicesNécessairesCompte } from "./compte/compte.js";
import { journalifier } from "../../../../test/v2/utils.js";

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
          position?: K extends ExtractKeys<T> | ExtractKeysAsList<T>
            ? number | undefined
            : undefined,
        ): Promise<string[]> => {
          let args: Parameters<TypedNested<T>["put"]>;
          if (typeof clefOuValeur === "string" || Array.isArray(clefOuValeur)) {
            const clefFinale = joinKey([
              clef,
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

export class ServiceDonnéesNébuleuse<
  T extends string,
  Structure extends NestedValueObject,
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
  Services extends ServicesNébuleuse = ServicesNébuleuse,
  RetourDémarré = unknown,
  Options extends { schéma: JSONSchemaType<PartielRécursif<Structure>> } = {
    schéma: JSONSchemaType<PartielRécursif<Structure>>;
  },
> extends ServiceNébuleuse<
  T,
  Services & ServicesNécessairesCompte<L>,
  RetourDémarré,
  Options
> {
  schéma: JSONSchemaType<PartielRécursif<Structure>>;

  constructor({
    clef,
    nébuleuse,
    dépendances = [],
    options,
  }: {
    clef: T;
    nébuleuse: Nébuleuse<Services & ServicesNécessairesCompte<L>>;
    dépendances?: Extract<
      keyof (Services & ServicesNécessairesCompte<L>),
      string
    >[];
    options: Options;
  }) {
    super({
      clef,
      nébuleuse,
      dépendances: [...dépendances, "compte"],
      options,
    });
    this.schéma = options.schéma;
  }

  async bd(): Promise<TypedNested<Structure>> {
    const bdCompte = await this.service("compte").bd();

    return brancheBd<Structure, T>({
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
      | undefined
    >;
    clef?: T;
    idCompte?: string;
  }): Promise<Oublier> {
    if (idCompte) {
      return await this.service("orbite").suivreBdTypée({
        id: idCompte,
        type: "nested",
        schéma: this.schéma,
        f: async (x) => await f(mapÀObjet(await x.get(clef))),
      });
    } else {
      console.log("id compte dynamique")
      return await suivreFonctionImbriquée({
        fRacine: ({ fSuivreRacine }) =>
          this.service("compte").suivreIdCompte({ f: journalifier(fSuivreRacine, "idCompte") }),
        f,
        fSuivre: ({ id, fSuivreBd }) =>
          this.service("orbite").suivreBdTypée({
            id,
            type: "nested",
            schéma: this.schéma,
            f: async (x) => await fSuivreBd(await x.get(clef)),
          }),
      });
    }
  }
}
