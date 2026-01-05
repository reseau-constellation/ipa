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
import type { ServiceÉpingles } from "./services/épingles.js";
import type { NestedValue } from "@orbitdb/nested-db";
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
> = ServicesNécessairesCompte<L> & {
  compte: ServiceCompte<T, L>;
  dispositifs: ServiceDispositifs<L>;
  profil: Profil<L>;
  réseau: ServiceRéseau<L>;
  épingles: ServiceÉpingles<L>;
  favoris: ServiceFavoris<L>;
};

export const extraireHéliaEtLibp2p = <
  T extends StructureNébuleuse,
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
>(
  options: OptionsAppli<ServicesNébuleuse<T, L>>["services"],
) => {
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

export class Nébuleuse<
  T extends { [clef: string]: NestedValue } = Record<string, never>,
  S extends ServicesAppli = Record<string, never>,
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> extends Appli<ServicesNébuleuse<StructureNébuleuse & T, L> & S> {
  orbite: ServiceOrbite<L>;
  profil: Profil<L>;
  compte: ServiceCompte<StructureNébuleuse & T, L>;
  réseau: ServiceRéseau<L>;
  favoris: ServiceFavoris<L>;

  constructor({
    services,
    options,
  }: {
    services?: ConstructeursServicesAppli<
      S &
        ServicesDonnées<T, L> &
        Partial<ServicesNébuleuse<StructureNébuleuse & T, L>>
    >;
    options?: Partial<
      OptionsAppli<S & ServicesNébuleuse<StructureNébuleuse & T, L>>
    >;
  } = {}) {
    services =
      services ?? ({} as ConstructeursServicesAppli<S & ServicesDonnées<T, L>>);
    options = options ?? {};
    const optionsNébuleuse = options as OptionsAppli<
      ServicesNébuleuse<StructureNébuleuse & T, L>
    >;

    const { hélia, libp2p } = extraireHéliaEtLibp2p(optionsNébuleuse.services);
    if (!optionsNébuleuse.services) optionsNébuleuse.services = {};

    if (libp2p) optionsNébuleuse.services.libp2p = { libp2p };
    if (hélia) {
      optionsNébuleuse.services.hélia = { hélia };
    }
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
        console.warn("On a pas pu tout effacer.");
      }
    } else {
      const fs = await import("fs");
      fs.rmdirSync(dossier);
    }
  }
}
