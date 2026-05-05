import { existsSync, mkdirSync, readFileSync } from "fs";
import { isElectronMain, isNode } from "wherearewe";
import * as XLSX from "xlsx";
import { faisRien, uneFois } from "@constl/utils-ipa";
import { TypedEmitter } from "tiny-typed-emitter";
import { ImportateurFeuilleCalcul } from "@/v2/importateur/feuille.js";
import { appelerLorsque } from "../nébuleuse/services/utils.js";
import {
  enleverPréfixesEtOrbite,
  sauvegarderDonnéesExportées,
} from "../utils.js";
import { ImportateurDonnéesJSON } from "../importateur/json.js";
import {
  importerFeuilleCalculDURL,
  importerJSONdURL,
} from "../importateur/urls.js";
import { stabiliser } from "../nébuleuse/utils.js";
import type { ÉlémentDicJSON } from "../importateur/json.js";
import type { ServicesNécessairesAutomatisations } from "./automatisations.js";
import type { FSWatcherEventMap } from "chokidar";
import type { Oublier, Suivi } from "../nébuleuse/types.js";
import type {
  FréquenceFixe,
  SpécificationAutomatisation,
  SpécificationExporter,
  SpécificationImporter,
  ÉtatAutomatisationAttente,
  ÉtatAutomatisation,
  ÉtatAutomatisationEnSync,
  ÉtatAutomatisationErreur,
  ÉtatAutomatisationProgrammée,
  ÉtatAutomatisationÉcoute,
  SourceDonnéesImportationAdresseOptionelle,
  Fréquence,
} from "./types.js";
import type { AccesseurService } from "../recherche/types.js";

if (isElectronMain || isNode) {
  import("fs").then((fs) => XLSX.set_fs(fs));
  import("stream").then((stream) => XLSX.stream.set_readable(stream.Readable));
}

export const MESSAGE_NON_DISPO_NAVIGATEUR =
  "L'automatisation de l'importation des fichiers locaux n'est pas disponible sur la version appli internet de Constellation.";

export const générerFAuto = ({
  spéc,
  service,
}: {
  spéc: SpécificationAutomatisation;
  service: AccesseurService<ServicesNécessairesAutomatisations>;
}): (() => Promise<void>) => {
  switch (spéc.type) {
    case "importation": {
      return générerFImportation({ spéc, service });
    }

    case "exportation": {
      return générerFExportation({ spéc, service });
    }

    default:
      throw new Error(spéc);
  }
};

export const générerFImportation = ({
  spéc,
  service,
}: {
  spéc: SpécificationImporter;
  service: AccesseurService<ServicesNécessairesAutomatisations>;
}): (() => Promise<void>) => {
  return async () => {
    let données: ÉlémentDicJSON[]; // À faire : améliorer type
    try {
      données = await obtDonnéesImportation(spéc);
    } catch (e) {
      throw new Error("Erreur d'importation des données : \n" + e.toString());
    }

    const tableaux = service("bds").tableaux;
    const conversions = spéc.conversions || [];

    // Adresse base des fichiers pour résoudre les entrées fichiers, si applicable. Fonctionne uniquement
    // sur Node et le processus principal d'Électron.
    const path = await import("path");
    if (spéc.source.type === "fichier" && spéc.source.adresseFichier) {
      const cheminBaseFichiers = path.dirname(spéc.source.adresseFichier);
      conversions.forEach((c) => {
        if (
          c.conversion.type === "fichier" ||
          c.conversion.type === "audio" ||
          c.conversion.type === "image" ||
          c.conversion.type === "vidéo"
        ) {
          c.conversion.baseChemin ??= cheminBaseFichiers;
        }
      });
    }

    const donnéesConverties = await tableaux.convertirDonnées({
      données,
      conversions,
    });

    await tableaux.importerDonnées({
      idStructure: spéc.idBd,
      idTableau: spéc.idTableau,
      données: donnéesConverties.converties,
    });

    if (donnéesConverties.erreurs.length)
      throw new AggregateError(
        donnéesConverties.erreurs.map((e) =>
          typeof e === "string" ? new Error(e) : e,
        ),
      );
  };
};

