import { EventEmitter } from "events";
import type FeedStore from "orbit-db-feedstore";
import * as XLSX from "xlsx";

import Semaphore from "@chriscdn/promise-semaphore";
import { isNode, isElectronMain } from "wherearewe";
import { v4 as uuidv4 } from "uuid";

import type { default as ClientConstellation } from "@/client.js";
import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  faisRien,
} from "@/utils/index.js";
import {
  importerFeuilleCalculDURL,
  importerJSONdURL,
} from "@/importateur/index.js";
import ImportateurFeuilleCalcul from "@/importateur/xlsx.js";
import ImportateurDonnéesJSON, { clefsExtraction } from "@/importateur/json.js";

if (isElectronMain || isNode) {
  import("fs").then((fs) => XLSX.set_fs(fs));
  import("stream").then((stream) => XLSX.stream.set_readable(stream.Readable));
}

const MESSAGE_NON_DISPO_NAVIGATEUR =
  "L'automatisation de l'importation des fichiers locaux n'est pas disponible sur la version apli internet de Constellation.";

export type formatTélécharger = XLSX.BookType | "xls";

export type fréquence = {
  unités:
    | "années"
    | "mois"
    | "semaines"
    | "jours"
    | "heures"
    | "minutes"
    | "secondes"
    | "millisecondes";
  n: number;
};

export type typeObjetExportation = "nuée" | "projet" | "bd" | "tableau";

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
  dossier: string;
  langues?: string[];
  dispositifs: string[];
  inclureFichiersSFIP: boolean;
}

export interface infoImporter {
  formatDonnées: "json" | "feuilleCalcul";
}

export interface infoImporterJSON extends infoImporter {
  formatDonnées: "json";
  clefsRacine: clefsExtraction;
  clefsÉléments: clefsExtraction;
  cols: { [key: string]: clefsExtraction };
}

export interface infoImporterFeuilleCalcul extends infoImporter {
  formatDonnées: "feuilleCalcul";
  nomTableau: string;
  cols: { [key: string]: string };
  optionsXLSX?: XLSX.ParsingOptions;
}

export interface SourceDonnéesImportation<
  T extends infoImporterJSON | infoImporterFeuilleCalcul
> {
  typeSource: "url" | "fichier";
  info: T;
}

export interface SourceDonnéesImportationURL<
  T extends infoImporterJSON | infoImporterFeuilleCalcul
> extends SourceDonnéesImportation<T> {
  typeSource: "url";
  url: string;
}

export interface SourceDonnéesImportationFichier<
  T extends infoImporterJSON | infoImporterFeuilleCalcul
> extends SourceDonnéesImportation<T> {
  typeSource: "fichier";
  adresseFichier: string;
}

export interface SpécificationImporter<
  T extends infoImporterJSON | infoImporterFeuilleCalcul
> extends SpécificationAutomatisation {
  type: "importation";
  idTableau: string;
  dispositif: string;
  source: SourceDonnéesImportation<T>;
}

export interface ÉtatAutomatisation {
  type: "erreur" | "écoute" | "sync" | "programmée";
}

export interface ÉtatErreur extends ÉtatAutomatisation {
  type: "erreur";
  erreur: string;
  prochaineProgramméeÀ?: number;
}

export interface ÉtatÉcoute extends ÉtatAutomatisation {
  type: "écoute";
}

export interface ÉtatEnSync extends ÉtatAutomatisation {
  type: "sync";
  depuis: number;
}

export interface ÉtatProgrammée extends ÉtatAutomatisation {
  type: "programmée";
  à: number;
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
      return n;

    default:
      throw new Error(unités);
  }
};

const obtDonnéesImportation = async <
  T extends infoImporterJSON | infoImporterFeuilleCalcul
