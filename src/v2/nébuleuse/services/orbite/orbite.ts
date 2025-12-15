import { join } from "path";
import {
  createOrbitDB,
  useDatabaseType,
  useAccessController,
} from "@orbitdb/core";
import drain from "it-drain";

import { Nested } from "@orbitdb/nested-db";
import { Feed } from "@orbitdb/feed-db";
import { SetDb } from "@orbitdb/set-db";
import { v4 as uuidv4 } from "uuid";
import { OrderedKeyValue } from "@orbitdb/ordered-keyvalue-db";
import {
  typedFeed,
  typedKeyValue,
  typedNested,
  typedOrderedKeyValue,
  typedSet,
} from "@constl/bohr-db";
import { anySignal } from "any-signal";
import Base64 from "crypto-js/enc-base64.js";
import md5 from "crypto-js/md5.js";
import { CID } from "multiformats";
import { STATUTS } from "@/v2/appli/consts.js";
import { cacheSuivi } from "../../cache.js";
import { ServiceAppli } from "../../../appli/index.js";
import { réessayer } from "../../utils.js";
import { ContrôleurAccès } from "../compte/accès/contrôleurModératrices.js";
import { ContrôleurNébuleuse } from "../compte/accès/contrôleurNébuleuse.js";
import { mandatOrbite } from "./mandat.js";
import type {
  OrbitDB,
  BaseDatabase,
  OpenDatabaseOptions,
  KeyValueDatabase,
} from "@orbitdb/core";
import type { ServiceJournal } from "../journal.js";
import type { ServicesNécessairesHélia } from "../hélia.js";
import type { Oublier, Suivi } from "../../types.js";
import type { Appli } from "../../../appli/index.js";
import type { PartielRécursif } from "@/v2/types.js";
import type {
  DBElements,
  TypedFeed,
  TypedKeyValue,
  TypedNested,
  TypedOrderedKeyValue,
  TypedSet,
} from "@constl/bohr-db";
import type { JSONSchemaType } from "ajv";
import type { OrderedKeyValueDatabaseType } from "@orbitdb/ordered-keyvalue-db";
import type { SetDatabaseType } from "@orbitdb/set-db";
import type { FeedDatabaseType } from "@orbitdb/feed-db";
import type { NestedDatabaseType, NestedValueObject } from "@orbitdb/nested-db";
import type { Helia } from "helia";
import type { Libp2p } from "libp2p";
import type { ServicesLibp2pNébuleuse } from "../libp2p/libp2p.js";

export const préparerOrbite = () => {
  useDatabaseType(Feed);
  useDatabaseType(SetDb);
  useDatabaseType(OrderedKeyValue);
  useDatabaseType(Nested);
  useAccessController(ContrôleurAccès);
  useAccessController(ContrôleurNébuleuse);
};

export type BdsOrbite = {
  keyvalue: KeyValueDatabase;
  "ordered-keyvalue": OrderedKeyValueDatabaseType;
  nested: NestedDatabaseType;
  feed: FeedDatabaseType;
  set: SetDatabaseType;
};

export type ContenuBdTypée<T extends keyof BdsOrbite> = T extends
  | "keyvalue"
  | "ordered-keyvalue"
  ? { [clef: string]: DBElements }
  : T extends "nested"
    ? NestedValueObject
    : DBElements;

export type BdTypée<
  T extends keyof BdsOrbite,
  S extends ContenuBdTypée<T>,
> = T extends "feed"
  ? TypedFeed<S>
  : T extends "set"
    ? TypedSet<S>
    : T extends "keyvalue"
      ? TypedKeyValue<Extract<S, ContenuBdTypée<T>>>
      : T extends "ordered-keyvalue"
        ? TypedOrderedKeyValue<Extract<S, ContenuBdTypée<T>>>
        : T extends "nested"
          ? TypedNested<Extract<S, ContenuBdTypée<T>>>
          : never;

