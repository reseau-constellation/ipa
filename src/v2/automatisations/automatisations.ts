import PQueue from "p-queue";
import { TypedEmitter } from "tiny-typed-emitter";
import { Ajv } from "ajv";
import deepEqual from "deep-equal";
import { v4 as uuidv4 } from "uuid";
import { ServiceDonnéesAppli } from "../nébuleuse/services/services.js";
import { appelerLorsque } from "../nébuleuse/services/utils.js";
import { schémaSpécificationAutomatisation } from "./types.js";
import { chronomètre, générerFAuto } from "./utils.js";
import type { ServicesNécessairesDonnées } from "../nébuleuse/services/services.js";
import type { ServicesNécessairesCompte } from "../nébuleuse/services/compte/index.js";
import type { OptionsAppli } from "../nébuleuse/appli/appli.js";
import type { Oublier, Suivi } from "../nébuleuse/types.js";
import type { PartielRécursif } from "../types.js";
import type {
  InfoImporterFeuilleCalcul,
  InfoImporterJSON,
  SpécificationAutomatisation,
  SpécificationExporter,
  SpécificationImporter,
  SpécificationAjoutImportation,
  StructureServiceAutomatisations,
  ÉtatAutomatisation,
  SourceDonnéesImportationAdresseOptionel,
  SpécificationAjoutExportation,
} from "./types.js";
import type { Bds } from "../bds/bds.js";
import type { Projets } from "../projets.js";
import type { Nuées } from "../nuées/nuées.js";

const activePourCeDispositif = <T extends SpécificationAutomatisation>(
  spéc: T,
  monIdDispositif: string,
): boolean => {
  switch (spéc.type) {
    case "importation": {
      return spéc.dispositif === monIdDispositif;
    }

    case "exportation": {
      return spéc.dispositifs.includes(monIdDispositif);
    }

    default:
      throw new Error(spéc);
  }
};

export interface AutomatisationActive {
  spécification: SpécificationAutomatisation;
  état: () => ÉtatAutomatisation;
  relancer: () => void;
  fermer: () => Promise<void>;
}

const valide = new Ajv({ allowUnionTypes: true }).compile(
  schémaSpécificationAutomatisation,
);

const différente = (
  spéc1: SpécificationAutomatisation,
  spéc2: SpécificationAutomatisation,
) => {
  return deepEqual(spéc1, spéc2);
};

export type ServicesNécessairesAutomatisations = ServicesNécessairesCompte & {
  bds: Bds;
  projets: Projets;
  nuées: Nuées;
};

export class Automatisations extends ServiceDonnéesAppli<
  "automatisations",
  StructureServiceAutomatisations,
  ServicesNécessairesAutomatisations,
  { oublier: Oublier }
