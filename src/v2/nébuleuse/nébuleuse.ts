import { join } from "path";
import { isElectronMain, isNode } from "wherearewe";
import { ERREUR_INIT_IPA_DÉJÀ_LANCÉ } from "@constl/mandataire";
import { Appli } from "@/v2/nébuleuse/appli/appli.js";
import {
  ServiceCompte,
  ServiceHélia,
  ServiceLibp2p,
  ServiceOrbite,
  ServiceStockage,
} from "./services/index.js";
import { ServiceDispositifs } from "./services/dispositifs.js";
import { Profil } from "./services/profil.js";
import { ServiceRéseau } from "./services/réseau.js";
import { ServiceJournal } from "./services/journal.js";
import type { Jsonifiable } from "./types.js";
import type { ServiceÉpingles } from "./services/epingles.js";
import type { NestedValueObject } from "@orbitdb/nested-db";
import type {
  ConstructeursServicesAppli,
  OptionsAppli,
  ServicesAppli,
} from "@/v2/nébuleuse/appli/appli.js";
import type { StructureDispositifs } from "./services/dispositifs.js";
import type { ServicesLibp2pNébuleuse } from "./services/libp2p/libp2p.js";
import type { StructureProfil } from "./services/profil.js";
import type { StructureRéseau } from "./services/réseau.js";
import type {
  ServicesDonnées,
  ServicesNécessairesCompte,
} from "./services/compte/compte.js";
import type { ServiceFavoris } from "./services/favoris.js";

export type StructureNébuleuse = {
  dispositifs: StructureDispositifs;
  profil: StructureProfil;
  réseau: StructureRéseau;
};

export type ServicesNébuleuse<
  T extends StructureNébuleuse = StructureNébuleuse,
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> = Omit<ServicesNécessairesCompte<L>, "compte"> & {
  compte: ServiceCompte<T, L>;
  dispositifs: ServiceDispositifs<L>;
  profil: Profil<L>;
  réseau: ServiceRéseau<L>;
  épingles: ServiceÉpingles<L>;
  favoris: ServiceFavoris<L>;
};

export const validerOptionsServicesNébuleuse = <
  T extends StructureNébuleuse,
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
>(
  options: OptionsAppli<ServicesNébuleuse<T, L>>,
) => {
  const { orbite } = options.services?.orbite || {};
  let { hélia } = options.services?.hélia || {};
  let { libp2p } = options.services?.libp2p || {};

  const ERREUR_DUPLIQUÉS =
    "Un seul d'`orbite`, `hélia` ou `libp2p` peut être spécifié dans les options.";
  if (orbite) {
    if (hélia) throw new Error(ERREUR_DUPLIQUÉS);
    hélia = orbite.ipfs;
  }
  if (hélia) {
    if (libp2p) throw new Error(ERREUR_DUPLIQUÉS);
    libp2p = hélia.libp2p;
  }
};

export const FICHIER_VERROU = "VERROU";
export const INTERVALE_VERROU = 5000; // 5 millisecondes