export type SchémaJSON<
  T extends keyof BdsOrbite,
  S extends ContenuBdTypée<T>,
> = JSONSchemaType<
  T extends "nested"
    ? PartielRécursif<S>
    : T extends "keyvalue" | "ordered-keyvalue"
      ? Partial<S>
      : S
>;

// https://stackoverflow.com/questions/56863875/typescript-how-do-you-filter-a-types-properties-to-those-of-a-certain-type
type KeysMatching<T extends object, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

export const typer = <T extends keyof BdsOrbite, S extends ContenuBdTypée<T>>({
  bd,
  schéma,
}: {
  bd: BdsOrbite[T];
  schéma: SchémaJSON<T, S>;
}): BdTypée<T, S> => {
  let bdTypée: BdTypée<T, S>;
  switch (bd.type) {
    case "feed": {
      bdTypée = typedFeed({
        db: bd,
        schema: schéma as JSONSchemaType<S>,
      }) as BdTypée<T, S>;
      break;
    }
    case "set": {
      bdTypée = typedSet({
        db: bd,
        schema: schéma as JSONSchemaType<S>,
      }) as BdTypée<T, S>;
      break;
    }
    case "keyvalue": {
      bdTypée = typedKeyValue({
        db: bd,
        schema: schéma as JSONSchemaType<
          Partial<Extract<S, ContenuBdTypée<"keyvalue">>>
        >,
      }) as BdTypée<T, S>;
      break;
    }
    case "ordered-keyvalue": {
      bdTypée = typedOrderedKeyValue({
        db: bd,
        schema: schéma as JSONSchemaType<
          Partial<Extract<S, ContenuBdTypée<"ordered-keyvalue">>>
        >,
      }) as BdTypée<T, S>;
      break;
    }
    case "nested": {
      bdTypée = typedNested({
        db: bd,
        schema: schéma as JSONSchemaType<
          PartielRécursif<Extract<S, ContenuBdTypée<"nested">>>
        >,
      }) as BdTypée<T, S>;
      break;
    }
  }
  return bdTypée;
};

export type Signature = {
  signature: string;
  clefPublique: string;
};

// Types service

export type OptionsServiceOrbite<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> = {
  orbite?: OrbitDB<L>;
};

export type ServicesNécessairesOrbite<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> = ServicesNécessairesHélia<L> & {
  journal: ServiceJournal;
  orbite: ServiceOrbite<L>;
};

export class ServiceOrbite<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> extends ServiceAppli<
  "orbite",
  ServicesNécessairesOrbite<L>,
  {
    orbite?: OrbitDB<L>;
  },
  OptionsServiceOrbite<L>
