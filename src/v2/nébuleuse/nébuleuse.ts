import { join } from "path";
import { TypedEmitter } from "tiny-typed-emitter";
import { isElectronMain, isNode } from "wherearewe";
import { STATUTS } from "./consts.js";

type ÉvénementsNébuleuse = {
  démarrée: () => void;
  fermée: () => void;
};
export type ConstructeurServiceNébuleuse<
  T,
  S extends ServicesNébuleuse,
> = new (args: {
  nébuleuse: Nébuleuse<S>;
  options?: T extends ServiceNébuleuse<
    infer _Types,
    infer _Services,
    infer _R,
    infer Opts
  >
    ? Opts
    : never;
}) => T;

export type ServicesNébuleuse<
  A extends ServicesNébuleuse = {
    [clef: string]: ServiceNébuleuse<typeof clef>;
  },
> = {
  [clef: string]: ServiceNébuleuse<typeof clef, A>;
};

export type ConstructeursServicesNébuleuse<
  T extends ServicesNébuleuse,
  A extends ServicesNébuleuse = {
    [clef: string]: ServiceNébuleuse<typeof clef>;
  },
> = {
  [clef in keyof T]: ConstructeurServiceNébuleuse<T[clef], T & A>;
};

export type OptionsNébuleuse<T extends ServicesNébuleuse> = {
  dossier?: string;
  nomAppli?: string;
  mode?: "dév" | "prod";
  services?: {
    [clef in keyof T]?: T[clef] extends ServiceNébuleuse<
      infer _Type,
      infer _Services,
      infer _R,
      infer Opts
    >
      ? Opts | undefined
      : never;
  };
};

export class Nébuleuse<S extends ServicesNébuleuse = ServicesNébuleuse> {
  statut: typeof STATUTS[keyof typeof STATUTS];
  options: OptionsNébuleuse<S>;
  services: S;
  événements: TypedEmitter<ÉvénementsNébuleuse>;
  nomAppli: string;

  constructor({
    services,
    options,
  }: {
    nomAppli?: string;
    services?: ConstructeursServicesNébuleuse<S>;
    options?: OptionsNébuleuse<S>;
  } = {}) {
    this.nomAppli = options?.nomAppli ?? "nébuleuse";
    services = services ?? ({} as ConstructeursServicesNébuleuse<S>);

    this.options = options || {};
    this.services = Object.fromEntries(
      Object.entries(services).map(([clef, service]) => [
        clef,
        new service({ nébuleuse: this, options: options?.services?.[clef] }),
      ]),
    ) as S;

    this.événements = new TypedEmitter<ÉvénementsNébuleuse>();
    this.statut = STATUTS.NON_INITIALISÉE;
  }

  // Cycle de vie

  get estDémarrée(): boolean {
    return this.statut === STATUTS.DÉMARRÉE
  }

  async démarrée(): Promise<void> {
    if (this.estDémarrée) return;
    return new Promise((résoudre) =>
      this.événements.once("démarrée", résoudre),
    );
  }

  async démarrer() {
    if (this.estDémarrée) return;
    if (this.statut === STATUTS.DÉMARRAGE_EN_COURS) {
      return new Promise<void>((résoudre) =>
        this.événements.once("démarrée", résoudre),
      );
    }
    this.statut = STATUTS.DÉMARRAGE_EN_COURS;

    await this.démarrerServices();

    this.statut = STATUTS.DÉMARRÉE;
    this.événements.emit("démarrée");
  }

  async démarrerServices() {
    const servicesÀDémarrer = Object.values(this.services).filter(
      (s) => !s.estDémarré,
    );
    if (!servicesÀDémarrer.length) return;

    const prêtsÀDémarrer = servicesÀDémarrer.filter((s) =>
      s.dépendances.every((d) => this.services[d].estDémarré),
    );

    if (!prêtsÀDémarrer.length)
      throw new Error(
        `Dépendances circulaires ou non-existantes parmi ${servicesÀDémarrer.map((s) => s.clef).join(", ")}.`,
      );

    await Promise.all(prêtsÀDémarrer.map((s) => s.démarrer()));

    await this.démarrerServices();
  }