export class Nébuleuse<
  T extends { [clef: string]: NestedValueObject } = Record<string, never>,
  S extends ServicesAppli = ServicesAppli,
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> extends Appli<ServicesNébuleuse<StructureNébuleuse & T, L> & S> {
  orbite: ServiceOrbite<L>;
  profil: Profil<L>;
  compte: ServiceCompte<StructureNébuleuse & T, L>;
  réseau: ServiceRéseau<L>;
  favoris: ServiceFavoris<L>;

  oublierVerrou?: () => void;

  constructor({
    services,
    options,
  }: {
    services?: ConstructeursServicesAppli<
      S & ServicesDonnées<T, L>,
      ServicesNébuleuse<StructureNébuleuse & T, L>
    >;
    options?: OptionsAppli<S & ServicesNébuleuse<StructureNébuleuse & T, L>>;
  } = {}) {
    services =
      services ?? ({} as ConstructeursServicesAppli<S & ServicesDonnées<T, L>>);
    options = options ?? {};
    validerOptionsServicesNébuleuse(options);

    super({
      services: {
        journal: ServiceJournal,
        stockage: ServiceStockage,
        libp2p: ServiceLibp2p,
        hélia: ServiceHélia,
        orbite: ServiceOrbite,
        compte: ServiceCompte<T, L>,
        dispositifs: ServiceDispositifs,
        profil: Profil,
        réseau: ServiceRéseau,
        ...services,
      } as ConstructeursServicesAppli<
        S & ServicesNébuleuse<StructureNébuleuse & T, L>
      >,
      options,
    });

    this.orbite = this.services["orbite"];

    this.compte = this.services["compte"];

    this.réseau = this.services["réseau"];
    this.profil = this.services["profil"];
    this.favoris = this.services["favoris"];
  }

  async démarrer(): Promise<void> {
    this.oublierVerrou = await this.verrouillerDossier();
    return await super.démarrer();
  }

  async fermer(): Promise<void> {
    await super.fermer();
    await this.déverrouillerDossier();
  }

  // Fichier verrou

  async verrouillerDossier(): Promise<() => void> {
    if (isElectronMain || isNode) {
      const fs = await import("fs");
      const dossier = await this.dossier();
      const fichierVerrou = join(dossier, FICHIER_VERROU);

      if (!fs.existsSync(fichierVerrou)) {
        fs.writeFileSync(fichierVerrou, "");
      } else {
        const infoFichier = fs.statSync(fichierVerrou);
        const modifiéÀ = infoFichier.mtime;
        const verifierSiVieux = () => {
          const maintenant = new Date();

          if (maintenant.getTime() - modifiéÀ.getTime() > INTERVALE_VERROU) {
            fs.writeFileSync(fichierVerrou, "");
          } else {
            const contenuFichier = new TextDecoder().decode(
              fs.readFileSync(fichierVerrou),
            );
            const erreur = new Error(
              `Le compte sur ${dossier} est déjà ouvert par un autre processus.\n${contenuFichier}`,
            );
            erreur.name = ERREUR_INIT_IPA_DÉJÀ_LANCÉ;
            throw erreur;
          }
        };
        try {
          verifierSiVieux();
        } catch {
          await new Promise((résoudre) =>
            setTimeout(résoudre, INTERVALE_VERROU),
          );
          verifierSiVieux();
        }
      }
      const intervale = setInterval(() => {
        const maintenant = new Date();
        fs.utimesSync(fichierVerrou, maintenant, maintenant);
      }, INTERVALE_VERROU);
      return () => clearInterval(intervale);
    } else {
      return () => {};
    }
  }

  async spécifierMessageVerrou({
    message,
  }: {
    message: Jsonifiable;
  }): Promise<void> {
    if (isElectronMain || isNode) {
      const dossier = await this.dossier();
      const fs = await import("fs");
      const fichierVerrou = join(dossier, FICHIER_VERROU);
      fs.writeFileSync(fichierVerrou, JSON.stringify(message));
    }
  }

  async déverrouillerDossier(): Promise<void> {
    if (isElectronMain || isNode) {
      if (this.oublierVerrou) this.oublierVerrou();
      const fs = await import("fs");
      fs.rmSync(join(await this.dossier(), FICHIER_VERROU));
    }
  }

  // Effacer compte local

  async effacer(): Promise<void> {
    const dossier = await this.dossier();

    await this.fermer();

    if (indexedDB) {
      if (indexedDB.databases) {
        const indexedDbDatabases = await indexedDB.databases();
        await Promise.allSettled(
          indexedDbDatabases.map((bd) => {
            if (bd.name) indexedDB.deleteDatabase(bd.name);
          }),
        );
      } else {
        console.warn("On a pas pu tout effacer.");
      }
    } else {
      const fs = await import("fs");
      fs.rmdirSync(dossier);
    }
  }
}
