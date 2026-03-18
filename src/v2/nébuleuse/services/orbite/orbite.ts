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
import { typedNested } from "@constl/bohr-db";
import { anySignal } from "any-signal";
import Base64 from "crypto-js/enc-base64url.js";
import md5 from "crypto-js/md5.js";
import { CID } from "multiformats";
import { STATUTS } from "@/v2/nébuleuse/appli/consts.js";
import { cacheSuivi } from "../../cache.js";
import { ServiceAppli } from "../../appli/index.js";
import { réessayer } from "../../utils.js";
import { ContrôleurAccès } from "../compte/accès/contrôleurModératrices.js";
import { ContrôleurNébuleuse } from "../compte/accès/_contrôleurNébuleuse.js";
import { mandatOrbite } from "./mandat.js";
import type { OptionsAppli } from "../../appli/appli.js";
import type {
  OrbitDB,
  BaseDatabase,
  OpenDatabaseOptions,
  KeyValueDatabase,
} from "@orbitdb/core";
import type { ServiceJournal } from "../journal.js";
import type { ServiceHélia, ServicesNécessairesHélia } from "../hélia.js";
import type { Oublier, Suivi } from "../../types.js";
import type { PartielRécursif } from "@/v2/types.js";
import type { TypedNested } from "@constl/bohr-db";
import type { JSONSchemaType } from "ajv";
import type { OrderedKeyValueDatabaseType } from "@orbitdb/ordered-keyvalue-db";
import type { SetDatabaseType } from "@orbitdb/set-db";
import type { FeedDatabaseType } from "@orbitdb/feed-db";
import type { NestedDatabaseType, NestedValue } from "@orbitdb/nested-db";
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

// https://stackoverflow.com/questions/56863875/typescript-how-do-you-filter-a-types-properties-to-those-of-a-certain-type
type KeysMatching<T extends object, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

export type Signature = {
  signature: string;
  clefPublique: string;
  empreinteIdentité: string;
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
  hélia: ServiceHélia<L>;
  journal: ServiceJournal;
};

type RetourDémarrageOrbite<L extends ServicesLibp2pNébuleuse> = {
  orbite?: OrbitDB<L>;
};

export class ServiceOrbite<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> extends ServiceAppli<
  "orbite",
  ServicesNécessairesOrbite<L>,
  RetourDémarrageOrbite<L>,
  OptionsServiceOrbite<L>
> {
  signaleurArrêt: AbortController;

  constructor({
    services,
    options,
  }: {
    services: ServicesNécessairesOrbite<L>;
    options: OptionsServiceOrbite<L> & OptionsAppli;
  }) {
    super({
      clef: "orbite",
      services,
      dépendances: ["hélia", "journal", "dossier"],
      options,
    });

    this.signaleurArrêt = new AbortController();
  }

  async démarrer() {
    // Réinitialiser le signaleur, mais uniquement si nécessaire.
    if (this.signaleurArrêt.signal.aborted)
      this.signaleurArrêt = new AbortController();

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

  async obtIdDispositif(): Promise<string> {
    const orbite = await this.orbite();
    return orbite.identity.id;
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

    const journal = this.service("journal");

    const dossier = await this.service("dossier").dossier();
    const dossierOrbite = join(dossier, "orbite");
    const orbite = mandatOrbite(
      await createOrbitDB({
        ipfs: hélia,
        id: "nébuleuse",
        directory: dossierOrbite,
      }),
      (erreur) => journal.écrire(erreur.toString())
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

    const signalFinal = options.signal
      ? anySignal([this.signaleurArrêt.signal, options.signal])
      : this.signaleurArrêt.signal;
    const optionsFinales: OpenDatabaseOptions = {
      AccessController: ContrôleurNébuleuse(),
      ...options,
      type,
      signal: signalFinal,
    };

    const bd = (await orbite.open(
      nom || uuidv4(),
      optionsFinales,
    )) as BdsOrbite[T];

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

    const signalFinal = signal
      ? anySignal([this.signaleurArrêt.signal, signal])
      : this.signaleurArrêt.signal;

    const bd = await réessayer(
      () => orbite.open(id, { signal: signalFinal }),
      signalFinal,
    );

    if (type) {
      if (type !== bd.type) {
        throw new Error(`La bd est de type ${bd.type} et non ${type}.`);
      }
    }
    return {
      bd,
      oublier: async () => {
        await bd.close();
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

  async suivreBdEmboîtéeTypée<T extends NestedValue>({
    id,
    schéma,
    f,
    signal,
  }: {
    id: string;
    schéma: JSONSchemaType<PartielRécursif<T>>;
    f: Suivi<TypedNested<T>>;
    signal?: AbortSignal;
  }): Promise<Oublier> {
    const { bd, oublier } = await this.ouvrirBd({ id, type: "nested", signal });

    const bdTypée = typedNested({ db: bd, schema: schéma });

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

  async suivreDonnéesBdEmboîtée<T extends NestedValue>({
    id,
    schéma,
    f,
  }: {
    id: string;
    schéma: JSONSchemaType<PartielRécursif<T>>;
    f: Suivi<PartielRécursif<T>>;
  }): Promise<Oublier> {
    return await this.suivreBdEmboîtéeTypée<T>({
      id,
      schéma,
      f: async (bd) => {
        const données = await bd.all();
        await f(données);
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
    // @ts-expect-error Je ne sais pas pourquoi
    args: Parameters<T[F]>;
    // @ts-expect-error Je ne sais pas pourquoi
  }): Promise<Awaited<ReturnType<T[F]>>> {
    const { bd, oublier } = await this.ouvrirBd({ id: idBd });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const résultat = await ((bd as T)[fonction] as (...args: any[]) => any)(
      ...(args as unknown[]),
    );

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
    const empreinteIdentité = orbite.identity.hash;
    return { signature, clefPublique, empreinteIdentité };
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

    const identitéSignataire = await orbite.identities.getIdentity(
      signature.empreinteIdentité,
      this.signaleurArrêt.signal,
    );
    if (!identitéSignataire) {
      return false;
    }
    const { publicKey } = identitéSignataire;
    if (publicKey !== signature.clefPublique) return false;

    // Vérifier l'identité
    const identitéVérifiée =
      await orbite.identities.verifyIdentity(identitéSignataire);
    return (
      identitéVérifiée &&
      (await orbite.identities.verify(
        signature.signature,
        signature.clefPublique,
        message,
      ))
    );
  }
}

export const serviceOrbite =
  <L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse>(
    optionsOrbite?: OptionsServiceOrbite<L>,
  ) =>
  ({
    options,
    services,
  }: {
    options: OptionsAppli;
    services: ServicesNécessairesOrbite<L>;
  }) => {
    return new ServiceOrbite<L>({
      services,
      options: { ...optionsOrbite, ...options },
    });
  };