>(
  spéc: SpécificationImporter<T>
) => {
  const { typeSource } = spéc.source;
  const { formatDonnées } = spéc.source.info;

  switch (typeSource) {
    case "url": {
      const { url } = spéc.source as SourceDonnéesImportationURL<T>;
      switch (formatDonnées) {
        case "json": {
          const { clefsRacine, clefsÉléments, cols } = spéc.source.info;
          const donnéesJson = await importerJSONdURL(url);
          const importateur = new ImportateurDonnéesJSON(donnéesJson);
          return importateur.obtDonnées(clefsRacine, clefsÉléments, cols);
        }

        case "feuilleCalcul": {
          const { nomTableau, cols, optionsXLSX } = spéc.source.info;
          const docXLSX = await importerFeuilleCalculDURL(url, optionsXLSX);
          const importateur = new ImportateurFeuilleCalcul(docXLSX);
          return importateur.obtDonnées(nomTableau, cols);
        }

        default:
          throw new Error(formatDonnées);
      }
    }
    case "fichier": {
      if (!isElectronMain && !isNode)
        throw new Error(MESSAGE_NON_DISPO_NAVIGATEUR);
      const fs = await import("fs");
      const { adresseFichier } =
        spéc.source as SourceDonnéesImportationFichier<T>;
      switch (formatDonnées) {
        case "json": {
          const { clefsRacine, clefsÉléments, cols } = spéc.source
            .info as unknown as infoImporterJSON;

          const contenuFichier = await fs.promises.readFile(adresseFichier);
          const donnéesJson = JSON.parse(contenuFichier.toString());
          const importateur = new ImportateurDonnéesJSON(donnéesJson);

          return importateur.obtDonnées(clefsRacine, clefsÉléments, cols);
        }

        case "feuilleCalcul": {
          const { nomTableau, cols } = spéc.source
            .info as unknown as infoImporterFeuilleCalcul;
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
        const donnéesExp = await client.tableaux!.exporterDonnées({
          idTableau: spéc.idObjet,
          langues: spéc.langues,
        });
        await client.bds!.exporterDocumentDonnées({
          données: donnéesExp,
          formatDoc: spéc.formatDoc,
          dossier: spéc.dossier,
          inclureFichiersSFIP: spéc.inclureFichiersSFIP,
        });
        break;
      }

      case "bd": {
        const donnéesExp = await client.bds!.exporterDonnées({
          id: spéc.idObjet,
          langues: spéc.langues,
        });
        await client.bds!.exporterDocumentDonnées({
          données: donnéesExp,
          formatDoc: spéc.formatDoc,
          dossier: spéc.dossier,
          inclureFichiersSFIP: spéc.inclureFichiersSFIP,
        });
        break;
      }

      case "projet": {
        const donnéesExp = await client.projets!.exporterDonnées({
          id: spéc.idObjet,
          langues: spéc.langues,
        });
        await client.projets!.exporterDocumentDonnées({
          données: donnéesExp,
          formatDoc: spéc.formatDoc,
          dossier: spéc.dossier,
          inclureFichiersSFIP: spéc.inclureFichiersSFIP,
        });
        break;
      }

      case "nuée": {
        const donnéesNuée = await client.nuées!.exporterDonnéesNuée({
          idNuée: spéc.idObjet,
          langues: spéc.langues,
        });
        await client.bds!.exporterDocumentDonnées({
          données: donnéesNuée,
          formatDoc: spéc.formatDoc,
          dossier: spéc.dossier,
          inclureFichiersSFIP: spéc.inclureFichiersSFIP,
        });
        break;
      }

      default:
        throw new Error(spéc.typeObjet);
    }
  };
};

const générerFAuto = <T extends SpécificationAutomatisation>(
  spéc: T,
  client: ClientConstellation
): (() => Promise<void>) => {
  type R = T extends SpécificationImporter<infer R> ? R : never;

  switch (spéc.type) {
    case "importation": {
      return async () => {
        const spécImp = spéc as unknown as SpécificationImporter<R>;
        const données = await obtDonnéesImportation(spécImp);
        await client.tableaux!.importerDonnées({
          idTableau: spécImp.idTableau,
          données,
        });
      };
    }

    case "exportation": {
      const spécExp = spéc as unknown as SpécificationExporter;
      return générerFExportation(spécExp, client);
    }

    default:
      throw new Error(spéc.type);
  }
};

const lancerAutomatisation = async <T extends SpécificationAutomatisation>({
  spéc,
  idSpéc,
  client,
  fÉtat,
}: {
  spéc: T;
  idSpéc: string;
  client: ClientConstellation;
  fÉtat: (état: ÉtatAutomatisation) => void;
}): Promise<schémaFonctionOublier> => {
  const fAuto = générerFAuto(spéc, client);
  const clefStockageDernièreFois = `auto: ${idSpéc}`;

  const tempsInterval = spéc.fréquence
    ? obtTempsInterval(spéc.fréquence)
    : undefined;

  const verrou = new Semaphore();
  let idDernièreRequèteOpération = "";

  const fAutoAvecÉtats = async (requète: string) => {
    const requèteDernièreModifImportée = await client.obtDeStockageLocal({
      clef: clefStockageDernièreFois,
    });

    if (requète === requèteDernièreModifImportée) return;

    idDernièreRequèteOpération = requète;

    await verrou.acquire("opération");
    if (requète !== idDernièreRequèteOpération) {
      verrou.release("opération");
      return;
    }
    await client.sauvegarderAuStockageLocal({
      clef: clefStockageDernièreFois,
      val: requète,
    });

    const nouvelÉtat: ÉtatEnSync = {
      type: "sync",
      depuis: new Date().getTime(),
    };
    fÉtat(nouvelÉtat);

    try {
      await fAuto();
      if (tempsInterval) {
        const nouvelÉtat: ÉtatProgrammée = {
          type: "programmée",
          à: Date.now() + tempsInterval,
        };
        fÉtat(nouvelÉtat);
      } else {
        const nouvelÉtat: ÉtatÉcoute = {
          type: "écoute",
        };
        fÉtat(nouvelÉtat);
      }
    } catch (e) {
      const nouvelÉtat: ÉtatErreur = {
        type: "erreur",
        erreur: (e as Error).toString(),
        prochaineProgramméeÀ: tempsInterval
          ? Date.now() + tempsInterval
          : undefined,
      };
      fÉtat(nouvelÉtat);
    }
    verrou.release("opération");
  };

  if (spéc.fréquence) {
    const nouvelÉtat: ÉtatProgrammée = {
      type: "programmée",
      à: tempsInterval!,
    };
    fÉtat(nouvelÉtat);
    const dicFOublierIntervale: { f?: schémaFonctionOublier } = {};

    const fAutoAvecÉtatsRécursif = async () => {
      const maintenant = new Date().getTime();
      await fAutoAvecÉtats(maintenant.toString());

      const crono = setTimeout(fAutoAvecÉtatsRécursif, tempsInterval);
      dicFOublierIntervale.f = async () => clearTimeout(crono);
    };

    const maintenant = new Date().getTime();
    const dernièreFoisChaîne = await client.obtDeStockageLocal({
      clef: clefStockageDernièreFois,
    });
    const dernièreFois = dernièreFoisChaîne
      ? parseInt(dernièreFoisChaîne)
      : -Infinity;
    const tempsDepuisDernièreFois = maintenant - dernièreFois;
    const crono = setTimeout(
      fAutoAvecÉtatsRécursif,
      Math.max(tempsInterval! - tempsDepuisDernièreFois, 0)
    );
    dicFOublierIntervale.f = async () => clearTimeout(crono);

    const fOublier = async () => {
      if (dicFOublierIntervale.f) await dicFOublierIntervale.f();
    };
    return fOublier;
  } else {
    const nouvelÉtat: ÉtatÉcoute = {
      type: "écoute",
    };
    fÉtat(nouvelÉtat);

    switch (spéc.type) {
      case "exportation": {
        const spécExp = spéc as unknown as SpécificationExporter;
        if (spécExp.typeObjet === "nuée") {
          const fOublier = await client.nuées!.suivreEmpreinteTêtesBdsNuée({
            idNuée: spécExp.idObjet,
            f: fAutoAvecÉtats,
          });
          return fOublier;
        } else {
          const fOublier = await client.suivreEmpreinteTêtesBdRécursive({
            idBd: spécExp.idObjet,
            f: fAutoAvecÉtats,
          });
          return fOublier;
        }
      }

      case "importation": {
        type R = T extends SpécificationImporter<infer R> ? R : never;
        const spécImp = spéc as unknown as SpécificationImporter<R>;

        switch (spécImp.source.typeSource) {
          case "fichier": {
            if (!isNode && !isElectronMain) {
              throw new Error(MESSAGE_NON_DISPO_NAVIGATEUR);
            }
            const chokidar = await import("chokidar");
            const fs = await import("fs");
            const source = spécImp.source as SourceDonnéesImportationFichier<R>;
            const écouteur = chokidar.watch(source.adresseFichier);
            écouteur.on("change", async () => {
              const maintenant = new Date().getTime().toString();
              fAutoAvecÉtats(maintenant);
            });

            const dernièreModif = fs
              .statSync(source.adresseFichier)
              .mtime.getTime();
            const dernièreImportation = await client.obtDeStockageLocal({
              clef: clefStockageDernièreFois,
            });
            const fichierModifié = dernièreImportation
              ? dernièreModif > parseInt(dernièreImportation)
              : true;
            if (fichierModifié) {
              const maintenant = new Date().getTime().toString();
              fAutoAvecÉtats(maintenant);
            }

            const fOublier = async () => await écouteur.close();
            return fOublier;
          }

          case "url": {
            const étatErreur: ÉtatErreur = {
              type: "erreur",
              erreur:
                "La fréquence d'une automatisation d'importation d'URL doit être spécifiée.",
              prochaineProgramméeÀ: undefined,
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
    lancerAutomatisation({
      spéc,
      idSpéc,
      client: this.client,
      fÉtat: (état: ÉtatAutomatisation) => {
        this.état = état;
        this.emit("misÀJour");
      },
    }).then((fOublier) => {
      this.fOublier = fOublier;
      this.emit("prêt");
    });
  }

  async fermer(): Promise<void> {
    if (!this.fOublier) {
      await new Promise<void>((résoudre) => {
        this.once("prêt", () => {
          résoudre();
        });
      });
    }
    this.fOublier!();
  }
}

const activePourCeDispositif = <T extends SpécificationAutomatisation>(
  spéc: T,
  monIdOrbite: string
): boolean => {
  switch (spéc.type) {
    case "importation": {
      type R = T extends SpécificationImporter<infer R> ? R : never;

      const spécImp = spéc as unknown as SpécificationImporter<R>;
      return spécImp.dispositif === monIdOrbite;
    }

    case "exportation": {
      const spécExp = spéc as unknown as SpécificationExporter;
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

  constructor({ client, id }: { client: ClientConstellation; id: string }) {
    super();

    this.client = client;
    this.idBd = id;

    this.automatisations = {};

    this.initialiser();
  }

  async initialiser(): Promise<void> {
    this.fOublier =
      await this.client.suivreBdListe<SpécificationAutomatisation>({
        id: this.idBd,
        f: (autos) => this.mettreAutosÀJour(autos),
        renvoyerValeur: false,
      });
  }

  async mettreAutosÀJour(
    autos: LogEntry<SpécificationAutomatisation>[]
  ): Promise<void> {
    await verrou.acquire("miseÀJour");
    const automatisationsDavant = Object.keys(this.automatisations);

    for (const id of automatisationsDavant) {
      if (!autos.find((a) => a.payload.value.id === id))
        await this.fermerAuto(id);
    }

    for (const a of autos) {
      const {
        payload: { value },
      } = a;

      if (activePourCeDispositif(value, this.client.orbite!.identity.id)) {
        if (!Object.keys(this.automatisations).includes(value.id)) {
          const auto = new AutomatisationActive(value, value.id, this.client);
          auto.on("misÀJour", () => this.emit("misÀJour"));
          this.automatisations[value.id] = auto;
        }
      } else {
        const autoActif = this.automatisations[value.id];
        if (autoActif) {
          await this.fermerAuto(value.id);
        }
      }
    }

    verrou.release("miseÀJour");
  }

  async ajouterAutomatisationExporter({
    id,
    typeObjet,
    formatDoc,
    inclureFichiersSFIP,
    dossier,
    langues,
    fréquence,
    dispositifs,
  }: {
    id: string;
    typeObjet: typeObjetExportation;
    formatDoc: formatTélécharger;
    inclureFichiersSFIP: boolean;
    dossier: string;
    langues?: string[];
    fréquence?: fréquence;
    dispositifs?: string[];
  }): Promise<string> {
    dispositifs = dispositifs || [this.client.orbite!.identity.id];
    const idAuto = uuidv4();
    const élément: SpécificationExporter = {
      type: "exportation",
      id: idAuto,
      idObjet: id,
      typeObjet,
      dispositifs,
      fréquence,
      formatDoc,
      langues,
      inclureFichiersSFIP,
      dossier,
    };

    // Enlever les options qui n'existent pas. (DLIP n'aime pas `undefined`.)
    Object.keys(élément).forEach((clef) => {
      if (élément[clef as keyof SpécificationExporter] === undefined) {
        delete élément[clef as keyof SpécificationExporter];
      }
    });
    const { bd, fOublier } = await this.client.ouvrirBd<
      FeedStore<SpécificationAutomatisation>
    >({ id: this.idBd });
    await bd.add(élément);

    await fOublier();

    return idAuto;
  }

  async ajouterAutomatisationImporter<
    T extends infoImporterJSON | infoImporterFeuilleCalcul
  >({
    idTableau,
    source,
    fréquence,
    dispositif,
  }: {
    idTableau: string;
    source: SourceDonnéesImportation<T>;
    fréquence?: fréquence;
    dispositif?: string;
  }): Promise<string> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      FeedStore<SpécificationAutomatisation>
    >({ id: this.idBd });

    dispositif = dispositif || this.client.orbite!.identity.id;
    const id = uuidv4();

    const élément: SpécificationImporter<T> = {
      type: "importation",
      id,
      idTableau,
      dispositif,
      fréquence,
      source,
    };

    // Enlever les options qui n'existent pas. (DLIP n'aime pas `undefined`.)
    Object.keys(élément).forEach((clef) => {
      if (élément[clef as keyof SpécificationImporter<T>] === undefined) {
        delete élément[clef as keyof SpécificationImporter<T>];
      }
    });

    await bd.add(élément);

    await fOublier();

    return id;
  }

  async annulerAutomatisation({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      FeedStore<SpécificationAutomatisation>
    >({ id: this.idBd });
    await this.client.effacerÉlémentDeBdListe({
      bd,
      élément: (é) => é.payload.value.id === id,
    });
    await fOublier();
  }

  async suivreAutomatisations({
    f,
    idRacine,
  }: {
    f: schémaFonctionSuivi<SpécificationAutomatisation[]>;
    idRacine?: string;
  }): Promise<schémaFonctionOublier> {
    idRacine = idRacine || this.idBd;
    return await this.client.suivreBdListe({ id: idRacine, f });
  }

  async suivreÉtatAutomatisations({
    f,
  }: {
    f: schémaFonctionSuivi<{ [key: string]: ÉtatAutomatisation }>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = () => {
      const étatsAuto: { [key: string]: ÉtatAutomatisation } =
        Object.fromEntries(
          Object.keys(this.automatisations)
            .map((a) => [a, this.automatisations[a].état])
            .filter((x) => x[1])
        );
      f(étatsAuto);
    };
    this.on("misÀJour", fFinale);
    return async () => {
      this.off("misÀJour", fFinale);
    };
  }

  async fermerAuto(empreinte: string): Promise<void> {
    await this.automatisations[empreinte].fermer();
    delete this.automatisations[empreinte];
  }

  async fermer(): Promise<void> {
    await Promise.all(
      Object.keys(this.automatisations).map((a) => {
        this.fermerAuto(a);
      })
    );
    if (this.fOublier) await this.fOublier();
  }
}
