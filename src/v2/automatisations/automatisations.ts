import PQueue from "p-queue";
import { TypedEmitter } from "tiny-typed-emitter";
import { Ajv } from "ajv";
import deepEqual from "fast-deep-equal";
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
  SourceDonnéesImportationAdresseOptionelle,
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
      dépendances: [
        "bds",
        "nuées",
        "projets",
        "compte",
        "hélia",
        "stockage",
        "journal",
      ],
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
    const journal = this.service("journal");
    const ceDispositif = await compte.obtIdDispositif();

    const àFermer = [...this.automatisations.keys()].filter(
      (id) => !Object.keys(autos).includes(id),
    );

    for (const [id, auto] of Object.entries(autos)) {
      if (!valide(auto)) {
        if (this.automatisations.has(id)) àFermer.push(id);
        journal.écrire(
          `Automatisation non valide : ${JSON.stringify(auto, undefined, 2)}\n${valide.errors?.map((e) => JSON.stringify(e, undefined, 2)).join(", ")}`,
        );
        continue;
      }

      // Vérifier si l'automatisation existe déjà
      const existante = this.automatisations.get(id);
      if (existante) {
        // Si identique, on arrête ici
        if (deepEqual(existante.spécification, auto)) continue;

        // Sinon, on ferme la précédente
        await this.fermerAutomatisation(id);
      }

      // Activer si elle correspond à ce dispositif
      if (activePourCeDispositif(auto, ceDispositif)) {
        this.automatisations.set(
          id,
          await this.lancerAutomatisation({
            auto,
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

    const élément: SpécificationExporter = await this.obfusquerAdressesLocales({
      type: "exportation",
      id: idAuto,
      ...args,
      dispositifs: args.dispositifs ?? [await compte.obtIdDispositif()],
      fréquence: args.fréquence ?? { type: "dynamique" },
    });

    const bd = await this.bd();

    await bd.put(idAuto, élément);

    await this.initialisée({ idAuto });

    return idAuto;
  }

  async ajouterAutomatisationImporter<
    T extends InfoImporterJSON | InfoImporterFeuilleCalcul,
  >(auto: SpécificationAjoutImportation<T>): Promise<string> {
    const compte = this.service("compte");
    const bd = await this.bd();

    const idAuto = uuidv4();

    auto = await this.obfusquerAdressesLocales(auto);

    const élément: SpécificationImporter<
      SourceDonnéesImportationAdresseOptionelle<T>
    > = {
      type: "importation",
      id: idAuto,
      ...auto,
      dispositif: auto.dispositif || (await compte.obtIdDispositif()),
      fréquence: auto.fréquence || { type: "dynamique" },
    };

    await bd.put(idAuto, élément);

    await this.initialisée({ idAuto });

    return idAuto;
  }

  async initialisée({ idAuto }: { idAuto: string }): Promise<void> {
    if (this.automatisations.has(idAuto)) return;
    else
      return new Promise((résoudre) => {
        const fFinale = () => {
          if (this.automatisations.has(idAuto)) {
            this.événements.off("autos", fFinale);
            résoudre();
          }
        };
        this.événements.on("autos", fFinale);
      });
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
    automatisation: PartielRécursif<SpécificationAutomatisation>;
  }): Promise<void> {
    const bd = await this.bd();
    const élément = await this.obfusquerAdressesLocales(automatisation);
    bd.insert(id, élément);
  }

  async lancerManuellement({ id }: { id: string }) {
    const auto = this.automatisations.get(id);
    if (!auto) throw new Error(`Automatisation ${id} n'existe pas.`);
    auto.relancer();
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
          return a ? this.résoudreAdressesLocales(a) : undefined;
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

  async obfusquerAdressesLocales<
    T extends PartielRécursif<SpécificationAutomatisation>,
  >(auto: T): Promise<T> {
    // Pour des raisons de sécurité, on ne sauvegarde pas le nom du dossier ou du fichier directement
    auto = structuredClone(auto);
    const autoImportation = auto as PartielRécursif<SpécificationImporter>;
    const autoExportation = auto as PartielRécursif<SpécificationExporter>;

    if (
      autoImportation.source?.type === "fichier" &&
      autoImportation.source?.adresseFichier
    ) {
      autoImportation.source.adresseFichier =
        await this.sauvegarderAdressePrivéeFichier({
          fichier: autoImportation.source.adresseFichier,
        });
    } else if (autoExportation.dossier) {
      autoExportation.dossier = await this.sauvegarderAdressePrivéeFichier({
        fichier: autoExportation.dossier,
      });
    }

    return auto;
  }

  async résoudreAdressesLocales<
    T extends PartielRécursif<SpécificationAutomatisation>,
  >(auto: T): Promise<T> {
    auto = structuredClone(auto);
    if (auto.type === "importation") {
      if (auto.source?.type === "fichier") {
        auto.source.adresseFichier = await this.résoudreAdressePrivéeFichier({
          clef: auto.source.adresseFichier,
        });
      }
    } else if (auto.type === "exportation") {
      auto.dossier = await this.résoudreAdressePrivéeFichier({
        clef: auto.dossier,
      });
    }

    return auto;
  }

  async lancerAutomatisation({
    auto,
  }: {
    auto: SpécificationAutomatisation;
  }): Promise<AutomatisationActive> {
    let étatAuto: ÉtatAutomatisation;

    const spéc = await this.résoudreAdressesLocales(auto);
    const fAuto = générerFAuto({
      spéc,
      service: (clef) => this.service(clef),
    });
    const suiviÉtat = (état: ÉtatAutomatisation) => {
      étatAuto = état;
      this.événements.emit("autos");
    };

    const chrono = await chronomètre({
      auto: spéc,
      suiviÉtat,
      f: fAuto,
      service: (clef) => this.service(clef),
    });

    return {
      spécification: spéc,
      état: () => étatAuto,
      ...chrono,
    };
  }
}
