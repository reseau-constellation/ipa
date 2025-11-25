import { Nébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
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
import type { NestedValueObject } from "@orbitdb/nested-db";
import type {
  ConstructeursServicesNébuleuse,
  OptionsNébuleuse,
  ServicesNébuleuse,
} from "@/v2/nébuleuse/nébuleuse.js";
import type { StructureDispositifs } from "./services/dispositifs.js";
import type { ServicesLibp2pCrabe } from "./services/libp2p/libp2p.js";
import type { StructureProfil } from "./services/profil.js";
import type { StructureRéseau } from "./services/réseau.js";
import type {
  ServicesDonnées,
  ServicesNécessairesCompte,
} from "./services/compte/compte.js";

export type StructureCrabe = {
  dispositifs: StructureDispositifs;
  profil: StructureProfil;
  réseau: StructureRéseau;
};

export type ServicesCrabe<
  T extends StructureCrabe = StructureCrabe,
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> = Omit<ServicesNécessairesCompte<L>, "compte"> & {
  compte: ServiceCompte<T, L>;
  dispositifs: ServiceDispositifs<L>;
  profil: Profil<L>;
  réseau: ServiceRéseau<L>;
};

export const validerOptionsServicesCrabe = <
  T extends StructureCrabe,
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
>(
  options: OptionsNébuleuse<ServicesCrabe<T, L>>,
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

export class Crabe<
  T extends { [clef: string]: NestedValueObject } = Record<string, never>,
  S extends ServicesNébuleuse = ServicesNébuleuse,
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> extends Nébuleuse<ServicesCrabe<StructureCrabe & T, L> & S> {
  orbite: ServiceOrbite<L>;
  profil: Profil<L>;
  compte: ServiceCompte<StructureCrabe & T, L>;
  réseau: ServiceRéseau<L>;

  constructor({
    services,
    options,
  }: {
    services?: ConstructeursServicesNébuleuse<
      S & ServicesDonnées<T, L>,
      ServicesCrabe<StructureCrabe & T, L>
    >;
    options?: OptionsNébuleuse<S & ServicesCrabe<StructureCrabe & T, L>>;
  } = {}) {
    services =
      services ??
      ({} as ConstructeursServicesNébuleuse<S & ServicesDonnées<T, L>>);
    options = options ?? {};
    validerOptionsServicesCrabe(options);

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
      } as ConstructeursServicesNébuleuse<
        S & ServicesCrabe<StructureCrabe & T, L>
      >,
      options,
    });

    this.orbite = this.services["orbite"];

    this.compte = this.services["compte"];

    this.réseau = this.services["réseau"];
    this.profil = this.services["profil"];
  }
}
