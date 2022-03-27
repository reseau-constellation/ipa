import { EventEmitter } from "events";
import FeedStore from "orbit-db-feedstore";
import { BookType, readFile } from "xlsx";
import fs from "fs";
import Semaphore from "@chriscdn/promise-semaphore";
import isNode from "is-node";
import isElectron from "is-electron";
import { v4 as uuidv4 } from "uuid";

import ClientConstellation from "@/client";
import { schémaFonctionSuivi, schémaFonctionOublier, faisRien } from "@/utils";
import { importerFeuilleCalculDURL, importerJSONdURL } from "@/importateur";
import ImportateurFeuilleCalcul from "@/importateur/xlsx";
import ImportateurDonnéesJSON, { clefsExtraction } from "@/importateur/json";

// const chokidar = import("chokidar");

export type formatTélécharger = BookType | "xls";

export type fréquence = {
  unités: "années" | "mois" | "semaines" | "jours" | "heures" | "minutes" | "secondes" | "millisecondes";
  n: number;
};

export type typeObjetExportation = "projet" | "bd" | "tableau";

export type SpécificationAutomatisation = {
  fréquence?: fréquence;
  type: "importation" | "exportation";
  id: string;
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
  type: "erreur" | "écoute" | "sync" | "programmée";
}

interface ÉtatErreur extends ÉtatAutomatisation {
  type: "erreur";
  erreur: string;
  prochainProgrammée?: number;
}

interface ÉtatÉcoute extends ÉtatAutomatisation {
  type: "écoute";
}

interface ÉtatEnSync extends ÉtatAutomatisation {
  type: "sync";
  depuis: number;
}

interface ÉtatProgrammée extends ÉtatAutomatisation {
  type: "programmée";
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

    case "secondes":
      return n * 1000;

    case "millisecondes":
      return n

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
          const docXLSX = readFile(adresseFichier);
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
      const nouvelÉtat: ÉtatProgrammée = {
        type: "programmée",
        dans: tempsInterval,
      };
      fÉtat(nouvelÉtat);
    } catch (e) {
      const nouvelÉtat: ÉtatErreur = {
        type: "erreur",
        erreur: (e as Error).toString(),
        prochainProgrammée: tempsInterval,
      };
      fÉtat(nouvelÉtat);
    }
  };

  if (spéc.fréquence) {
    const nouvelÉtat: ÉtatProgrammée = {
      type: "programmée",
      dans: tempsInterval,
    };
    fÉtat(nouvelÉtat);
    const dicFOublierIntervale: { f?: schémaFonctionOublier } = {};

    const fAutoAvecÉtatsRécursif = async () => {
      await fAutoAvecÉtats();
      const maintenant = new Date().getTime();
      client.sauvegarderAuStockageLocal(
        clefStockageDernièreFois,
        maintenant.toString()
      );
      const crono = setTimeout(fAutoAvecÉtatsRécursif, tempsInterval);
      dicFOublierIntervale.f = () => clearTimeout(crono);
    };

    const maintenant = new Date().getTime();
    const dernièreFoisChaîne = await client.obtDeStockageLocal(
      clefStockageDernièreFois
    );
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
        const empreinteDernièreModifImportée = await client.obtDeStockageLocal(clefStockageDernièreFois);
        const fOublier = await client.suivreBd(spécExp.idObjet, async (bd) => {
          const tête: string = bd._oplog.heads[bd._oplog.heads.length - 1].hash;
          if (tête !== empreinteDernièreModifImportée) {
            fAutoAvecÉtats();
            await client.sauvegarderAuStockageLocal(clefStockageDernièreFois, tête);
          }
        });
        return fOublier;
      }

      case "importation": {
        const spécImp = spéc as SpécificationImporter;

        switch (spécImp.source.typeSource) {
          case "fichier": {
            if (!isNode && !isElectron()) {
              throw new Error(
                "L'automatisation de l'importation des fichiers locaux n'est pas disponible sur la version apli internet de Constellation."
              );
            }

            /* const _chokidar = await chokidar
            const source = spécImp.source as SourceDonnéesImportationFichier;
            const écouteur = _chokidar.watch(source.adresseFichier);
            écouteur.on("change", () => {
              fAutoAvecÉtats();
              await client.sauvegarderAuStockageLocal(
                clefStockageDernièreFois,
                new Date().getTime().toString()
              );
            });

            const dernièreModif = fs
              .statSync(source.adresseFichier)
              .mtime.getTime();
            const dernièreImportation = await client.sauvegarderAuStockageLocal(
              clefStockageDernièreFois
            );
            const fichierModifié = dernièreImportation
              ? dernièreModif > parseInt(dernièreImportation)
              : true;
            if (fichierModifié) {
              const maintenant = new Date().getTime();
              fAutoAvecÉtats();
              await client.sauvegarderAuStockageLocal(
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
              prochainProgrammée: undefined,
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
    ).then((fOublier) => {
      this.fOublier = fOublier
      this.emit("prêt");
    });
  }

  async fermer(): Promise<void> {
    if (!this.fOublier) {
      const soimême = this;
      await new Promise(function(résoudre) {
        soimême.once('prêt', function(e) {
          résoudre(e.data);
        });
      });
    }
    this.fOublier!();
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
    autos: LogEntry<SpécificationAutomatisation>[]
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
      id: uuidv4(),
      idObjet: id,
      typeObjet,
      dispositifs,
      fréquence,
      formatDoc,
      inclureFichiersSFIP,
      dir,
    };
    const { bd, fOublier } = await this.client.ouvrirBd<
      FeedStore<SpécificationAutomatisation>
    >(this.idBd);
    const idÉlément = await bd.add(élément);

    fOublier();

    return idÉlément;
  }

  async ajouterAutomatisationImporter(
    idTableau: string,
    fréquence: fréquence,
    source: SourceDonnéesImportation,
    dispositif?: string
  ): Promise<string> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      FeedStore<SpécificationAutomatisation>
    >(this.idBd);

    dispositif = dispositif || this.client.orbite!.identity.id;

    const élément: SpécificationImporter = {
      type: "importation",
      id: uuidv4(),
      idTableau,
      dispositif,
      fréquence,
      source,
    };

    const idÉlément = await bd.add(élément);

    fOublier();

    return idÉlément;
  }

  async annulerAutomatisation(id: string): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      FeedStore<SpécificationAutomatisation>
    >(this.idBd);
    await this.client.effacerÉlémentDeBdListe(
      bd,
      (é) => é.payload.value.id === id
    );
    fOublier();
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
