import {
  type OrbitDB,
  createOrbitDB,
  KeyValueDatabase,
  OpenDatabaseOptions,
} from "@orbitdb/core";
import { v4 as uuidv4 } from "uuid";

import { type FeedDatabaseType, registerFeed } from "@orbitdb/feed-db";
import {
  type OrderedKeyValueDatabaseType,
  registerOrderedKeyValue,
} from "@orbitdb/ordered-keyvalue-db";
import { type SetDatabaseType, registerSet } from "@orbitdb/set-db";

import {
  typedFeed,
  TypedFeed,
  typedKeyValue,
  TypedKeyValue,
  typedOrderedKeyValue,
  TypedOrderedKeyValue,
  typedSet,
  TypedSet,
} from "@constl/bohr-db";
import { type JSONSchemaType } from "ajv";

import Semaphore from "@chriscdn/promise-semaphore";
import { enregistrerContrôleurs } from "@/accès/index.js";
import type { schémaFonctionOublier, élémentsBd } from "./types.js";
import type { HeliaLibp2p } from "helia";
import type { Libp2p } from "libp2p";
import type { ServicesLibp2p } from "./sfip/index.js";

export type Store =
  | FeedDatabaseType
  | SetDatabaseType
  | KeyValueDatabase
  | OrderedKeyValueDatabaseType;

export const préparerOrbite = () => {
  registerFeed();
  registerSet();
  registerOrderedKeyValue();
  enregistrerContrôleurs();
};

export async function initOrbite<
  T extends Libp2p<ServicesLibp2p> = Libp2p<ServicesLibp2p>,
>({
  sfip,
  dossierOrbite,
}: {
  sfip: HeliaLibp2p<T>;
  dossierOrbite: string;
}): Promise<OrbitDB<T>> {
  préparerOrbite();

  const orbite = await createOrbitDB({
    ipfs: sfip,
    id: "constellation",
    directory: dossierOrbite,
  });

  return orbite;
}

type Typer<
  T extends Store,
  U extends T extends KeyValueDatabase | OrderedKeyValueDatabaseType
    ? { [clef: string]: élémentsBd }
    : élémentsBd,
> = T extends KeyValueDatabase
  ? TypedKeyValue<Extract<U, { [clef: string]: élémentsBd }>>
  : T extends FeedDatabaseType
    ? TypedFeed<U>
    : T extends SetDatabaseType
      ? TypedSet<U>
      : T extends OrderedKeyValueDatabaseType
        ? TypedOrderedKeyValue<Extract<U, { [clef: string]: élémentsBd }>>
        : never;

const typerBd = <
  T extends Store,
  U extends T extends KeyValueDatabase | OrderedKeyValueDatabaseType
    ? { [clef: string]: élémentsBd }
    : élémentsBd,
>({
  bd,
  schéma,
}: {
  bd: T;
  schéma: JSONSchemaType<U>;
}): Typer<T, U> => {
  switch (bd.type) {
    case "feed":
      return typedFeed({
        db: bd,
        schema: schéma as JSONSchemaType<U>,
      }) as Typer<T, U>;

    case "set":
      return typedSet({
        db: bd,
        schema: schéma as JSONSchemaType<U>,
      }) as unknown as Typer<T, U>;

    case "keyvalue":
      return typedKeyValue({
        db: bd,
        // @ts-expect-error Je ne sais pas pourquoi
        schema: schéma as JSONSchemaType<U>,
      }) as unknown as Typer<T, U>;

    case "ordered-keyvalue":
      return typedOrderedKeyValue({
        db: bd,
        // @ts-expect-error Je ne sais pas pourquoi
        schema: schéma as JSONSchemaType<U>,
      }) as unknown as Typer<T, U>;

    default:
      throw new Error("Type de bd non reconnu.");
  }
};

