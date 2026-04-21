import { TypedEmitter } from "tiny-typed-emitter";
import { STATUTS } from "./consts.js";
import type { ServiceAppli } from "./services.js";

type ÉvénementsAppli = {
  démarrée: () => void;
  fermée: () => void;
};

export type ConstructeurServiceAppli<T, S extends ServicesAppli> = (args: {
  services: S;
  options: OptionsAppli;
}) => T;

export type ServicesAppli = {
  [clef: string]: ServiceAppli;
};

export type ConstructeursServicesAppli<
  T extends ServicesAppli,
  A extends ServicesAppli = {
    [clef: string]: ServiceAppli;
  },
> = {
  [clef in keyof T]: ConstructeurServiceAppli<T[clef], T & A>;
};

export type OptionsAppli = {
  nomAppli: string;
  mode: "dév" | "prod";
};

export class Appli<S extends ServicesAppli = ServicesAppli> {
  statut: (typeof STATUTS)[keyof typeof STATUTS];
  options: OptionsAppli;
  services: S;
  événements: TypedEmitter<ÉvénementsAppli>;

  constructor({
    services,
    options,
  }: {
    services: ConstructeursServicesAppli<S>;
    nomAppli?: string;
    options?: Partial<OptionsAppli>;
  }) {
    services = services ?? ({} as ConstructeursServicesAppli<S>);

    this.options = { ...{ nomAppli: "appli", mode: "prod" }, ...options };

    const instancesServices: ServicesAppli = {};
    for (const clef of Object.keys(services)) {
      instancesServices[clef] = services[clef]({
        services: instancesServices as S,
        options: this.options,
      });
    }
    this.services = instancesServices as S;

    this.événements = new TypedEmitter<ÉvénementsAppli>();
    this.statut = STATUTS.NON_INITIALISÉE;
  }

  // Cycle de vie

  get estDémarrée(): boolean {
    return this.statut === STATUTS.DÉMARRÉE;
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

    try {
      for (const service of Object.values(this.services)) {
        const manquantes = service.dépendances.filter(
          (d) => this.services[d] === undefined,
        );
        if (manquantes.length) {
          throw new Error(
            `Dépendance(s) ${manquantes.join(", ")} du service ${service.clef} manquante(s).`,
          );
        }
      }

      await this.démarrerServices();
    } catch (e) {
      this.statut = STATUTS.ERREUR_DÉMARRAGE;
      throw e;
    }

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

    const malDémarré = prêtsÀDémarrer.find((s) => !s.estDémarré);
    if (malDémarré)
      throw new Error(`Service ${malDémarré.clef} n'a pas été bien démarré.`);

    await this.démarrerServices();
  }

  async fermer() {
    if (this.statut === STATUTS.FERMÉE) return;
    if (this.statut === STATUTS.ERREUR_DÉMARRAGE)
      throw new Error("Erreur de démarrage");
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

    const malFermé = prêtsÀFermer.find((s) => s.estDémarré);
    if (malFermé)
      throw new Error(`Service ${malFermé.clef} n'a pas été bien fermé.`);

    await this.fermerServices();
  }
}
