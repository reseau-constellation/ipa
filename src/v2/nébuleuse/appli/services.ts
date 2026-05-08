import { TypedEmitter } from "tiny-typed-emitter";
import { STATUTS } from "./consts.js";
import type { OptionsAppli, ServicesAppli } from "./appli.js";

type ÉvénementsServiceAppli<Démarré = true> = {
  démarré: (args: Démarré) => void;
};

export abstract class ServiceAppli<
  T extends string = string,
  S extends ServicesAppli = ServicesAppli,
  RetourDémarré = unknown,
  Options = unknown,
> {
  clef: T;
  services: S;
  dépendances: (keyof S)[];
  options: Options & OptionsAppli;

  événements: TypedEmitter<ÉvénementsServiceAppli<RetourDémarré>>;
  statut: (typeof STATUTS)[keyof typeof STATUTS];
  estDémarré: RetourDémarré | false;

  constructor({
    clef,
    services,
    dépendances = [],
    options,
  }: {
    clef: T;
    services: S;
    dépendances?: (keyof S)[];
    options: Options & OptionsAppli;
  }) {
    this.clef = clef;
    this.dépendances = dépendances;
    this.services = services;
    this.options = options;

    this.événements = new TypedEmitter<ÉvénementsServiceAppli<RetourDémarré>>();
    this.statut = STATUTS.NON_INITIALISÉE;
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
    this.statut = STATUTS.DÉMARRÉE;
    return this.estDémarré;
  }

  async démarré(): Promise<RetourDémarré> {
    if (this.estDémarré) return this.estDémarré;
    return new Promise((résoudre) => this.événements.once("démarré", résoudre));
  }

  async fermer(): Promise<void> {
    await this.démarré();
    this.statut = STATUTS.FERMÉE;
    this.estDémarré = false;
  }

  // Méthodes générales
  service<C extends keyof S>(clef: C): S[C] {
    if (!this.dépendances.includes(clef))
      throw new Error(
        `${String(clef)} n'est pas spécifié parmi les dépendences de ${this.clef}.`,
      );
    return this.services[clef];
  }
}
