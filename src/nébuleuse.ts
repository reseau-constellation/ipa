import { TypedEmitter } from "tiny-typed-emitter";

type ÉvénementsServiceNébuleuse = {
  démarré: () => void;
};

export class ServiceNébuleuse<
  T extends string = string,
  D extends ServicesDéfautNébuleuse = ServicesDéfautNébuleuse,
> {
  type: T;
  nébuleuse: Nébuleuse<D>;
  dépendances: (keyof D)[];
  estDémarré: boolean;
  événements: TypedEmitter<ÉvénementsServiceNébuleuse>;

  constructor({
    type,
    nébuleuse,
    dépendances = [],
  }: {
    type: T;
    nébuleuse: Nébuleuse<D>;
    dépendances?: (keyof D)[];
  }) {
    this.type = type;
    this.nébuleuse = nébuleuse;
    this.dépendances = dépendances;

    this.estDémarré = false;
    this.événements = new TypedEmitter<ÉvénementsServiceNébuleuse>();
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
}

type ClasseServiceNébuleuse<
  S extends ServiceNébuleuse = ServiceNébuleuse,
  D extends ServicesDéfautNébuleuse = ServicesDéfautNébuleuse,
> = new (args: { nébuleuse: Nébuleuse<D> }) => S;
export type ServicesNébuleuse = { [clef: string]: ClasseServiceNébuleuse };
export type InstancesServicesNébuleuse<T extends ServicesNébuleuse> = {
  [clef in keyof T]: InstanceType<T[clef]>;
};

class Profil extends ServiceNébuleuse<"profil"> {
  constructor({
    nébuleuse,
  }: {
    nébuleuse: Nébuleuse<ServicesDéfautNébuleuse>;
  }) {
    super({ type: "profil", nébuleuse, dépendances: ["réseau"] });
  }
}

class Réseau extends ServiceNébuleuse<"réseau"> {
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

export class Nébuleuse<S extends ServicesDéfautNébuleuse> {
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

    const prêtsÀDémarrer = servicesÀDémarrer.filter(s=>s.dépendances.every(d=>this.services[d].démarré));
    if (!prêtsÀDémarrer.length) throw new Error(`Dépendances récursives ou non-existantes parmi ${prêtsÀDémarrer.join(", ")}`)
    
    await Promise.all(prêtsÀDémarrer.map(s=>s.démarrer()));
    
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

    const prêtsÀFermer = servicesÀFermer.filter(s=>!servicesÀFermer.some(d=>!d.dépendances.includes(s.type)));
    if (!prêtsÀFermer.length) throw new Error(`Dépendances récursives ou non-existantes parmi ${prêtsÀFermer.join(", ")}`)
    
    await Promise.all(prêtsÀFermer.map(s=>s.fermer()));
    
    await this.fermerServices();
  }
}

export class Constellation<
  S extends ServicesConstellation,
> extends Nébuleuse<S> {
  bds: Bds;
  profil: Profil;

  constructor({ services }: { services?: S }) {
    services = services ?? (obtServicesConstellation() as S);
    super({ services });

    this.bds = this.services["bds"];
    this.profil = this.services["profil"];
  }
}