  async fermer() {
    if (this.statut === STATUTS.FERMÉE) return;
    if (this.statut === STATUTS.FERMETURE_EN_COURS) {
      return new Promise<void>((résoudre) =>
        this.événements.once("fermée", résoudre),
      );
    }

    await this.démarrée(); // S'assure que tout (y compris les services) sont bien initialisés

    this.statut = STATUTS.FERMETURE_EN_COURS;
    await this.fermerServices();
    
    this.statut = STATUTS.FERMÉE;
  }

  async fermerServices() {
    // Cette fonction suppose que nous sommes sûrs qu'aucun service est en cours de démarrage
    // À faire : gérer condition si service est en cours de démarrage
    const servicesÀFermer = Object.values(this.services).filter(
      (s) => s.estDémarré,
    );

    if (!servicesÀFermer.length) return;

    const prêtsÀFermer = servicesÀFermer.filter(
      (s) => !servicesÀFermer.some((d) => d.dépendances.includes(s.clef)),
    );

    if (!prêtsÀFermer.length)
      throw new Error(
        `Dépendances circulaires parmi ${servicesÀFermer.map((s) => s.clef).join(", ")}.`,
      );

    await Promise.all(prêtsÀFermer.map((s) => s.fermer()));

    await this.fermerServices();
  }

  // Fonctions utilitaires
  async dossier(): Promise<string> {
    if (this.options.dossier) {
      if (isNode || isElectronMain) {
        const fs = await import("fs");
        if (!fs.existsSync(this.options.dossier))
          fs.mkdirSync(this.options.dossier, { recursive: true });
      }
      return this.options.dossier;
    }

    if (isNode || isElectronMain) {
      const fs = await import("fs");
      // Utiliser l'application native
      const envPaths = (await import("env-paths")).default;
      const chemins = envPaths(this.nomAppli, { suffix: "" });
      const dossier = join(
        chemins.data,
        this.options.mode === "dév" ? `${this.nomAppli}-dév` : this.nomAppli,
      );
      if (!fs.existsSync(dossier)) fs.mkdirSync(dossier, { recursive: true });
      return dossier;
    } else {
      // Pour navigateur
      return `./${this.nomAppli}`;
    }
  }
}

type ÉvénementsServiceNébuleuse<Démarré = true> = {
  démarré: (args: Démarré) => void;
};

export class ServiceNébuleuse<
  T extends string,
  S extends ServicesNébuleuse = ServicesNébuleuse,
  RetourDémarré = unknown,
  Options = unknown,
> {
  clef: T;
  nébuleuse: Nébuleuse<S>;
  dépendances: Extract<keyof S, string>[];
  options: Options;

  événements: TypedEmitter<ÉvénementsServiceNébuleuse<RetourDémarré>>;
  estDémarré: RetourDémarré | false;

  constructor({
    clef,
    nébuleuse,
    dépendances = [],
    options,
  }: {
    clef: T;
    nébuleuse: Nébuleuse<S>;
    dépendances?: Extract<keyof S, string>[];
    options?: Options;
  }) {
    this.clef = clef;
    this.nébuleuse = nébuleuse;
    this.dépendances = dépendances;
    this.options = options || ({} as Options);

    this.événements = new TypedEmitter<
      ÉvénementsServiceNébuleuse<RetourDémarré>
    >();
    this.estDémarré = false;
  }

  // Cycle de vie
  async démarrer(): Promise<RetourDémarré> {
    const dépendancesNonDémarrées = this.dépendances
      .map((d) => this.service(d))
      .filter((d) => !d.estDémarré)
      .map((d) => d.clef);
    if (dépendancesNonDémarrées.length)
      throw new Error(
        `Dépendances de ${this.clef} non démarrées: ${dépendancesNonDémarrées.join(", ")}`,
      );
    if (this.estDémarré === false) this.estDémarré = true as RetourDémarré;

    this.événements.emit("démarré", this.estDémarré);
    return this.estDémarré;
  }

  async démarré(): Promise<RetourDémarré> {
    if (this.estDémarré) return this.estDémarré;
    return new Promise((résoudre) => this.événements.once("démarré", résoudre));
  }

  async fermer(): Promise<void> {
    await this.démarré();
    this.estDémarré = false;
  }

  // Méthodes générales
  service<C extends Extract<keyof S, string>>(clef: C): S[C] {
    if (!this.dépendances.includes(clef))
      throw new Error(
        `${String(clef)} n'est pas spécifié parmi les dépendences de ${this.clef}.`,
      );
    return this.nébuleuse.services[clef];
  }
}