> {
  queue: PQueue;
  automatisations: Map<string, AutomatisationActive>;

  événements: TypedEmitter<{
    démarré: (args: { oublier: Oublier }) => void;
    autos: () => void;
  }>;

  constructor({
    services,
    options,
  }: {
    services: ServicesNécessairesDonnées<{
      automatisations: StructureServiceAutomatisations;
    }> & {
      bds: Bds;
      projets: Projets;
      nuées: Nuées;
    };
    options: OptionsAppli;
  }) {
    super({
      clef: "automatisations",
      services,
      dépendances: ["compte", "stockage"],
      options,
    });

    this.queue = new PQueue({ concurrency: 1 });
    this.automatisations = new Map();

    this.événements = new TypedEmitter();
  }

  async démarrer(): Promise<{ oublier: Oublier }> {
    const oublier = await this.suivreBd({
      f: (autos) =>
        this.queue.add(async () => await this.mettreAutosÀJour(autos)),
    });
    this.estDémarré = { oublier };
    return await super.démarrer();
  }

  async fermer(): Promise<void> {
    const { oublier } = await this.démarré();

    // Arrêter le suivi de la bd des automatisations
    await oublier();

    // Attendre que toutes les automatisations en cours soient ajoutées
    await this.queue.onIdle();

    // Fermer toutes les automatisations actives
    await Promise.all(
      [...this.automatisations.keys()].map((id) =>
        this.fermerAutomatisation(id),
      ),
    );

    return await super.fermer();
  }

  async mettreAutosÀJour(
    autos: PartielRécursif<StructureServiceAutomatisations> = {},
  ) {
    autos = autos || {};
    const compte = this.service("compte");
    const ceDispositif = await compte.obtIdDispositif();

    const àFermer = [...this.automatisations.keys()].filter(
      (id) => !Object.keys(autos).includes(id),
    );

    for (const [id, auto] of Object.entries(autos)) {
      if (!valide(auto)) {
        if (this.automatisations.has(id)) àFermer.push(id);
        continue;
      }

      // Vérifier si l'automatisation existe déjà
      const existante = this.automatisations.get(id);
      if (existante) {
        // Si identique, on arrête ici
        if (!différente(existante.spécification, auto)) continue;

        // Sinon, on ferme la précédente
        await this.fermerAutomatisation(id);
      }

      // Activer si elle correspond à ce dispositif
      if (activePourCeDispositif(auto, ceDispositif)) {
        this.automatisations.set(
          id,
          await this.lancerAutomatisation({
            auto,
            suiviÉtat: () => {
              this.événements.emit("autos");
            },
          }),
        );
      }
    }

    // Fermer les automatisations qui ne sont plus actives
    await Promise.all(
      àFermer.map(async (id) => await this.fermerAutomatisation(id)),
    );

    this.événements.emit("autos");
  }

  async fermerAutomatisation(id: string) {
    await this.automatisations.get(id)?.fermer();
    this.automatisations.delete(id);
  }

  // Actions automatisations

  async ajouterAutomatisationExporter(
    args: SpécificationAjoutExportation,
  ): Promise<string> {
    const compte = this.service("compte");

    const idAuto = uuidv4();

    // Pour des raisons de sécurité, on ne sauvegarde pas le nom du dossier directement
    const idDossier = args.dossier
      ? await this.sauvegarderAdressePrivéeFichier({
          fichier: args.dossier,
        })
      : undefined;

    const élément: SpécificationExporter = {
      type: "exportation",
      id: idAuto,
      ...args,
      dispositifs: args.dispositifs ?? [await compte.obtIdDispositif()],
      fréquence: args.fréquence ?? { type: "dynamique" },
      dossier: idDossier,
    };

    const bd = await this.bd();

    await bd.put(idAuto, élément);

    return idAuto;
  }

  async ajouterAutomatisationImporter<
    T extends InfoImporterJSON | InfoImporterFeuilleCalcul,
  >(args: SpécificationAjoutImportation<T>): Promise<string> {
    const compte = this.service("compte");
    const bd = await this.bd();

    const id = uuidv4();

    if (args.source.type === "fichier") {
      args.source.adresseFichier = await this.sauvegarderAdressePrivéeFichier({
        fichier: args.source.adresseFichier,
      });
    }

    const élément: SpécificationImporter<
      SourceDonnéesImportationAdresseOptionel<T>
    > = {
      type: "importation",
      id,
      ...args,
      dispositif: args.dispositif || (await compte.obtIdDispositif()),
      fréquence: args.fréquence || { type: "dynamique" },
    };

    await bd.put(id, élément);

    return id;
  }

  async annulerAutomatisation({ id }: { id: string }): Promise<void> {
    const bd = await this.bd();
    await bd.del(id);
  }

  async modifierAutomatisation({
    id,
    automatisation,
  }: {
    id: string;
    automatisation: Partial<SpécificationAutomatisation>;
  }): Promise<void> {
    const bd = await this.bd();
    bd.insert(id, automatisation);
  }

  async lancerManuellement({ id }: { id: string }) {
    await this.automatisations.get(id)?.relancer();
  }

  async suivreAutomatisations({
    f,
    idCompte,
  }: {
    f: Suivi<PartielRécursif<SpécificationAutomatisation>[]>;
    idCompte?: string;
  }): Promise<Oublier> {
    const fFinale = async (
      autos: PartielRécursif<{
        [id: string]: SpécificationAutomatisation;
      }> = {},
    ) => {
      const autosFinales = await Promise.all(
        Object.values(autos).map(async (a) => {
          if (!a) return;
          const autoFinale = structuredClone(a);
          if (
            autoFinale.type === "importation" &&
            autoFinale.source?.type === "fichier"
          ) {
            const { adresseFichier } = autoFinale.source;
            if (adresseFichier) {
              const adresseRésolue = await this.résoudreAdressePrivéeFichier({
                clef: adresseFichier,
              });
              if (adresseRésolue) {
                autoFinale.source.adresseFichier = adresseRésolue;
              } else {
                delete autoFinale.source.adresseFichier;
              }
            }
          } else if (autoFinale.type === "exportation") {
            const { dossier } = autoFinale;
            if (dossier) {
              const dossierRésolu = await this.résoudreAdressePrivéeFichier({
                clef: dossier,
              });
              if (dossierRésolu) {
                autoFinale.dossier = dossierRésolu;
              } else {
                delete autoFinale.dossier;
              }
            }
          }
          return autoFinale;
        }),
      );
      await f(
        autosFinales.filter(
          (x): x is PartielRécursif<SpécificationAutomatisation> => !!x,
        ),
      );
    };
    return await this.suivreBd({
      idCompte,
      f: fFinale,
    });
  }

  async suivreÉtatAutomatisations({
    f,
  }: {
    f: Suivi<{ [key: string]: ÉtatAutomatisation }>;
  }): Promise<Oublier> {
    const fFinale = async () => {
      const étatsAuto: { [key: string]: ÉtatAutomatisation } =
        Object.fromEntries(
          [...this.automatisations.entries()].map((a) => [a[0], a[1].état()]),
        );

      await f(étatsAuto);
    };

    const oublier = appelerLorsque({
      émetteur: this.événements,
      événement: "autos",
      f: fFinale,
    });
    await fFinale();

    return oublier;
  }

  // Fonctions utilitaires

  async résoudreAdressePrivéeFichier({
    clef,
  }: {
    clef?: string;
  }): Promise<string | undefined> {
    const stockage = this.service("stockage");
    return clef ? (await stockage.obtenirItem(clef)) || undefined : undefined;
  }

  async sauvegarderAdressePrivéeFichier({
    fichier,
  }: {
    fichier: string;
  }): Promise<string> {
    const stockage = this.service("stockage");

    const clef = "dossier." + uuidv4();
    await stockage.sauvegarderItem({ clef, valeur: fichier });
    return clef;
  }

  async lancerAutomatisation({
    auto,
    suiviÉtat,
  }: {
    auto: SpécificationAutomatisation;
    suiviÉtat: Suivi<ÉtatAutomatisation>;
  }): Promise<AutomatisationActive> {
    let étatAuto: ÉtatAutomatisation;

    const spéc = await this.résoudreFichierAuto(auto);
    const fAuto = générerFAuto({
      spéc,
      service: (clef) => this.service(clef),
    });

    const chrono = await chronomètre({
      auto,
      suiviÉtat: async (état) => {
        étatAuto = état;
        suiviÉtat(état);
      },
      f: fAuto,
      service: (clef) => this.service(clef),
    });

    return {
      spécification: auto,
      état: () => étatAuto,
      ...chrono,
    };
  }

  async résoudreFichierAuto<T extends SpécificationAutomatisation>(
    auto: T,
  ): Promise<T> {
    auto = structuredClone(auto);
    if (auto.type === "importation") {
      if (auto.source.type === "fichier") {
        auto.source.adresseFichier = await this.résoudreAdressePrivéeFichier({
          clef: auto.source.adresseFichier,
        });
      }
    } else {
      auto.dossier = await this.résoudreAdressePrivéeFichier({
        clef: auto.dossier,
      });
    }

    return auto;
  }
}
