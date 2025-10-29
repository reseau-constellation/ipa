import { NestedValueObject } from "@orbitdb/nested-db";
import { Variables } from "./variables.js";
import { MotsClefs } from "./motsClefs.js";
import { Crabe, ServicesCrabe, StructureCrabe } from "./crabe/crabe.js";
import { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import { Bds } from "./bds.js";
import { Tableaux } from "./tableaux.js";
import { ConstructeursServicesNébuleuse } from "./nébuleuse/nébuleuse.js";
import {
  SchémaCompte,
  ServicesDonnées,
} from "./crabe/services/compte/compte.js";
import { Favoris } from "./favoris.js";
import { Épingles } from "./epingles.js";
import { Automatisations } from "./automatisations/automatisations.js";

export type OptionsConstellation = {
  dossier?: string;
  sujetRéseau?: string;
  protocoles?: string[];
};

export type ServicesSpécifiquesConstellation<L extends ServicesLibp2pCrabe> = {
  motsClefs: MotsClefs<L>;
  bds: Bds<L>;
  tableaux: Tableaux<L>;
  favoris: Favoris;
  épingles: Épingles;
  variables: Variables<L>;
  automatisations: Automatisations<L>;
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
  tableaux: Tableaux<L>;
  motsClefs: MotsClefs<L>;
  favoris: Favoris;
  épingles: Épingles;
  variables: Variables<L>;
  automatisations: Automatisations<L>;

  constructor(
    options: OptionsConstellation,
    services?: ConstructeursServicesNébuleuse<ServicesDonnées<T, L>>,
  ) {
    services =
      services ?? ({} as ConstructeursServicesNébuleuse<ServicesDonnées<T, L>>);
    super({
      services: {
        bds: Bds,
        tableaux: Tableaux,
        motsClefs: MotsClefs,
        favoris: Favoris,
        épingles: Épingles,
        variables: Variables,
        ...(services || {}),
      } as ConstructeursServicesNébuleuse<
        S & ServicesSpécifiquesConstellation<L>
      >,
      options: {
        dossier: options.dossier,
      },
    });

    // Pour garder l'IPA d'avant que j'aime bien...
    this.motsClefs = this.services["motsClefs"];
    this.bds = this.services["bds"];
    this.tableaux = this.services["tableaux"];
    this.favoris = this.services["favoris"];
    this.épingles = this.services["épingles"];
    this.variables = this.services["variables"];

    this.automatisations = this.services["automatisations"];
  }
}