export const générerFExportation = ({
  spéc,
  service,
}: {
  spéc: SpécificationExporter;
  service: AccesseurService<ServicesNécessairesAutomatisations>;
}): (() => Promise<void>) => {
  return async () => {
    const fs = await import("fs");

    const { dossier } = spéc;
    if (!fs.existsSync(dossier)) {
      mkdirSync(dossier, { recursive: true });
    }

    const ajouterÉtiquetteÀNomFichier = (
      nom: string,
      idObjet: string,
    ): string => {
      const id = enleverPréfixesEtOrbite(idObjet);
      return `${nom === id ? nom : nom + "-" + id}-${Date.now()}`;
    };

    const hélia = service("hélia");
    const obtItérableAsyncSFIP = hélia.obtItérableAsyncSFIP.bind(hélia);

    switch (spéc.typeObjet) {
      case "tableau": {
        const donnéesTableau = await service("bds").tableaux.exporterDonnées({
          idStructure: spéc.idObjet,
          idTableau: spéc.idTableau,
          langues: spéc.langues,
        });
        if (spéc.copies)
          donnéesTableau.nomFichier = ajouterÉtiquetteÀNomFichier(
            donnéesTableau.nomFichier,
            spéc.idObjet,
          );

        await sauvegarderDonnéesExportées({
          données: donnéesTableau,
          formatDocu: spéc.formatDoc,
          dossier,
          obtItérableAsyncSFIP,
          inclureDocuments: spéc.inclureDocuments,
        });

        break;
      }

      case "bd": {
        const donnéesBd = await service("bds").exporterDonnées({
          idBd: spéc.idObjet,
          langues: spéc.langues,
        });

        if (spéc.copies)
          donnéesBd.nomFichier = ajouterÉtiquetteÀNomFichier(
            donnéesBd.nomFichier,
            spéc.idObjet,
          );

        await sauvegarderDonnéesExportées({
          données: donnéesBd,
          formatDocu: spéc.formatDoc,
          dossier,
          obtItérableAsyncSFIP,
          inclureDocuments: spéc.inclureDocuments,
        });
        break;
      }

      case "projet": {
        const donnéesProjet = await service("projets").exporterDonnées({
          idProjet: spéc.idObjet,
          langues: spéc.langues,
        });

        if (spéc.copies)
          donnéesProjet.nomFichier = ajouterÉtiquetteÀNomFichier(
            donnéesProjet.nomFichier,
            spéc.idObjet,
          );

        await service("projets").documentDonnéesÀFichier({
          données: donnéesProjet,
          formatDocu: spéc.formatDoc,
          dossier,
          inclureDocuments: spéc.inclureDocuments,
        });
        break;
      }

      case "nuée": {
        const donnéesNuée = await service("nuées").exporterDonnées({
          idNuée: spéc.idObjet,
          langues: spéc.langues,
          héritage: spéc.héritage,
        });

        if (spéc.copies)
          donnéesNuée.nomFichier = ajouterÉtiquetteÀNomFichier(
            donnéesNuée.nomFichier,
            spéc.idObjet,
          );

        await sauvegarderDonnéesExportées({
          données: donnéesNuée,
          formatDocu: spéc.formatDoc,
          dossier,
          obtItérableAsyncSFIP,
          inclureDocuments: spéc.inclureDocuments,
        });
        break;
      }

      default:
        throw new Error(spéc);
    }

    // Effacer les sauvegardes plus vieilles si nécessaire
    await nettoyerCopies(spéc);
  };
};

export const nettoyerCopies = async (auto: SpécificationExporter) => {
  const fs = await import("fs");
  const path = await import("path");

  const { dossier } = auto;
  if (!dossier || !fs.existsSync(dossier)) return;

  const nomsCorrespondent = (nom: string, réf: string): boolean => {
    return nom.startsWith(réf) || nom.includes(`-${réf}-`);
  };

  const correspondants = fs
    .readdirSync(dossier)
    .map((x) => path.join(dossier, x))
    .filter((x) => {
      try {
        return (
          fs.statSync(x).isFile() &&
          nomsCorrespondent(
            path.basename(x),
            enleverPréfixesEtOrbite(auto.idObjet),
          )
        );
      } catch {
        return false;
      }
    });

  if (auto.copies) {
    if (auto.copies.type === "n") {
      const enTrop = correspondants.length - auto.copies.n;
      if (enTrop > 0) {
        const fichiersAvecTempsModif = correspondants.map((fichier) => ({
          temps: new Date(fs.statSync(fichier).mtime).valueOf(),
          fichier,
        }));
        const fichiersOrdreModif = fichiersAvecTempsModif.sort((a, b) =>
          a.temps > b.temps ? 1 : -1,
        );
        const àEffacer = fichiersOrdreModif
          .slice(0, enTrop)
          .map((x) => x.fichier);
        àEffacer.forEach((fichier) => fs.rmSync(fichier));
      }
    } else if (auto.copies.type === "temps") {
      const { temps } = auto.copies;

      const maintenant = Date.now();
      const àEffacer = correspondants.filter((fichier) => {
        const dateModifFichier = new Date(fs.statSync(fichier).mtime).valueOf();
        return maintenant - dateModifFichier > obtTempsInterval(temps);
      });

      àEffacer.forEach((fichier) => fs.rmSync(fichier));
    }
  }
};

