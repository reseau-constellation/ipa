import { merge } from "ts-deepmerge";
import { Variables } from "./variables.js";
import { MotsClefs } from "./motsClefs.js";
import { Nébuleuse } from "./nébuleuse/nébuleuse.js";
import { Bds } from "./bds/bds.js";
import { Nuées } from "./nuées/nuées.js";
import { Licences } from "./licences.js";
import { Projets } from "./projets.js";
import { Automatisations } from "./automatisations/automatisations.js";
import { schémaServiceObjet, type StructureServiceObjet } from "./objets.js";
import { schémaServiceAutomatisations } from "./automatisations/types.js";
import type { ServiceÉpingles } from "./nébuleuse/services/épingles.js";
import type { ServiceFavoris } from "./nébuleuse/services/favoris.js";
import type { ServicesLibp2pNébuleuse } from "./nébuleuse/services/libp2p/libp2p.js";
import type {
  OptionsNébuleuse,
  ServicesNébuleuse,
  StructureNébuleuse,
} from "./nébuleuse/nébuleuse.js";
import type { PartielRécursif } from "./types.js";
import type { StructureServiceAutomatisations } from "./automatisations/types.js";
import type { JSONSchemaType } from "ajv";
import { isWebWorker, isElectronRenderer } from "wherearewe";
import { générerMandataireProcessus } from "./nébuleuse/mandataire/ipaProc.js";

export type OptionsConstellation<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> = {
  sujetRéseau?: string;
  protocoles?: string[];
} & OptionsNébuleuse<StructureConstellation, L>;

export type ServicesSpécifiquesConstellation = {
  motsClefs: MotsClefs;
  bds: Bds;
  variables: Variables;
  nuées: Nuées;
  automatisations: Automatisations;
  projets: Projets;
  licences: Licences;
};

export type StructureConstellation = {
  motsClefs: StructureServiceObjet;
  bds: StructureServiceObjet;
  variables: StructureServiceObjet;
  nuées: StructureServiceObjet;
  projets: StructureServiceObjet;
  automatisations: StructureServiceAutomatisations;
};

export const schémaConstellation: JSONSchemaType<
  PartielRécursif<StructureConstellation>
> = {
  type: "object",
  properties: {
    motsClefs: schémaServiceObjet,
    bds: schémaServiceObjet,
    variables: schémaServiceObjet,
    nuées: schémaServiceObjet,
    projets: schémaServiceObjet,
    automatisations: schémaServiceAutomatisations,
  },
};

export type ServicesConstellation = ServicesSpécifiquesConstellation &
  ServicesNébuleuse<StructureNébuleuse & StructureConstellation>;

export class Constellation<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> extends Nébuleuse<
  StructureConstellation,
  ServicesSpécifiquesConstellation,
  L
> {
  bds: Bds;
  motsClefs: MotsClefs;
  nuées: Nuées;
  favoris: ServiceFavoris;
  épingles: ServiceÉpingles;
  variables: Variables;
  automatisations: Automatisations;
  projets: Projets;
  licences: Licences;

  constructor(options: OptionsConstellation<L>) {
    const défauts = {
      nomAppli: "constellation",
      services: {
        compte: {
          schéma: schémaConstellation,
        },
      },
    };
    options = merge({}, défauts, options);

    super({
      services: {
        motsClefs: ({ services, options }) =>
          new MotsClefs({ services, options }),
        bds: ({ services, options }) => new Bds({ services, options }),
        variables: ({ services, options }) =>
          new Variables({ services, options }),
        nuées: ({ services, options }) => new Nuées({ services, options }),
        projets: ({ services, options }) => new Projets({ services, options }),
        automatisations: ({ services, options }) =>
          new Automatisations({ services, options }),
        licences: ({ options }) => new Licences({ options }),
      },
      options,
    });

    // Pour garder l'IPA d'avant que j'aime bien...
    this.motsClefs = this.services["motsClefs"];
    this.bds = this.services["bds"];
    this.nuées = this.services["nuées"];
    this.favoris = this.services["favoris"];
    this.épingles = this.services["épingles"];
    this.variables = this.services["variables"];
    this.projets = this.services["projets"];
    this.licences = this.services["licences"];

    this.automatisations = this.services["automatisations"];
  }
}

export const créerConstellation = <
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
>(
  opts: OptionsConstellation<L>,
  avecMandataire = true,
): Constellation<L> => {
  opts = Object.assign({}, { nomAppli: "constellation", mode: "prod" }, opts);
  if (!avecMandataire) return new Constellation<L>(opts);
  if (isWebWorker) {
    console.warn(
      "Constellation a été initialisée dans un processus de travailleur, ce qui pourrait mener à des difficultés de connectivité.",
    );
  }

  const mandataire = générerMandataireProcessus<
    StructureConstellation,
    Record<string, never>,
    L
  >(
    async () =>
      new Constellation<L>(opts) as unknown as Nébuleuse<
        StructureConstellation,
        Record<string, never>,
        L
      >,
  );

  if (isElectronRenderer) {
    mandataire.services.journal.écrire({
      message:
        "Constellation a été initialisée par le processus de rendu d'Électron. " +
        "Ce n'est pas un gros gros problème, mais nous vous recommandons d'utiliser " +
        "Constellation dans le processus principal, ce qui est beaucoup plus performant " +
        "et vous permettra également d'accéder à toutes les fonctionnalités de Constellation " +
        "telles les sauvegardes et les importations automatisées. Voir la documentation: " +
        "https://docu.réseau-constellation.ca/avancé/applications/électron.html.",
    });
  }
  return mandataire as unknown as Constellation<L>;
};
