import { EventEmitter } from "events";
import { FeedStore } from "orbit-db";
import XLSX from "xlsx";
import fs from "fs";
import Semaphore from "@chriscdn/promise-semaphore";
import isNode from "is-node";
import isElectron from "is-electron";

import localStorage from "./stockageLocal";
import ClientConstellation, {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  élémentBdListe,
  faisRien,
} from "./client";
import { importerFeuilleCalculDURL, importerJSONdURL } from "./importateur";
import ImportateurFeuilleCalcul from "./importateur/xlsx";
import ImportateurDonnéesJSON, { clefsExtraction } from "./importateur/json";

// const chokidar = import("chokidar");

export type formatTélécharger = XLSX.BookType | "xls";

export type fréquence = {
  unités: "années" | "mois" | "semaines" | "jours" | "heures" | "minutes";
  n: number;
};

export type typeObjetExportation = "projet" | "bd" | "tableau";

export type SpécificationAutomatisation = {
  fréquence?: fréquence;
  type: "importation" | "exportation";
};

export interface SpécificationExporter extends SpécificationAutomatisation {
  type: "exportation";
  idObjet: string;
  typeObjet: typeObjetExportation;
  formatDoc: formatTélécharger;
  dir: string;
  langues?: string[];
  dispositifs: string[];
  inclureFichiersSFIP: boolean;
}

export interface infoImporterJSON {
  formatDonnées: "json";
  clefsRacine: clefsExtraction;
  clefsÉléments: clefsExtraction;
  cols: { [key: string]: clefsExtraction };
}

export interface infoImporterFeuilleCalcul {
  formatDonnées: "feuilleCalcul";
  nomTableau: string;
  cols: { [key: string]: string };
}

export interface SourceDonnéesImportation<
  T = infoImporterJSON | infoImporterFeuilleCalcul
> {
  typeSource: "url" | "fichier";
  info: T;
}

export interface SourceDonnéesImportationURL extends SourceDonnéesImportation {
  typeSource: "url";
  url: string;
}

export interface SourceDonnéesImportationFichier
  extends SourceDonnéesImportation {
  typeSource: "fichier";
  adresseFichier: string;
}

export interface SpécificationImporter extends SpécificationAutomatisation {
  type: "importation";
  idTableau: string;
  dispositif: string;
  fréquence: fréquence;
  source: SourceDonnéesImportation;
}

export interface ÉtatAutomatisation {
  type: "erreur" | "écoute" | "sync" | "schédulé";
}

interface ÉtatErreur extends ÉtatAutomatisation {
  type: "erreur";
  erreur: string;
  prochainSchédulé?: number;
}

interface ÉtatÉcoute extends ÉtatAutomatisation {
  type: "écoute";
}

interface ÉtatEnSync extends ÉtatAutomatisation {
  type: "sync";
  depuis: number;
}

interface ÉtatSchédulé extends ÉtatAutomatisation {
  type: "schédulé";
  dans?: number;
}

const obtTempsInterval = (fréq: fréquence): number => {
  const { n, unités } = fréq;
  switch (unités) {
    case "années":
      return n * 365.25 * 24 * 60 * 60 * 1000;

    case "mois":
      return n * 30 * 24 * 60 * 60 * 1000;

    case "semaines":
      return n * 7 * 24 * 60 * 60 * 1000;

    case "jours":
      return n * 24 * 60 * 60 * 1000;

    case "heures":
      return n * 60 * 60 * 1000;

    case "minutes":
      return n * 60 * 1000;

    default:
      throw new Error(unités);
  }
};

