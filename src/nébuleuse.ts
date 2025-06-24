import { TypedNested } from "@constl/bohr-db";
import {
  NestedDatabaseType,
  NestedKey,
  NestedValue,
  joinKey,
  splitKey,
} from "@orbitdb/nested-db";
import { ExtractKeys, GetValueFromKey } from "node_modules/@constl/bohr-db/dist/types.js";
import { TypedEmitter } from "tiny-typed-emitter";
import { RecursivePartial } from "./types.js";
import type { JSONSchemaType } from "ajv";

const envelopperNested = <T extends NestedValue, K extends ExtractKeys<T>>(
  clef: K,
  bd: TypedNested<T>,
): T[K] extends NestedValue ? TypedNested<T[K]> : never => {
  return new Proxy(bd, {
    get(cible, prop) {
      if (prop === "put") {
        const putFinal: NestedDatabaseType["put"] = async (
          ...args: Parameters<NestedDatabaseType["put"]>
        ) => {
          const [key, valeur] = args;
          const clefFinale = joinKey([
            clef,
            ...(typeof key === "string" ? splitKey(key) : key),
          ]);
          // @ts-expect-error  Sera réglé après mise à jour
          return await cible.put(clefFinale, valeur);
        };
        // À faire : autres fonctions
        return putFinal;
      }
      return cible[prop as keyof typeof cible];
    },
  }) as unknown as T[K] extends NestedValue ? TypedNested<T[K]> : never;
};

type ÉvénementsServiceNébuleuse = {
  démarré: () => void;
};

export class ServiceNébuleuse<
  T extends string,
  D extends ServicesDéfautNébuleuse = ServicesDéfautNébuleuse,
  S extends StructureNébuleuse = StructureNébuleuse,
> {
  type: T;
  nébuleuse: Nébuleuse<D>;
  dépendances: (keyof D)[];
  structure: T extends ExtractKeys<S> ? JSONSchemaType<RecursivePartial<S>> : undefined;

  estDémarré: boolean;
  événements: TypedEmitter<ÉvénementsServiceNébuleuse>;

  bd: T extends ExtractKeys<S> ? GetValueFromKey<S, T> extends NestedValue ? GetValueFromKey<S, T> : undefined : undefined;

  constructor({
    type,
    nébuleuse,
    dépendances = [],
    structure,
  }: {
    type: T;
    nébuleuse: Nébuleuse<D>;
    dépendances?: (keyof D)[];
    structure?: T extends ExtractKeys<S> ? GetValueFromKey<S, T> extends NestedValue ? JSONSchemaType<RecursivePartial<GetValueFromKey<S, T> >> : undefined : undefined;
  }) {
    this.type = type;
    this.nébuleuse = nébuleuse;
    this.dépendances = dépendances;
    this.structure = structure || undefined;

    this.estDémarré = false;
    this.événements = new TypedEmitter<ÉvénementsServiceNébuleuse>();

    this.bd = extractKeys(structure).includes(this.type) ? envelopperNested(this.type, nébuleuse.bd) : undefined;
  }

  async démarrer() {
    this.estDémarré = true;
  }

  async démarré(): Promise<void> {
    if (this.estDémarré) return;
    return new Promise((résoudre) => this.événements.once("démarré", résoudre));
  }

  async fermer(): Promise<void> {
    await this.démarré();
  }

  clef(clef: NestedKey): string {
    return joinKey([
      this.type,
      ...(typeof clef === "string" ? splitKey(clef) : clef),
    ]);
  }
}

type ClasseServiceNébuleuse<
  C extends ExtractKeys<S>,
  D extends ServicesDéfautNébuleuse,
  S extends StructureNébuleuse,
> = new (args: { nébuleuse: Nébuleuse<D> }) => ServiceNébuleuse<C, D, S>;
export type ServicesNébuleuse = { [clef: string]: ClasseServiceNébuleuse<ExtractKeys<StructureNébuleuse>> };
export type InstancesServicesNébuleuse<T extends ServicesNébuleuse> = {
  [clef in keyof T]: InstanceType<T[clef]>;
};

type StructureProfil = {
  noms: { [langue: string]: string }
}
const structureProfil: JSONSchemaType<RecursivePartial<StructureProfil>> = {
  type: "object",
  properties: {
    noms: {
      type: "object",
      additionalProperties: {
        type: "string"
      },
      required: [],
      nullable: true,
    },
  },
  required: []
}

class Profil extends ServiceNébuleuse<"profil", ServicesDéfautNébuleuse, StructureNébuleuse> {
  constructor({
    nébuleuse,
  }: {
    nébuleuse: Nébuleuse<ServicesDéfautNébuleuse>;
  }) {
    super({ type: "profil", nébuleuse, dépendances: ["réseau"], structure: structureProfil });
  }
  async sauvegarderNom({ langue, nom }: { langue: string; nom: string }) {
    await this.bd.put(`noms/${langue}`, nom);
  };
}

