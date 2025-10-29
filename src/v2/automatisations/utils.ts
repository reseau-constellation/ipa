import { isElectronMain, isNode } from "wherearewe";
import * as XLSX from "xlsx";
import { faisRien } from "@constl/utils-ipa";
import { FSWatcherEventMap } from "chokidar";
import { TypedEmitter } from "tiny-typed-emitter";
import {
  importerFeuilleCalculDURL,
  importerJSONdURL,
} from "@/importateur/index.js";
import { ImportateurDonnéesJSON } from "@/importateur/json.js";
import { ImportateurFeuilleCalcul } from "@/importateur/xlsx.js";
import { Constellation } from "../constellation.js";
import { appelerLorsque } from "../crabe/services/utils.js";
import { Suivi } from "../crabe/types.js";
import {
  FréquenceFixe,
  InfoImporterFeuilleCalcul,
  InfoImporterJSON,
  SpécificationAutomatisation,
  SpécificationExporter,
  SpécificationImporter,
  ÉtatAttente,
  ÉtatAutomatisation,
  ÉtatEnSync,
  ÉtatErreur,
  ÉtatProgrammée,
  ÉtatÉcoute,
} from "./types.js";

if (isElectronMain || isNode) {
  import("fs").then((fs) => XLSX.set_fs(fs));
  import("stream").then((stream) => XLSX.stream.set_readable(stream.Readable));
}

const MESSAGE_NON_DISPO_NAVIGATEUR =
  "L'automatisation de l'importation des fichiers locaux n'est pas disponible sur la version appli internet de Constellation.";

export const fAutoAvecÉtats = (
  fAuto: () => Promise<void>,
  état: (état: ÉtatAutomatisation) => void,
  tempsInterval?: number,
): (() => Promise<void>) => {
  return async () => {
    const nouvelÉtat: ÉtatEnSync = {
      type: "sync",
      depuis: new Date().getTime(),
    };
    état(nouvelÉtat);

    try {
      await fAuto();
      if (tempsInterval) {
        const nouvelÉtat: ÉtatProgrammée = {
          type: "programmée",
          à: Date.now() + tempsInterval,
        };
        état(nouvelÉtat);
      } else {
        const nouvelÉtat: ÉtatÉcoute = {
          type: "écoute",
        };
        état(nouvelÉtat);
      }
    } catch (e) {
      état(nouvelÉtat);
    }
  };
};

export const générerFAuto = <T extends SpécificationAutomatisation>(
  spéc: T,
  constl: Constellation,
): (() => Promise<void>) => {
  switch (spéc.type) {
    case "importation": {
      return générerFImportation(spéc, constl);
    }

    case "exportation": {
      return générerFExportation(spéc, constl);
    }

    default:
      throw new Error(spéc);
  }
};

export const générerFImportation = (
  spéc: SpécificationImporter,
  constl: Constellation,
): (() => Promise<void>) => {
  return async () => {
    const résoudreAdresse = async (
      adresse?: string,
    ): Promise<string | undefined> => {
      return (
        (await constl.automatisations.résoudreAdressePrivéeFichier({
          clef: adresse,
        })) || undefined
      );
    };
    const données = await obtDonnéesImportation(spéc, résoudreAdresse);

    // Adresse base des fichiers pour résoudre les entrées fichiers, si applicable. Fonctionne uniquement
    // sur Node et le processus principal d'Électron.
    const path = await import("path");

    let cheminBaseFichiers: string | undefined = undefined;
    if (spéc.source.typeSource === "fichier" && spéc.source.adresseFichier) {
      const fichierRésolu = await résoudreAdresse(spéc.source.adresseFichier);
      if (fichierRésolu) cheminBaseFichiers = path.dirname(fichierRésolu);
    }

    await constl.tableaux.importerDonnées({
      idTableau: spéc.idTableau,
      données,
      conversions: spéc.conversions,
      cheminBaseFichiers,
    });
  };
};