const obtDonnéesImportation = async (spéc: SpécificationImporter) => {
  const { typeSource } = spéc.source;
  const { formatDonnées } = spéc.source.info;

  switch (typeSource) {
    case "url": {
      const { url } = spéc.source as SourceDonnéesImportationURL;
      switch (formatDonnées) {
        case "json": {
          const { clefsRacine, clefsÉléments, cols } = spéc.source
            .info as infoImporterJSON;
          const donnéesJson = await importerJSONdURL(url);
          const importateur = new ImportateurDonnéesJSON(donnéesJson);
          return importateur.obtDonnées(clefsRacine, clefsÉléments, cols);
        }

        case "feuilleCalcul": {
          const { nomTableau, cols } = spéc.source
            .info as infoImporterFeuilleCalcul;
          const docXLSX = await importerFeuilleCalculDURL(url);
          const importateur = new ImportateurFeuilleCalcul(docXLSX);
          return importateur.obtDonnées(nomTableau, cols);
        }

        default:
          throw new Error(formatDonnées);
      }
    }
    case "fichier": {
      const { adresseFichier } = spéc.source as SourceDonnéesImportationFichier;
      switch (formatDonnées) {
        case "json": {
          const { clefsRacine, clefsÉléments, cols } = spéc.source
            .info as infoImporterJSON;

          const contenuFichier = await fs.promises.readFile(adresseFichier);
          const donnéesJson = JSON.parse(contenuFichier.toString());
          const importateur = new ImportateurDonnéesJSON(donnéesJson);
          return importateur.obtDonnées(clefsRacine, clefsÉléments, cols);
        }

        case "feuilleCalcul": {
          const { nomTableau, cols } = spéc.source
            .info as infoImporterFeuilleCalcul;
          const docXLSX = XLSX.readFile(adresseFichier);
          const importateur = new ImportateurFeuilleCalcul(docXLSX);
          return importateur.obtDonnées(nomTableau, cols);
        }

        default:
          throw new Error(formatDonnées);
      }
    }

    default:
      throw new Error(typeSource);
  }
};

const générerFExportation = (
  spéc: SpécificationExporter,
  client: ClientConstellation
): (() => Promise<void>) => {
  return async () => {
    switch (spéc.typeObjet) {
      case "tableau": {
        const donnéesExp = await client.tableaux!.exporterDonnées(
          spéc.idObjet,
          spéc.langues
        );
        await client.bds!.exporterDocumentDonnées(
          donnéesExp,
          spéc.formatDoc,
          spéc.dir,
          spéc.inclureFichiersSFIP
        );
        break;
      }

      case "bd": {
        const donnéesExp = await client.bds!.exporterDonnées(
          spéc.idObjet,
          spéc.langues
        );
        await client.bds!.exporterDocumentDonnées(
          donnéesExp,
          spéc.formatDoc,
          spéc.dir,
          spéc.inclureFichiersSFIP
        );
        break;
      }

      case "projet": {
        const donnéesExp = await client.projets!.exporterDonnées(
          spéc.idObjet,
          spéc.langues
        );
        await client.projets!.exporterDocumentDonnées(
          donnéesExp,
          spéc.formatDoc,
          spéc.dir,
          spéc.inclureFichiersSFIP
        );
        break;
      }

      default:
        throw new Error(spéc.typeObjet);
    }
  };
};

const générerFAuto = (
  spéc: SpécificationAutomatisation,
  client: ClientConstellation
): (() => Promise<void>) => {
  switch (spéc.type) {
    case "importation": {
      const spécImp = spéc as SpécificationImporter;
      return async () => {
        const données = await obtDonnéesImportation(spécImp);
        await client.tableaux!.importerDonnées(spécImp.idTableau, données);
      };
    }

    case "exportation": {
      const spécExp = spéc as SpécificationExporter;
      return générerFExportation(spécExp, client);
    }

    default:
      throw new Error(spéc.type);
  }
};

