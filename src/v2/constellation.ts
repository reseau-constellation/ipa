import { Variables } from "./variables.js";
import { MotsClefs } from "./motsClefs.js";
import { Nébuleuse } from "./nébuleuse/nébuleuse.js";
import { Bds } from "./bds/bds.js";
import { ServiceFavoris } from "./nébuleuse/services/favoris.js";
import { ServiceÉpingles } from "./nébuleuse/services/épingles.js";
import { Nuées } from "./nuées/nuées.js";
import type { Projets } from "./projets.js";
import type {
  ConstructeursServicesAppli,
  OptionsAppli,
} from "./nébuleuse/appli/appli.js";
import type {
  SchémaCompte,
  ServicesDonnées,
} from "./nébuleuse/services/compte/compte.js";
import type { Automatisations } from "./automatisations/automatisations.js";
import type { ServicesLibp2pNébuleuse } from "./nébuleuse/services/libp2p/libp2p.js";
import type {
  ServicesNébuleuse,
  StructureNébuleuse,
} from "./nébuleuse/nébuleuse.js";
import type { NestedValue } from "@orbitdb/nested-db";

export type OptionsConstellation<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> = {
  sujetRéseau?: string;
  protocoles?: string[];
} & Partial<OptionsAppli<ServicesConstellation<L>>>;

export type ServicesSpécifiquesConstellation<
  L extends ServicesLibp2pNébuleuse,
> = {
  motsClefs: MotsClefs<L>;
  bds: Bds<L>;
  favoris: ServiceFavoris<L>;
  épingles: ServiceÉpingles<L>;
  variables: Variables<L>;
  nuées: Nuées<L>;
  automatisations: Automatisations<L>;
  projets: Projets<L>;
};

export type StructureConstellation<L extends ServicesLibp2pNébuleuse> =
  StructureNébuleuse & SchémaCompte<ServicesSpécifiquesConstellation<L>>;

export type ServicesConstellation<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> = ServicesSpécifiquesConstellation<L> &
  ServicesNébuleuse<StructureConstellation<L>, L>;

export class Constellation<
  T extends { [clef: string]: NestedValue } = Record<string, never>,
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
  S extends ServicesDonnées<T, L> = ServicesDonnées<T, L>,
> extends Nébuleuse<T, S & ServicesSpécifiquesConstellation<L>, L> {
  bds: Bds<L>;
  motsClefs: MotsClefs<L>;
  nuées: Nuées<L>;
  favoris: ServiceFavoris<L>;
  épingles: ServiceÉpingles<L>;
  variables: Variables<L>;
  automatisations: Automatisations<L>;
  projets: Projets<L>;

  constructor(
    options: OptionsConstellation,
    services?: ConstructeursServicesAppli<ServicesDonnées<T, L>>,
  ) {
    services =
      services ?? ({} as ConstructeursServicesAppli<ServicesDonnées<T, L>>);
    super({
      services: {
        bds: Bds<L>,
        motsClefs: MotsClefs<L>,
        favoris: ServiceFavoris<L>,
        épingles: ServiceÉpingles<L>,
        variables: Variables<L>,
        nuées: Nuées<L>,
        ...(services || {}),
      } as ConstructeursServicesAppli<S & ServicesSpécifiquesConstellation<L>>,
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