type bdOuverte<T extends Store> = { bd: T; idsRequêtes: Set<string> };

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

  async ouvrirBd<T extends KeyValueDatabase>({
    id,
    type,
    options,
  }: {
    id: string;
    type: "keyvalue";
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends FeedDatabaseType>({
    id,
    type,
    options,
  }: {
    id: string;
    type: "feed";
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends SetDatabaseType>({
    id,
    type,
    options,
  }: {
    id: string;
    type: "set";
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends OrderedKeyValueDatabaseType>({
    id,
    type,
    options,
  }: {
    id: string;
    type: "ordered-keyvalue";
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends Store>({
    id,
  }: {
    id: string;
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends Store>({
    id,
    type,
    options,
  }: {
    id: string;
    type?: "keyvalue" | "feed" | "set" | "ordered-keyvalue";
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends Store>({
    id,
    type,
    options,
  }: {
    id: string;
    type?: "keyvalue" | "feed" | "set" | "ordered-keyvalue";
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{
    bd: T;
    fOublier: schémaFonctionOublier;
  }> {
    // Nous avons besoin d'un verrou afin d'éviter la concurrence
    await this.verrouOuvertureBd.acquire(id);
    const existante = this._bdsOrbite[id];

    const idRequête = uuidv4();

    const fOublier = async () => {
      // Si la BD a été effacée entre-temps par `client.effacerBd`,
      // elle ne sera plus disponible ici
      if (!this._bdsOrbite[id]) return;

      this._bdsOrbite[id].idsRequêtes.delete(idRequête);
    };

    // Fonction utilitaire pour vérifier le type de la bd
    const vérifierTypeBd = (bd: Store): boolean => {
      const { type: typeBd } = bd;
      if (type === undefined) return true;
      return typeBd === type;
    };

    if (existante) {
      this._bdsOrbite[id].idsRequêtes.add(idRequête);
      this.verrouOuvertureBd.release(id);

      if (!vérifierTypeBd(existante.bd))
        throw new Error(
          `La bd est de type ${existante.bd.type}, et non ${type}.`,
        );

      return {
        bd: existante.bd as T,
        fOublier,
      };
    }

    try {
      const bd = (await this.orbite.open(id, { type, ...options })) as T;

      this._bdsOrbite[id] = { bd, idsRequêtes: new Set([idRequête]) };

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
    T = TypedKeyValue<U>,
  >({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    type: "keyvalue";
    schéma: JSONSchemaType<U>;
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBdTypée<U extends élémentsBd, T = TypedFeed<U>>({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    type: "feed";
    schéma: JSONSchemaType<U>;
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBdTypée<U extends élémentsBd, T = TypedSet<U>>({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    type: "set";
    schéma: JSONSchemaType<U>;
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBdTypée<
    U extends { [clef: string]: élémentsBd },
    T = TypedOrderedKeyValue<U>,
  >({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    type: "ordered-keyvalue";
    schéma: JSONSchemaType<U>;
    options?: Omit<OpenDatabaseOptions, "type">;
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
    options?: Omit<OpenDatabaseOptions, "type">;
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
    options: Omit<OpenDatabaseOptions, "type">;
    nom?: string;
  }): Promise<string> {
    const bd = (await this.orbite.open(nom || uuidv4(), {
      type,
      ...options,
    })) as Store;
    const { address } = bd;

    this._bdsOrbite[address] = { bd, idsRequêtes: new Set() };
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
          const { bd, idsRequêtes } = this._bdsOrbite[id];
          if (!idsRequêtes.size) {
            delete this._bdsOrbite[id];
            await bd.close();
          }
        }),
      );
    };
    const i = setInterval(fNettoyer, 1000 * 60 * 5);
    return async () => clearInterval(i);
  }

  async appliquerFonctionBdOrbite({
    idBd,
    fonction,
    args,
  }: {
    idBd: string;
    fonction: string;
    args: unknown[];
  }): Promise<unknown> {
    const { bd, fOublier } = await this.ouvrirBd({ id: idBd });

    // @ts-expect-error L'inférence de types marche mal ici
    const résultat = await bd[fonction](...args);

    await fOublier();
    return résultat;
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