const lancerAutomatisation = async (
  spéc: SpécificationAutomatisation,
  idSpéc: string,
  client: ClientConstellation,
  fÉtat: (état: ÉtatAutomatisation) => void
): Promise<schémaFonctionOublier> => {
  const fAuto = générerFAuto(spéc, client);
  const clefStockageDernièreFois = `auto: ${idSpéc}`;

  const tempsInterval = spéc.fréquence
    ? obtTempsInterval(spéc.fréquence)
    : undefined;

  const fAutoAvecÉtats = async () => {
    const nouvelÉtat: ÉtatEnSync = {
      type: "sync",
      depuis: new Date().getTime(),
    };
    fÉtat(nouvelÉtat);

    try {
      await fAuto();
      const nouvelÉtat: ÉtatSchédulé = {
        type: "schédulé",
        dans: tempsInterval,
      };
      fÉtat(nouvelÉtat);
    } catch (e) {
      const nouvelÉtat: ÉtatErreur = {
        type: "erreur",
        erreur: (e as Error).toString(),
        prochainSchédulé: tempsInterval,
      };
      fÉtat(nouvelÉtat);
    }
  };

  if (spéc.fréquence) {
    const nouvelÉtat: ÉtatSchédulé = {
      type: "schédulé",
      dans: tempsInterval,
    };
    fÉtat(nouvelÉtat);
    const dicFOublierIntervale: { f?: schémaFonctionOublier } = {};

    const fAutoAvecÉtatsRécursif = async () => {
      await fAutoAvecÉtats();
      const maintenant = new Date().getTime();
      localStorage.setItem(clefStockageDernièreFois, maintenant.toString());
      const crono = setTimeout(fAutoAvecÉtatsRécursif, tempsInterval);
      dicFOublierIntervale.f = () => clearTimeout(crono);
    };

    const maintenant = new Date().getTime();
    const dernièreFoisChaîne = localStorage.getItem(clefStockageDernièreFois);
    const dernièreFois = dernièreFoisChaîne
      ? parseInt(dernièreFoisChaîne)
      : -Infinity;
    const tempsDepuisDernièreFois = maintenant - dernièreFois;
    const crono = setTimeout(
      fAutoAvecÉtatsRécursif,
      Math.max(tempsInterval! - tempsDepuisDernièreFois, 0)
    );
    dicFOublierIntervale.f = () => clearTimeout(crono);

    const fOublier = () => {
      if (dicFOublierIntervale.f) dicFOublierIntervale.f();
    };
    return fOublier;
  } else {
    const nouvelÉtat: ÉtatÉcoute = {
      type: "écoute",
    };
    fÉtat(nouvelÉtat);

    switch (spéc.type) {
      case "exportation": {
        const spécExp = spéc as SpécificationExporter;
        const empreinteDernièreModifImportée = localStorage.getItem(
          clefStockageDernièreFois
        );
        const fOublier = await client.suivreBd(spécExp.idObjet, (bd) => {
          const tête = bd._oplog.heads[bd._oplog.heads.length - 1].hash;
          if (tête !== empreinteDernièreModifImportée) {
            fAutoAvecÉtats();
            localStorage.setItem(clefStockageDernièreFois, tête);
          }
        });
        return fOublier;
      }

      case "importation": {
        const spécImp = spéc as SpécificationImporter;

        switch (spécImp.source.typeSource) {
          case "fichier": {
            if (!isNode() && !isElectron())
              throw new Error(
                "L'automatisation de l'importation des fichiers locaux n'est pas disponible sur la version apli internet de Constellation."
              );

            /*const _chokidar = await chokidar
            const source = spécImp.source as SourceDonnéesImportationFichier;
            const écouteur = _chokidar.watch(source.adresseFichier);
            écouteur.on("change", () => {
              fAutoAvecÉtats();
              localStorage.setItem(
                clefStockageDernièreFois,
                new Date().getTime().toString()
              );
            });

            const dernièreModif = fs
              .statSync(source.adresseFichier)
              .mtime.getTime();
            const dernièreImportation = localStorage.getItem(
              clefStockageDernièreFois
            );
            const fichierModifié = dernièreImportation
              ? dernièreModif > parseInt(dernièreImportation)
              : true;
            if (fichierModifié) {
              const maintenant = new Date().getTime();
              fAutoAvecÉtats();
              localStorage.setItem(
                clefStockageDernièreFois,
                maintenant.toString()
              );
            }

            const fOublier = async () => await écouteur.close();
            return fOublier;
            */
            return faisRien;
          }

          case "url": {
            const étatErreur: ÉtatErreur = {
              type: "erreur",
              erreur:
                "La fréquence d'une automatisation d'importation d'URL doit être spécifiée.",
              prochainSchédulé: undefined,
            };
            fÉtat(étatErreur);
            return faisRien;
          }

          default:
            throw new Error(spécImp.source.typeSource);
        }
      }

      default:
        throw new Error(spéc.type);
    }
  }
};

class AutomatisationActive extends EventEmitter {
  client: ClientConstellation;

  état?: ÉtatAutomatisation;
  fOublier?: schémaFonctionOublier;

  constructor(
    spéc: SpécificationAutomatisation,
    idSpéc: string,
    client: ClientConstellation
  ) {
    super();

    this.client = client;
    lancerAutomatisation(
      spéc,
      idSpéc,
      this.client,
      (état: ÉtatAutomatisation) => {
        this.état = état;
        this.emit("misÀJour");
      }
    ).then((fOublier) => (this.fOublier = fOublier));
  }

  fermer(): void {
    if (this.fOublier) this.fOublier();
  }
}

