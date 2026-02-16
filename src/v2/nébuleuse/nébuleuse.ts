import { merge } from "ts-deepmerge";
import { Appli } from "@/v2/nébuleuse/appli/appli.js";
import { serviceJournal } from "./services/journal.js";
import { serviceDossier } from "./services/dossier.js";
import {
  serviceLibp2p,
  type OptionsServiceLibp2p,
  type ServicesLibp2pNébuleuse,
} from "./services/libp2p/libp2p.js";
import { serviceHélia } from "./services/hélia.js";
import { serviceStockage } from "./services/stockage.js";
import {
  serviceOrbite,
  type OptionsServiceOrbite,
} from "./services/orbite/orbite.js";
import {
  type OptionsServiceCompte,
  serviceCompte,
  type ServicesNécessairesCompte,
} from "./services/compte/compte.js";
import {
  schémaDispositifs,
  serviceDispositifs,
  type ServiceDispositifs,
  type StructureDispositifs,
} from "./services/dispositifs.js";
import {
  schémaProfil,
  type Profil,
  type StructureProfil,
} from "./services/profil.js";
import {
  schémaRéseau,
  serviceRéseau,
  type ServiceRéseau,
  type StructureRéseau,
} from "./services/réseau.js";
import { serviceProfil } from "./services/profil.js";
import type { ServiceOrbite, ServiceCompte } from "./services/index.js";
import type { JSONSchemaType } from "ajv";
import type { OptionsServiceJournal } from "./services/journal.js";

import type { OptionsServiceDossier } from "./services/dossier.js";
import type { ServiceÉpingles } from "./services/épingles.js";
import type { NestedValue } from "@orbitdb/nested-db";
import type {
  ConstructeursServicesAppli,
  OptionsAppli,
  ServicesAppli,
} from "@/v2/nébuleuse/appli/appli.js";
import type { ServiceFavoris } from "./services/favoris.js";
import type { OptionsServiceHélia } from "./services/hélia.js";
import type { PartielRécursif } from "../types.js";

export type StructureNébuleuse = {
  dispositifs: StructureDispositifs;
  profil: StructureProfil;
  réseau: StructureRéseau;
};

export const schémaNébuleuse: JSONSchemaType<
  PartielRécursif<StructureNébuleuse>
> = {
  type: "object",
  properties: {
    dispositifs: schémaDispositifs,
    profil: schémaProfil,
    réseau: schémaRéseau,
  },
};

export type ServicesNébuleuse<
  T extends StructureNébuleuse = StructureNébuleuse,
> = ServicesNécessairesCompte & {
  compte: ServiceCompte<T>;
  dispositifs: ServiceDispositifs;
  profil: Profil;
  réseau: ServiceRéseau;
  épingles: ServiceÉpingles;
  favoris: ServiceFavoris;
};

export const extraireHéliaEtLibp2p = <
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
>(options: {
  orbite?: OptionsServiceOrbite<L>;
  hélia?: OptionsServiceHélia<L>;
  libp2p?: OptionsServiceLibp2p<L>;
}) => {
  const { orbite } = options?.orbite || {};
  let { hélia } = options?.hélia || {};
  let { libp2p } = options?.libp2p || {};

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

  return { hélia, libp2p };
};

export type OptionsNébuleuse<
  T extends { [clef: string]: NestedValue },
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> = {
  options?: OptionsAppli;
  services?: {
    journal?: OptionsServiceJournal;
    dossier?: OptionsServiceDossier;
    libp2p?: OptionsServiceLibp2p<L>;
    hélia?: OptionsServiceHélia<L>;
    orbite?: OptionsServiceOrbite<L>;
    compte?: OptionsServiceCompte<T>;
  };
};

export class Nébuleuse<
  T extends { [clef: string]: NestedValue } = Record<string, never>,
  S extends ServicesAppli = Record<string, never>,
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> extends Appli<ServicesNébuleuse<StructureNébuleuse & T> & S> {
  orbite: ServiceOrbite;
  profil: Profil;
  compte: ServiceCompte<StructureNébuleuse & T>;
  réseau: ServiceRéseau;
  favoris: ServiceFavoris;

  constructor({
    services,
    options,
  }: {
    services?: ConstructeursServicesAppli<
      S & Partial<ServicesNébuleuse<StructureNébuleuse>>
    >;
    options?: OptionsNébuleuse<T, L>;
  }) {
    options = options || {};
    services = services ?? ({} as ConstructeursServicesAppli<S>);
    const { hélia, libp2p } = extraireHéliaEtLibp2p(options?.services || {});

    if (!options.services) options.services = {};
    if (libp2p) options.services.libp2p = { libp2p };
    if (hélia) options.services.hélia = { hélia };

    const optionsCompte: OptionsServiceCompte<StructureNébuleuse & T> = {
      ...options?.services.compte,
      schéma: merge(options?.services?.compte?.schéma || {}, schémaNébuleuse),
    };

    super({
      services: {
        dossier: serviceDossier(options?.services.dossier),
        journal: serviceJournal(options?.services.journal),
        stockage: serviceStockage(),
        libp2p: serviceLibp2p(options?.services.libp2p),
        hélia: serviceHélia(options?.services.hélia),
        orbite: serviceOrbite(options?.services.orbite),
        compte: serviceCompte<StructureNébuleuse & T>(optionsCompte),
        dispositifs: serviceDispositifs(),
        profil: serviceProfil(),
        réseau: serviceRéseau(),
        ...services,
      } as ConstructeursServicesAppli<
        ServicesNébuleuse<StructureNébuleuse & T> & S
      >,
      options: options.options,
    });

    this.orbite = this.services["orbite"];

    this.compte = this.services["compte"];

    this.réseau = this.services["réseau"];
    this.profil = this.services["profil"];
    this.favoris = this.services["favoris"];
  }

  // Effacer compte local

  async effacer(): Promise<void> {
    const dossier = await this.services["dossier"].dossier();

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
        const journal = this.services["journal"];
        journal.écrire("On a pas pu effacer le compte local.");
      }
    } else {
      const fs = await import("fs");
      fs.rmdirSync(dossier);
    }
  }
}