// Chronomètres

export const obtTempsInterval = (fréq: FréquenceFixe["détails"]): number => {
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

export type Chronomètre = {
  relancer: () => void;
  fermer: () => Promise<void>;
};

export const chronomètre = async ({
  auto,
  suiviÉtat,
  f,
  service,
}: {
  auto: SpécificationAutomatisation;
  suiviÉtat: Suivi<ÉtatAutomatisation>;
  f: () => Promise<void>;
  service: AccesseurService<ServicesNécessairesAutomatisations>;
}): Promise<Chronomètre> => {
  if (auto.type === "exportation" && auto.copies) {
    await nettoyerCopies(auto);
  }

  if (auto.fréquence.type === "manuelle") {
    return await chronoManuel({ f, suiviÉtat });
  } else if (auto.fréquence.type === "fixe") {
    return await chronoFixe({
      f,
      fréquence: auto.fréquence,
      id: auto.id,
      suiviÉtat,
      service,
    });
  } else if (auto.fréquence.type === "dynamique") {
    return await chronoDynamique({ f, auto, suiviÉtat, service });
  } else
    throw new Error(
      `Type de chronomètre inconnu : "${(auto.fréquence as Fréquence).type}"`,
    );
};

const étatErreur = (e: Error, prochain?: number): ÉtatAutomatisationErreur => {
  return {
    type: "erreur",
    erreur: e.message,
    prochaineProgramméeÀ: prochain,
  };
};

export const chronoManuel = async ({
  f,
  suiviÉtat,
}: {
  f: () => Promise<void>;
  suiviÉtat: (état: ÉtatAutomatisation) => void;
}): Promise<Chronomètre> => {
  const queue = schéduler();

  const étatAttente: ÉtatAutomatisationAttente = {
    type: "attente",
  };
  suiviÉtat(étatAttente);

  const fAvecÉtats = async () => {
    const étatSync: ÉtatAutomatisationEnSync = {
      type: "sync",
      depuis: new Date().getTime(),
    };
    suiviÉtat(étatSync);

    try {
      await f();
      suiviÉtat(étatAttente);
    } catch (e) {
      suiviÉtat(étatErreur(e));
    }
  };

  return {
    fermer: async () => await queue.vide(),
    relancer: () => queue.ajouter(fAvecÉtats),
  };
};

const obtClefStockage = (idAuto: string) => `auto: ${idAuto}`;

export const obtTempsDernièreFois = async (
  idDernièreFois?: string,
): Promise<number> => {
  const dernièreFois = idDernièreFois ? parseInt(idDernièreFois) : -Infinity;

  return isNaN(dernièreFois) ? -Infinity : dernièreFois;
};

export const chronoFixe = async ({
  f,
  fréquence,
  suiviÉtat,
  id,
  service,
}: {
  f: () => Promise<void>;
  fréquence: FréquenceFixe;
  suiviÉtat: (état: ÉtatAutomatisation) => void;
  id: string;
  service: AccesseurService<ServicesNécessairesAutomatisations>;
}): Promise<Chronomètre> => {
  const stockage = service("stockage");
  const clefStockage = obtClefStockage(id);

  const queue = schéduler();
  const annuler = new AbortController();

  const fréquenceEnMS = obtTempsInterval(fréquence.détails);
  const dernièreFois = await obtTempsDernièreFois(
    (await stockage.obtenirItem(clefStockage)) || undefined,
  );
  const tempsAvantPremière = Math.max(dernièreFois + fréquenceEnMS, 0);

  const maintenant = Date.now();
  const nouvelÉtat: ÉtatAutomatisationProgrammée = {
    type: "programmée",
    à: maintenant + tempsAvantPremière,
  };
  suiviÉtat(nouvelÉtat);

  const fAvecÉtats = async () => {
    const étatSync: ÉtatAutomatisationEnSync = {
      type: "sync",
      depuis: new Date().getTime(),
    };
    suiviÉtat(étatSync);

    const étatProgrammé: ÉtatAutomatisationProgrammée = {
      type: "programmée",
      à: Date.now() + fréquenceEnMS,
    };

    try {
      await f();
      await stockage.sauvegarderItem({
        clef: clefStockage,
        valeur: Date.now().toString(),
      });
      suiviÉtat(étatProgrammé);
    } catch (e) {
      const prochain = Date.now() + fréquenceEnMS;
      suiviÉtat(étatErreur(e, prochain));
    }
  };

  const fRépétée = async () => {
    await fAvecÉtats();
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

export const chronoDynamique = async ({
  f,
  suiviÉtat,
  auto,
  service,
}: {
  f: () => Promise<void>;
  suiviÉtat: (état: ÉtatAutomatisation) => void;
  auto: SpécificationAutomatisation;
  service: AccesseurService<ServicesNécessairesAutomatisations>;
}): Promise<Chronomètre> => {
  const étatÉcoute: ÉtatAutomatisationÉcoute = {
    type: "écoute",
  };

  const fAvecÉtats = async () => {
    const étatSync: ÉtatAutomatisationEnSync = {
      type: "sync",
      depuis: new Date().getTime(),
    };
    suiviÉtat(étatSync);

    try {
      await f();
      suiviÉtat(étatÉcoute);
    } catch (e) {
      suiviÉtat(étatErreur(e));
    }
  };

  suiviÉtat(étatÉcoute);

  if (auto.type === "importation")
    return await chronoDynamiqueImportation({
      f: fAvecÉtats,
      auto,
      suiviÉtat,
      service,
    });
  else
    return await chronoDynamiqueExportation({
      f: fAvecÉtats,
      auto,
      suiviÉtat,
      service,
    });
};

export const chronoDynamiqueImportation = async ({
  f,
  auto,
  suiviÉtat,
  service,
}: {
  f: () => Promise<void>;
  auto: SpécificationImporter;
  suiviÉtat: (état: ÉtatAutomatisation) => void;
  service: AccesseurService<ServicesNécessairesAutomatisations>;
}): Promise<Chronomètre> => {
  const queue = schéduler();

  const clefDernièreFois = obtClefStockage(auto.id);

  const fAvecStockage = async () => {
    await f();
    const maintenant = new Date().getTime().toString();
    await service("stockage").sauvegarderItem({
      clef: clefDernièreFois,
      valeur: maintenant,
    });
  };

  switch (auto.source.type) {
    case "fichier": {
      if (!isNode && !isElectronMain) {
        const étatErreur: ÉtatAutomatisationErreur = {
          type: "erreur",
          erreur: MESSAGE_NON_DISPO_NAVIGATEUR,
          prochaineProgramméeÀ: undefined,
        };
        suiviÉtat(étatErreur);
        return { fermer: async () => await queue.vide(), relancer: faisRien };
      }

      const chokidar = await import("chokidar");
      const fs = await import("fs");

      const { adresseFichier } = auto.source;

      if (!adresseFichier) {
        const étatErreur: ÉtatAutomatisationErreur = {
          type: "erreur",
          erreur: `Fichier non défini.`,
          prochaineProgramméeÀ: undefined,
        };
        suiviÉtat(étatErreur);
        return { fermer: async () => await queue.vide(), relancer: faisRien };
      }

      const écouteur = chokidar.watch(adresseFichier, {
        awaitWriteFinish: true,
        ignoreInitial: true,
      });

      await new Promise<void>((résoudre) =>
        écouteur.once("ready", () => setTimeout(résoudre, 100)),
      );

      const oublierChangements = appelerLorsque({
        émetteur: écouteur as TypedEmitter<{
          [K in keyof FSWatcherEventMap]: (
            ...args: FSWatcherEventMap[K]
          ) => void;
        }>,
        événement: ["add", "change", "unlink"],
        f: () => queue.ajouter(fAvecStockage),
      });

      if (fs.existsSync(adresseFichier)) {
        const dernièreModif = fs.statSync(adresseFichier).mtime.getTime();
        const dernièreImportation =
          await service("stockage").obtenirItem(clefDernièreFois);
        const fichierModifié = dernièreImportation
          ? dernièreModif > parseInt(dernièreImportation)
          : true;

        if (fichierModifié) {
          queue.ajouter(fAvecStockage);
        }
      } else {
        const étatErreur: ÉtatAutomatisationErreur = {
          type: "erreur",
          erreur: `Fichier ${adresseFichier} introuvable.`,
          prochaineProgramméeÀ: undefined,
        };
        suiviÉtat(étatErreur);
      }

      const fermer = async () => {
        await oublierChangements();
        await écouteur.close();
        await queue.vide();
      };
      return { fermer, relancer: () => queue.ajouter(fAvecStockage) };
    }

    case "url": {
      const étatErreur: ÉtatAutomatisationErreur = {
        type: "erreur",
        erreur:
          "La fréquence d'une automatisation d'importation d'URL doit être soit fixe, soit manuelle, mais ne peut pas être dynamique.",
        prochaineProgramméeÀ: undefined,
      };
      suiviÉtat(étatErreur);
      return {
        fermer: faisRien,
        relancer: faisRien,
      };
    }

    default:
      throw new Error(auto.source);
  }
};

export const chronoDynamiqueExportation = async ({
  f,
  auto,
  suiviÉtat,
  service,
}: {
  f: () => Promise<void>;
  auto: SpécificationExporter;
  suiviÉtat: (état: ÉtatAutomatisation) => void;
  service: AccesseurService<ServicesNécessairesAutomatisations>;
}): Promise<Chronomètre> => {
  const stockage = service("stockage");
  const bds = service("bds");
  const nuées = service("nuées");
  const projets = service("projets");

  const queue = schéduler();

  const clefDernièreFois = obtClefStockage(auto.id);

  const génFAvecStockage =
    (empreinte: string) =>
    async ({ forcer }: { forcer?: boolean } = {}) => {
      const dernièreEmpreinte = await stockage.obtenirItem(clefDernièreFois);

      if (forcer || dernièreEmpreinte !== empreinte) {
        await f();
        await stockage.sauvegarderItem({
          clef: clefDernièreFois,
          valeur: empreinte,
        });
      }
    };

  const suivreEmpreinteTête = async (f: Suivi<string>): Promise<Oublier> => {
    switch (auto.typeObjet) {
      case "tableau": {
        return await bds.tableaux.suivreEmpreinteTête({
          idStructure: auto.idObjet,
          idTableau: auto.idTableau,
          f,
        });
      }
      case "bd": {
        return await bds.suivreEmpreinteTête({
          idBd: auto.idObjet,
          f,
        });
      }
      case "nuée": {
        return await nuées.suivreEmpreinteTête({
          idNuée: auto.idObjet,
          f,
        });
      }
      case "projet": {
        return await projets.suivreEmpreinteTête({
          idProjet: auto.idObjet,
          f,
        });
      }
      default: {
        const état: ÉtatAutomatisationErreur = {
          type: "erreur",
          erreur: `Type d'objet non reconnu : ${(auto as SpécificationExporter).typeObjet}.`,
        };
        suiviÉtat(état);
        return faisRien;
      }
    }
  };
  const oublierChangements = await suivreEmpreinteTête(
    stabiliser()((empreinte) => {
      queue.ajouter(génFAvecStockage(empreinte));
    }),
  );

  const fermer = async () => {
    await oublierChangements();
    await queue.vide();
  };

  const relancer = async () => {
    queue.ajouter(async () => {
      const empreinteTête = await uneFois<string>((fEmpreinte) =>
        suivreEmpreinteTête(fEmpreinte),
      );
      await génFAvecStockage(empreinteTête)({ forcer: true });
    });
  };

  return {
    fermer,
    relancer,
  };
};

export const obtDonnéesImportation = async <
  T extends SourceDonnéesImportationAdresseOptionelle,
>(
  spéc: SpécificationImporter<T>,
  résoudreAdresse: (x?: string) => Promise<string | undefined> = async (x) => x,
) => {
  const { type } = spéc.source;
  const { formatDonnées } = spéc.source.info;

  switch (type) {
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
          const contenu = readFileSync(adresseFichierRésolue);

          const docXLSX = XLSX.read(new TextDecoder().decode(contenu), {
            type: "string",
          });

          const importateur = new ImportateurFeuilleCalcul(docXLSX);

          // `cols || {}` est nécessaire au cas où `cols` serait vide (et donc absent dans l'objet Orbite)
          return importateur.obtDonnées(nomTableau || "Sheet1", cols || {});
        }

        default:
          throw new Error(formatDonnées);
      }
    }

    default:
      throw new Error(type);
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
    vide: () =>
      new Promise((résoudre) => {
        if (!enCours && !prochain) résoudre();
        événements.once("vide", résoudre);
      }),
  };
};