> {
  signaleurArrêt: AbortController;

  constructor({
    appli,
    options,
  }: {
    appli: Appli<ServicesNécessairesOrbite<L>>;
    options?: OptionsServiceOrbite<L>;
  }) {
    super({
      clef: "orbite",
      appli,
      dépendances: ["hélia", "journal"],
      options,
    });

    this.signaleurArrêt = new AbortController();
  }

  async démarrer(): Promise<{
    orbite?: OrbitDB<L>;
  }> {
    // Générer Orbite si nécessaire
    const hélia = await this.service("hélia").hélia();
    const orbite = this.options.orbite || (await this.générerOrbite({ hélia }));

    this.estDémarré = { orbite };
    return await super.démarrer();
  }

  async orbite(): Promise<OrbitDB<L>> {
    if (this.statut === STATUTS.FERMÉE)
      throw new Error("Service orbite déjà fermé.");

    // Si `orbite` n'est pas défini dans les options, il sera rendu par `this.démarré`
    return (await this.démarré()).orbite || this.options.orbite!;
  }

  async fermer(): Promise<void> {
    // Uniquement fermer orbite s'il n'a pas été fourni manuellement dans les options
    const { orbite } = await this.démarré();

    this.signaleurArrêt.abort();
    if (orbite) await orbite.stop();

    await super.fermer();
  }

  // Initialisation d'OrbitDB

  async générerOrbite({
    hélia,
  }: {
    hélia: Helia<Libp2p<L>>;
  }): Promise<OrbitDB<L>> {
    préparerOrbite();

    const dossierRacine = await this.appli.dossier();
    const dossierOrbite = join(dossierRacine, "orbite");
    const orbite = mandatOrbite(
      await createOrbitDB({
        ipfs: hélia,
        id: "nébuleuse",
        directory: dossierOrbite,
      }),
    );

    return orbite;
  }

  // Bases de données

  async créerBd<T extends keyof BdsOrbite>({
    type,
    options = {},
    nom,
  }: {
    type: T;
    options?: Omit<OpenDatabaseOptions, "type">;
    nom?: string;
  }): Promise<{ bd: BdsOrbite[T]; oublier: Oublier }> {
    const orbite = await this.orbite();

    options = {
      AccessController: ContrôleurNébuleuse(),
      ...options,
    };
    const bd = (await orbite.open(nom || uuidv4(), {
      ...options,
      type,
    })) as BdsOrbite[T];

    const journal = this.service("journal");
    bd.events.on("error", async (e: string) => await journal.écrire(e));

    return { bd, oublier: async () => await bd.close() };
  }

  async effacerBd({ id }: { id: string }): Promise<void> {
    const { bd } = await this.ouvrirBd({ id });

    const hélia = await this.service("hélia").hélia();

    const àDésépingler: CID[] = [];
    for (const élément of await bd.log.values()) {
      const idc = CID.parse(élément.hash);
      àDésépingler.push(idc);
    }
    for (const idc of àDésépingler) await drain(hélia.pins.rm(idc));

    await bd.drop();
    await bd.close();
  }

  async ouvrirBd({
    id,
    signal,
  }: {
    id: string;
    signal?: AbortSignal;
  }): Promise<{ bd: BaseDatabase; oublier: Oublier }>;
  async ouvrirBd<T extends keyof BdsOrbite>({
    id,
    signal,
    type,
  }: {
    id: string;
    signal?: AbortSignal;
    type: T;
  }): Promise<{ bd: BdsOrbite[T]; oublier: Oublier }>;
  async ouvrirBd<T extends keyof BdsOrbite>({
    id,
    signal,
    type,
  }: {
    id: string;
    signal?: AbortSignal;
    type?: T | undefined;
  }): Promise<{ bd: BdsOrbite[T] | BaseDatabase; oublier: Oublier }>;
  async ouvrirBd<T extends keyof BdsOrbite>({
    id,
    signal,
    type,
  }: {
    id: string;
    signal?: AbortSignal;
    type?: T | undefined;
  }): Promise<{ bd: BdsOrbite[T] | BaseDatabase; oublier: Oublier }> {
    const orbite = await this.orbite();

    const signalCombiné = anySignal([
      this.signaleurArrêt.signal,
      ...(signal ? [signal] : []),
    ]);

    const bd = await réessayer(
      () => orbite.open(id, { signal: signalCombiné }),
      signalCombiné,
    );
    const journal = this.service("journal");
    const gérerErreur = async (erreur: Error) =>
      await journal.écrire(erreur.toString());
    bd.sync.events.addListener("error", gérerErreur);

    signalCombiné.clear();

    if (type) {
      if (type !== bd.type)
        throw new Error(`La bd est de type ${bd.type} et non ${type}.`);
    }
    return {
      bd,
      oublier: async () => {
        await bd.close();
        bd.sync.events.removeListener("error", gérerErreur);
      },
    };
  }

  async suivreBd({
    id,
    f,
  }: {
    id: string;
    f: Suivi<BaseDatabase>;
  }): Promise<Oublier>;
  async suivreBd<T extends keyof BdsOrbite>({
    id,
    type,
    f,
  }: {
    id: string;
    type: T;
    f: Suivi<BdsOrbite[T]>;
  }): Promise<Oublier>;
  async suivreBd<T extends keyof BdsOrbite>({
    id,
    type,
    f,
  }: {
    id: string;
    type?: T | undefined;
    f: Suivi<BdsOrbite[T] | BaseDatabase>;
  }): Promise<Oublier> {
    const { bd, oublier } = await this.ouvrirBd({ id, type });

    const fFinale = async () => {
      return await f(bd);
    };

    bd.events.on("update", fFinale);
    await fFinale();

    return async () => {
      bd.events.off("update", fFinale);
      await oublier();
    };
  }

  async suivreBdTypée<T extends keyof BdsOrbite, S extends ContenuBdTypée<T>>({
    id,
    type,
    schéma,
    f,
  }: {
    id: string;
    type: T;
    schéma: SchémaJSON<T, S>;
    f: Suivi<BdTypée<T, S>>;
  }): Promise<Oublier> {
    const { bd, oublier } = await this.ouvrirBd({ id, type });

    const bdTypée = typer({ bd, schéma });

    const fFinale = async () => {
      return await f(bdTypée);
    };

    bd.events.on("update", fFinale);
    await fFinale();

    return async () => {
      bd.events.off("update", fFinale);
      await oublier();
    };
  }

  async suivreDonnéesBd<
    T extends keyof BdsOrbite,
    S extends ContenuBdTypée<T>,
  >({
    id,
    type,
    schéma,
    f,
  }: {
    id: string;
    type: T;
    schéma: SchémaJSON<T, S>;
    f: Suivi<Awaited<ReturnType<BdTypée<T, S>["all"]>>>;
  }): Promise<Oublier> {
    return await this.suivreBdTypée({
      id,
      type,
      schéma,
      f: async (bd) => {
        const données = await bd.all();
        await f(données as Awaited<ReturnType<BdTypée<T, S>["all"]>>);
      },
    });
  }

  async appliquerFonctionBdOrbite<
    T extends BaseDatabase,
    F extends KeysMatching<
      T,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (...args: any[]) => any
    > = KeysMatching<
      T,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (...args: any[]) => any
    >,
  >({
    idBd,
    fonction,
    args,
  }: {
    idBd: string;
    fonction: F;
    args: Parameters<T[F]>;
  }): Promise<Awaited<ReturnType<T[F]>>> {
    const { bd, oublier } = await this.ouvrirBd({ id: idBd });
    const résultat = await (bd as T)[fonction](...(args as unknown[]));

    await oublier();
    return résultat;
  }

  @cacheSuivi
  async suivreEmpreinteTêteBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string>;
  }): Promise<Oublier> {
    const obtTêteBd = async (bd: BaseDatabase): Promise<string> => {
      const éléments = await bd.log.heads();
      const tête = éléments[éléments.length - 1]?.hash || "";
      return tête;
    };
    const calculerEmpreinte = (texte: string) => Base64.stringify(md5(texte));

    return await this.suivreBd({
      id: idBd,
      f: async (bd) => {
        const tête = await obtTêteBd(bd);
        await f(calculerEmpreinte(tête));
      },
    });
  }

  // Signatures

  async signer({ message }: { message: string }): Promise<Signature> {
    const orbite = await this.orbite();

    const id = orbite.identity;
    const signature = await orbite.identity.sign(id, message);
    const clefPublique = orbite.identity.publicKey;
    return { signature, clefPublique };
  }

  async vérifierSignature({
    signature,
    message,
  }: {
    signature: Signature;
    message: string;
  }): Promise<boolean> {
    if (!signature || !signature.clefPublique || !signature.signature) {
      return false;
    }
    const orbite = await this.orbite();
    return await orbite.identity.verify(
      signature.signature,
      signature.clefPublique,
      message,
    );
  }
}