const activePourCeDispositif = (
  spéc: SpécificationAutomatisation,
  monIdOrbite: string
): boolean => {
  switch (spéc.type) {
    case "importation": {
      const spécImp = spéc as SpécificationImporter;
      return spécImp.dispositif === monIdOrbite;
    }

    case "exportation": {
      const spécExp = spéc as SpécificationExporter;
      return spécExp.dispositifs.includes(monIdOrbite);
    }

    default:
      throw new Error(spéc.type);
  }
};

const verrou = new Semaphore();

export default class Automatisations extends EventEmitter {
  client: ClientConstellation;
  idBd: string;

  automatisations: { [key: string]: AutomatisationActive };
  fOublier?: schémaFonctionOublier;

  constructor(client: ClientConstellation, id: string) {
    super();

    this.client = client;
    this.idBd = id;

    this.automatisations = {};
    this.initialiser();
  }

  async initialiser(): Promise<void> {
    this.fOublier =
      await this.client.suivreBdListe<SpécificationAutomatisation>(
        this.idBd,
        (autos) => this.mettreAutosÀJour(autos),
        false
      );
  }

  async mettreAutosÀJour(
    autos: élémentBdListe<SpécificationAutomatisation>[]
  ): Promise<void> {
    for (const a of autos) {
      const {
        hash,
        payload: { value },
      } = a;
      if (activePourCeDispositif(value, this.client.orbite!.identity.id)) {
        await verrou.acquire(hash);
        if (!Object.keys(this.automatisations).includes(hash)) {
          const auto = new AutomatisationActive(value, hash, this.client);
          auto.on("misÀJour", () => this.emit("misÀJour"));
          this.automatisations[hash] = auto;
        }
        verrou.release(hash);
      } else {
        const autoActif = this.automatisations[hash];
        if (autoActif) {
          this.fermerAuto(hash);
        }
      }
    }
  }

  async ajouterAutomatisationExporter(
    id: string,
    typeObjet: typeObjetExportation,
    formatDoc: formatTélécharger,
    inclureFichiersSFIP: boolean,
    fréquence: fréquence,
    dir: string,
    dispositifs?: string[]
  ): Promise<string> {
    dispositifs = dispositifs || [this.client.orbite!.identity.id];

    const élément: SpécificationExporter = {
      type: "exportation",
      idObjet: id,
      typeObjet,
      dispositifs,
      fréquence,
      formatDoc,
      inclureFichiersSFIP,
      dir,
    };
    const bd = (await this.client.ouvrirBd(this.idBd)) as FeedStore;
    const idÉlément = await bd.add(élément);
    return idÉlément;
  }

  async ajouterAutomatisationImporter(
    idTableau: string,
    fréquence: fréquence,
    source: SourceDonnéesImportation,
    dispositif?: string
  ): Promise<string> {
    const bd = (await this.client.ouvrirBd(this.idBd)) as FeedStore;

    dispositif = dispositif || this.client.orbite!.identity.id;

    const élément: SpécificationImporter = {
      type: "importation",
      idTableau,
      dispositif,
      fréquence,
      source,
    };

    const idÉlément = await bd.add(élément);
    return idÉlément;
  }

  async annulerAutomatisation(empreinte: string): Promise<void> {
    const élément = await this.client.rechercherBdListe(
      this.idBd,
      (é) => é.hash === empreinte
    );
    const bd = (await this.client.ouvrirBd(this.idBd)) as FeedStore;
    await bd.remove(élément.hash);
  }

  async suivreAutomatisations(
    f: schémaFonctionSuivi<SpécificationAutomatisation[]>,
    idRacine?: string
  ): Promise<schémaFonctionOublier> {
    idRacine = idRacine || this.idBd;
    return await this.client.suivreBdListe(idRacine, f);
  }

  async suivreÉtatAutomatisations(
    f: schémaFonctionSuivi<{ [key: string]: ÉtatAutomatisation }[]>
  ): Promise<schémaFonctionOublier> {
    const fFinale = () => {
      const étatsAuto = Object.fromEntries(
        Object.keys(this.automatisations)
          .map((a) => [a, this.automatisations[a]])
          .filter((x) => x[1])
      );
      f(étatsAuto);
    };
    this.on("misÀJour", fFinale);
    return () => {
      this.off("misÀJour", fFinale);
    };
  }

  fermerAuto(empreinte: string): void {
    this.automatisations[empreinte].fermer();
    delete this.automatisations[empreinte];
  }

  async fermer(): Promise<void> {
    Object.keys(this.automatisations).forEach((a) => {
      this.fermerAuto(a);
    });
    if (this.fOublier) this.fOublier();
  }
}