class Réseau extends ServiceNébuleuse<"réseau", ServicesDéfautNébuleuse, StructureNébuleuse> {
  constructor({
    nébuleuse,
  }: {
    nébuleuse: Nébuleuse<ServicesDéfautNébuleuse>;
  }) {
    super({ type: "réseau", nébuleuse });
  }

  async fermer(): Promise<void> {
    await super.fermer();
  }
}

export type ServicesDéfautNébuleuse = {
  profil: ClasseServiceNébuleuse<Profil>;
  réseau: ClasseServiceNébuleuse<Réseau>;
};

const obtServicesDéfautNébuleuse = (): ServicesDéfautNébuleuse => {
  return {
    profil: Profil,
    réseau: Réseau,
  };
};

// Constellation

export class ServiceConstellation<
  T extends string = string,
  D extends ServicesConstellation = ServicesConstellation,
> extends ServiceNébuleuse<T, D> {
  constructor({
    type,
    nébuleuse,
    dépendances = [],
  }: {
    type: T;
    nébuleuse: Constellation<D>;
    dépendances?: (keyof D)[];
  }) {
    super({ type, nébuleuse, dépendances });
  }
  public get constl(): Constellation<D> {
    return this.nébuleuse as Constellation<D>;
  }
}

type ClasseServiceConstellation<
  S extends ServiceConstellation,
  D extends ServicesConstellation = ServicesConstellation,
> = new (args: { nébuleuse: Constellation<D> }) => S;

class Bds extends ServiceConstellation<"bds"> {
  constructor({
    nébuleuse,
  }: {
    nébuleuse: Constellation<ServicesConstellation>;
  }) {
    super({ type: "bds", nébuleuse, dépendances: ["tableaux"] });
  }
}

class Tableaux extends ServiceConstellation<"tableaux"> {
  constructor({
    nébuleuse,
  }: {
    nébuleuse: Constellation<ServicesConstellation>;
  }) {
    super({ type: "tableaux", nébuleuse });
  }
}

export type ServicesConstellation = ServicesDéfautNébuleuse & {
  bds: ClasseServiceConstellation<Bds>;
  tableaux: ClasseServiceConstellation<Tableaux>;
};
const obtServicesConstellation = (): ServicesConstellation => {
  return {
    ...obtServicesDéfautNébuleuse(),
    bds: Bds,
    tableaux: Tableaux,
  };
};

type StructureNébuleuse = {
  profil: {
    noms: { [langue: string]: string };
  }
}
const schémaStructureNébuleuse: JSONSchemaType<RecursivePartial<StructureNébuleuse>> = {
  type: "object",
  properties: {
    profil: {
      ...structureProfil,
      nullable: true,
    },
  }
}

export class Nébuleuse<S extends ServicesDéfautNébuleuse, T extends NestedValue = StructureNébuleuse> {
  bd: TypedNested<T>;
  services: InstancesServicesNébuleuse<S>;

  constructor({ services }: { services?: S }) {
    services = services ?? (obtServicesDéfautNébuleuse() as S);
    this.services = Object.fromEntries(
      Object.entries(services).map(([clef, service]) => [
        clef,
        new service({ nébuleuse: this }),
      ]),
    ) as InstancesServicesNébuleuse<S>;
  }

  async initialiser() {
    await this.initialiserServices();
  }

  async initialiserServices() {
    const servicesÀDémarrer = Object.values(this.services).filter(
      (s) => !s.démarré,
    );
    if (!servicesÀDémarrer.length) return;

    const prêtsÀDémarrer = servicesÀDémarrer.filter((s) =>
      s.dépendances.every((d) => this.services[d].démarré),
    );
    if (!prêtsÀDémarrer.length)
      throw new Error(
        `Dépendances récursives ou non-existantes parmi ${prêtsÀDémarrer.join(", ")}`,
      );

    await Promise.all(prêtsÀDémarrer.map((s) => s.démarrer()));

    await this.initialiserServices();
  }

  async fermer() {
    await this.fermerServices();
  }

  async fermerServices() {
    const servicesÀFermer = Object.values(this.services).filter(
      (s) => s.démarré,
    );
    if (!servicesÀFermer.length) return;

    const prêtsÀFermer = servicesÀFermer.filter(
      (s) => !servicesÀFermer.some((d) => !d.dépendances.includes(s.type)),
    );
    if (!prêtsÀFermer.length)
      throw new Error(
        `Dépendances récursives ou non-existantes parmi ${prêtsÀFermer.join(", ")}`,
      );

    await Promise.all(prêtsÀFermer.map((s) => s.fermer()));

    await this.fermerServices();
  }
}

export class Constellation<
  S extends ServicesConstellation,
> extends Nébuleuse<S> {
  profil: Profil;
  réseau: Réseau;
  bds: Bds;
  tableaux: Tableaux;

  constructor({ services }: { services?: S }) {
    services = services ?? (obtServicesConstellation() as S);
    super({ services });

    // Pour garder l'IPA d'avant que j'aime bien...
    this.réseau = this.services["réseau"];

    this.profil = this.services["profil"];
    this.bds = this.services["bds"];
    this.tableaux = this.services["tableaux"];
  }
}
