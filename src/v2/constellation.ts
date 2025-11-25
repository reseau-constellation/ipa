import { Variables } from "./variables.js";
import { MotsClefs } from "./motsClefs.js";
import { Crabe } from "./crabe/crabe.js";
import { Bds } from "./bds/bds.js";
import { Favoris } from "./favoris.js";
import { Épingles } from "./epingles.js";
import { Nuées } from "./nuées.js";
import type { Projets } from "./projets.js";
import type {
  ConstructeursServicesNébuleuse,
  OptionsNébuleuse,
} from "./nébuleuse/nébuleuse.js";
import type {
  SchémaCompte,
  ServicesDonnées,
} from "./crabe/services/compte/compte.js";
import type { Automatisations } from "./automatisations/automatisations.js";
import type { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import type { ServicesCrabe, StructureCrabe } from "./crabe/crabe.js";
import type { NestedValueObject } from "@orbitdb/nested-db";

export type OptionsConstellation<
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> = {
  sujetRéseau?: string;
  protocoles?: string[];
} & OptionsNébuleuse<ServicesConstellation<L>>;

export type ServicesSpécifiquesConstellation<L extends ServicesLibp2pCrabe> = {
  motsClefs: MotsClefs<L>;
  bds: Bds<L>;
  favoris: Favoris;
  épingles: Épingles;
  variables: Variables<L>;
  nuées: Nuées<L>;
  automatisations: Automatisations<L>;
  projets: Projets<L>;
};

export type StructureConstellation<L extends ServicesLibp2pCrabe> =
  StructureCrabe & SchémaCompte<ServicesSpécifiquesConstellation<L>>;

export type ServicesConstellation<
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> = ServicesSpécifiquesConstellation<L> &
  ServicesCrabe<StructureConstellation<L>, L>;

export class Constellation<
  T extends { [clef: string]: NestedValueObject } = Record<string, never>,
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
  S extends ServicesDonnées<T, L> = ServicesDonnées<T, L>,
> extends Crabe<T, S & ServicesSpécifiquesConstellation<L>, L> {
  bds: Bds<L>;
  motsClefs: MotsClefs<L>;
  nuées: Nuées<L>;
  favoris: Favoris;
  épingles: Épingles;
  variables: Variables<L>;
  automatisations: Automatisations<L>;
  projets: Projets<L>;

  constructor(
    options: OptionsConstellation,
    services?: ConstructeursServicesNébuleuse<ServicesDonnées<T, L>>,
  ) {
    services =
      services ?? ({} as ConstructeursServicesNébuleuse<ServicesDonnées<T, L>>);
    super({
      services: {
        bds: Bds,
        motsClefs: MotsClefs,
        favoris: Favoris,
        épingles: Épingles,
        variables: Variables,
        nuées: Nuées,
        ...(services || {}),
      } as ConstructeursServicesNébuleuse<
        S & ServicesSpécifiquesConstellation<L>
      >,
      options: {
        dossier: options.dossier,
        services: options.services,
      },
    });

    // Pour garder l'IPA d'avant que j'aime bien...
    this.motsClefs = this.services["motsClefs"];
    this.bds = this.services["bds"];
    this.nuées = this.services["nuées"];
    this.favoris = this.services["favoris"];
    this.épingles = this.services["épingles"];
    this.variables = this.services["variables"];
    this.projets = this.services["projets"];

    this.automatisations = this.services["automatisations"];
  }
}