export const générerFExportation = (
  spéc: SpécificationExporter,
  constl: Constellation,
): (() => Promise<void>) => {
  return async () => {
    const os = await import("os");
    const path = await import("path");
    const fs = await import("fs");
    const dossier = spéc.dossier
      ? await constl.automatisations.résoudreAdressePrivéeFichier({
          clef: spéc.dossier,
        })
      : path.join(os.homedir(), "constellation");
    if (!dossier) throw new Error("Dossier introuvable");

    let nomFichier: string;
    const ajouterÉtiquetteÀNomFichier = (nom: string): string => {
      const composantes = nom.split(".");
      return `${composantes[0]}-${Date.now()}.${composantes[1]}`;
    };
    switch (spéc.typeObjet) {
      case "tableau": {
        const donnéesExp = await constl.tableaux.exporterDonnées({
          idTableau: spéc.idObjet,
          langues: spéc.langues,
        });
        nomFichier = donnéesExp.nomFichier;
        if (spéc.copies) nomFichier = ajouterÉtiquetteÀNomFichier(nomFichier);

        await constl.bds.documentDonnéesÀFichier({
          données: donnéesExp,
          formatDoc: spéc.formatDoc,
          dossier,
          inclureDocuments: spéc.inclureDocuments,
        });
        break;
      }

      case "bd": {
        const donnéesExp = await constl.bds.exporterDonnées({
          idBd: spéc.idObjet,
          langues: spéc.langues,
        });
        nomFichier = donnéesExp.nomFichier;
        if (spéc.copies) nomFichier = ajouterÉtiquetteÀNomFichier(nomFichier);

        await constl.bds.documentDonnéesÀFichier({
          données: donnéesExp,
          formatDoc: spéc.formatDoc,
          dossier,
          inclureDocuments: spéc.inclureDocuments,
        });
        break;
      }

      case "projet": {
        const donnéesProjet = await constl.projets.exporterDonnées({
          idProjet: spéc.idObjet,
          langues: spéc.langues,
        });
        nomFichier = donnéesProjet.nomFichier;
        if (spéc.copies) nomFichier = ajouterÉtiquetteÀNomFichier(nomFichier);

        await constl.projets.documentDonnéesÀFichier({
          données: donnéesProjet,
          formatDoc: spéc.formatDoc,
          dossier,
          inclureDocuments: spéc.inclureDocuments,
        });
        break;
      }

      case "nuée": {
        const donnéesNuée = await constl.nuées.exporterDonnéesNuée({
          idNuée: spéc.idObjet,
          langues: spéc.langues,
          nRésultatsDésirés: spéc.nRésultatsDésirés,
          héritage: spéc.héritage,
        });
        nomFichier = donnéesNuée.nomFichier;
        if (spéc.copies) nomFichier = ajouterÉtiquetteÀNomFichier(nomFichier);

        await constl.bds.documentDonnéesÀFichier({
          données: donnéesNuée,
          formatDoc: spéc.formatDoc,
          dossier,
          inclureDocuments: spéc.inclureDocuments,
        });
        break;
      }

      default:
        throw new Error(spéc);
    }

    // Effacer les sauvegardes plus vieilles si nécessaire
    const correspondants = fs.readdirSync(dossier).filter((x) => {
      try {
        return (
          fs.statSync(x).isFile() &&
          nomsCorrespondent(path.basename(x), nomFichier)
        );
      } catch {
        return false;
      }
    });
    const nomsCorrespondent = (nom: string, réf: string): boolean => {
      const ext = nom.split(".").pop() || "";
      const nomBase = nom
        .slice(0, -(ext?.length + 1))
        .split("-")
        .slice(0, -1)
        .join("");
      return `${nomBase}.${ext}` === réf;
    };

    if (spéc.copies) {
      if (spéc.copies.type === "n") {
        const enTrop = spéc.copies.n - correspondants.length;
        if (enTrop > 0) {
          const fichiersAvecTempsModif = correspondants.map((fichier) => ({
            temps: new Date(fs.statSync(fichier).mtime).valueOf(),
            fichier,
          }));
          const fichiersOrdreModif = fichiersAvecTempsModif.sort((a, b) =>
            a.temps > b.temps ? 1 : -1,
          );
          const àEffacer = fichiersOrdreModif
            .slice(enTrop)
            .map((x) => x.fichier);
          àEffacer.forEach((fichier) => fs.rmSync(fichier));
        }
      } else if (spéc.copies.type === "temps") {
        const maintenant = Date.now();
        const { temps } = spéc.copies;
        const àEffacer = correspondants.filter((fichier) => {
          const dateModifFichier = new Date(
            fs.statSync(fichier).mtime,
          ).valueOf();
          return maintenant - dateModifFichier < obtTempsInterval(temps);
        });
        àEffacer.forEach((fichier) => fs.rmSync(fichier));
      }
    }
  };
};

