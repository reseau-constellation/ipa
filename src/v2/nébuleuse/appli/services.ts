import { TypedEmitter } from "tiny-typed-emitter";
import { STATUTS } from "./consts.js";
import type { OptionsCommunes, ServicesAppli } from "./appli.js";

type ÉvénementsServiceAppli<Démarré = true> = {
  démarré: (args: Démarré) => void;
};

export class ServiceAppli<
  S extends ServicesAppli = ServicesAppli,
  RetourDémarré = unknown,
  Options = unknown,
> {
  clef: string;
  services: S;
  dépendances: Extract<keyof S, string>[];
  options: Options & OptionsCommunes;

  événements: TypedEmitter<ÉvénementsServiceAppli<RetourDémarré>>;
  statut: (typeof STATUTS)[keyof typeof STATUTS];
  estDémarré: RetourDémarré | false;

  constructor({
    clef,
    services,
    dépendances = [],
    options,
  }: {
    clef: string;
    services: S;
    dépendances?: Extract<keyof S, string>[];
    options: Options & OptionsCommunes;
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
  service<C extends Extract<keyof S, string>>(clef: C): S[C] {
    if (!this.dépendances.includes(clef))
      throw new Error(
        `${String(clef)} n'est pas spécifié parmi les dépendences de ${this.clef}.`,
      );
    return this.services[clef];
  }
}