export const obtTempsInterval = (fréq: FréquenceFixe): number => {
  const { n, unités } = fréq.détails;
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

export const chronomètre = async ({
  id,
  auto,
  constl,
  f,
}: {
  id: string;
  auto: SpécificationAutomatisation;
  constl: Constellation;
  f: () => Promise<void>;
}): Chronomètre => {
  if (auto.fréquence.type === "manuelle") {
    return await chronoManuel(f);
  } else if (auto.fréquence.type === "fixe") {
    return await chronoFixe(f, auto.fréquence);
  } else if (auto.fréquence.type === "dynamique") {
    return await chronoDynamique(f, auto);
  }

  return;

  const clefStockageDernièreFois = `auto: ${id}`;
};

const étatErreur = (e: Error, prochain?: number): ÉtatErreur => {
  return {
    type: "erreur",
    erreur: JSON.stringify(
      {
        nom: e.name,
        message: e.message,
        pile: e.stack,
        cause: e.cause,
      },
      undefined,
      2,
    ),
    prochaineProgramméeÀ: prochain,
  };
};

export const chronoManuel = async (
  f: () => Promise<void>,
  suiviÉtat: Suivi<ÉtatAutomatisation>,
): Chronomètre => {
  const queue = schéduler();

  const nouvelÉtat: ÉtatAttente = {
    type: "attente",
  };
  await suiviÉtat(nouvelÉtat);

  const fAvecÉtats = async () => {
    const nouvelÉtat: ÉtatEnSync = {
      type: "sync",
      depuis: new Date().getTime(),
    };
    await suiviÉtat(nouvelÉtat);
    try {
      await f();
    } catch (e) {
      await suiviÉtat(étatErreur(e));
    }
  };

  return {
    fermer: async () => await queue.vide(),
    relancer: () => queue.ajouter(fAvecÉtats),
  };
};

export const obtTempsDernièreFois = async (clef: string): Promise<number> => {
  // À faire : Accéder stockage à travers `automatisations.service("stockage")`
  const dernièreFoisChaîne =
    await constl.services["stockage"].obtenirItem(clef);
  const dernièreFois = dernièreFoisChaîne
    ? parseInt(dernièreFoisChaîne)
    : -Infinity;

  return isNaN(dernièreFois) ? -Infinity : dernièreFois;
};

export const chronoFixe = async (
  f: () => Promise<void>,
  fréquence: FréquenceFixe,
  suiviÉtat: Suivi<ÉtatAutomatisation>,
): Chronomètre => {
  const queue = schéduler();
  const annuler = new AbortController();

  const fréquenceEnMS = obtTempsInterval(fréquence);

  const dernièreFois = obtTempsDernièreFois(clef);
  const tempsAvantPremière =
    dernièreFois === undefined ? Math.max(fréquenceEnMS - dernièreFois, 0) : 0;

  const maintenant = Date.now();
  const nouvelÉtat: ÉtatProgrammée = {
    type: "programmée",
    à: maintenant + tempsAvantPremière,
  };
  await suiviÉtat(nouvelÉtat);

  const fRépétée = async () => {
    try {
      await f();
    } catch (e) {
      const prochain = Date.now() + fréquenceEnMS;
      await suiviÉtat(étatErreur(e, prochain));
    }

    if (!annuler.signal.aborted)
      chrono = setTimeout(() => queue.ajouter(fRépétée), fréquenceEnMS);
  };

  let chrono = setTimeout(() => queue.ajouter(fRépétée), tempsAvantPremière);

  const fermer = async () => {
    annuler.abort();
    clearTimeout(chrono);
    await queue.vide();
  };

  const relancer = () => {
    clearTimeout(chrono);
    queue.ajouter(fRépétée);
  };

  return {
    fermer,
    relancer,
  };
};

export const chronoDynamique = async (
  f: () => Promise<void>,
  auto: SpécificationAutomatisation,
): Chronomètre => {
  if (auto.type === "importation")
    return await chronoDynamiqueImportation(f, auto);
  else return await chronoDynamiqueExportation(f, auto);
};

export const chronoDynamiqueImportation = async (
  f: () => Promise<void>,
  auto: SpécificationImporter,
  suiviÉtat: Suivi<ÉtatAutomatisation>,
): Chronomètre => {
  const nouvelÉtat: ÉtatÉcoute = {
    type: "écoute",
  };
  await suiviÉtat(nouvelÉtat);

  switch (auto.source.typeSource) {
    case "fichier": {
      if (!isNode && !isElectronMain) {
        throw new Error(MESSAGE_NON_DISPO_NAVIGATEUR);
      }
      const chokidar = await import("chokidar");
      const fs = await import("fs");
      const { adresseFichier } = auto.source;

      const adresseFichierRésolue =
        await constl.automatisations.résoudreAdressePrivéeFichier({
          clef: adresseFichier,
        });
      if (!adresseFichierRésolue || !fs.existsSync(adresseFichierRésolue))
        throw new Error(`Fichier ${adresseFichier} introuvable.`);

      const écouteur = chokidar.watch(adresseFichierRésolue);
      const lorsqueFichierModifié = () => {
        const maintenant = new Date().getTime().toString();
        f(maintenant);
      };

      const oublierChangements = appelerLorsque({
        émetteur: écouteur as TypedEmitter<{
          [K in keyof FSWatcherEventMap]: (
            ...args: FSWatcherEventMap[K]
          ) => void;
        }>,
        événement: "change",
        f: lorsqueFichierModifié,
      });

      const dernièreModif = fs.statSync(adresseFichierRésolue).mtime.getTime();

      // À faire : Accéder stockage à travers `automatisations.service("stockage")`
      const dernièreImportation = await constl.services["stockage"].obtenirItem(
        clefStockageDernièreFois,
      );
      const fichierModifié = dernièreImportation
        ? dernièreModif > parseInt(dernièreImportation)
        : true;
      if (fichierModifié) {
        const maintenant = new Date().getTime().toString();
        f(maintenant);
      }

      const fermer = async () => {
        await oublierChangements();
        await écouteur.close();
      };
      return { fermer, relancer: f };
    }

    case "url": {
      const étatErreur: ÉtatErreur = {
        type: "erreur",
        erreur:
          "La fréquence d'une automatisation d'importation d'URL doit être spécifiée.",
        prochaineProgramméeÀ: undefined,
      };
      fÉtat(étatErreur);
      return {
        fermer: faisRien,
        relancer: f,
      };
    }

    default:
      throw new Error(auto.source);
  }
};

export const chronoDynamiqueExportation = async (
  f: () => Promise<void>,
  auto: SpécificationExporter,
  suiviÉtat: Suivi<ÉtatAutomatisation>,
): Chronomètre => {
  const queue = schéduler();
  const nouvelÉtat: ÉtatÉcoute = {
    type: "écoute",
  };
  await suiviÉtat(nouvelÉtat);

  const oublierChangements =
    auto.typeObjet === "nuée"
      ? await constl.nuées.suivreEmpreinteTêtesBdsNuée({
          idNuée: auto.idObjet,
          f: () => queue.ajouter(f),
        })
      : await constl.orbite.suivreEmpreinteTêtesBdRécursive({
          idBd: auto.idObjet,
          f: () => queue.ajouter(f),
        });

  const fermer = async () => {
    await oublierChangements();
    await queue.vide();
  };

  const relancer = () => {
    queue.ajouter(f);
  };

  return {
    fermer,
    relancer,
  };
};

export const obtDonnéesImportation = async <
  T extends InfoImporterJSON | InfoImporterFeuilleCalcul,
>(
  spéc: SpécificationImporter<T>,
  résoudreAdresse: (x?: string) => Promise<string | undefined> = async (x) => x,
) => {
  const { typeSource } = spéc.source;
  const { formatDonnées } = spéc.source.info;

  switch (typeSource) {
    case "url": {
      const { url } = spéc.source;
      switch (formatDonnées) {
        case "json": {
          const { clefsRacine, clefsÉléments, cols } = spéc.source.info;
          // À faire : inclure code pour importations "spéciales" comme epicollect, etc.
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
      const { adresseFichier } = spéc.source;
      const adresseFichierRésolue = await résoudreAdresse(adresseFichier);
      if (!adresseFichierRésolue || !fs.existsSync(adresseFichierRésolue))
        throw new Error(
          `Fichier ${adresseFichierRésolue || adresseFichier} introuvable.`,
        );

      switch (formatDonnées) {
        case "json": {
          const { clefsRacine, clefsÉléments, cols } = spéc.source.info;

          const contenuFichier = await fs.promises.readFile(
            adresseFichierRésolue,
          );
          const donnéesJson = JSON.parse(contenuFichier.toString());
          const importateur = new ImportateurDonnéesJSON(donnéesJson);

          return importateur.obtDonnées(clefsRacine, clefsÉléments, cols);
        }

        case "feuilleCalcul": {
          const { nomTableau, cols } = spéc.source.info;

          const docXLSX = XLSX.readFile(adresseFichierRésolue);
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

const schéduler = (): {
  ajouter: (f: () => Promise<void>) => void;
  vide: () => Promise<void>;
} => {
  let prochain: (() => Promise<void>) | undefined = undefined;
  let enCours: (() => Promise<void>) | undefined = undefined;

  const événements = new TypedEmitter<{ vide: () => void }>();

  const suivant = () => {
    if (prochain) {
      enCours = prochain;
      prochain = undefined;
      enCours().then(suivant);
    } else {
      enCours = undefined;
      événements.emit("vide");
    }
  };

  return {
    ajouter: (f: () => Promise<void>) => {
      prochain = f;
      if (!enCours) {
        suivant();
      }
    },
    vide: () => new Promise((résoudre) => événements.once("vide", résoudre)),
  };
};
