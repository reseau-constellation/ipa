import path from "path";
import { write as xlsxWrite, writeFile as xlsxWriteFile } from "xlsx";
import { isBrowser, isElectronMain, isNode, isWebWorker } from "wherearewe";
import fileSaver from "file-saver";
import toBuffer from "it-to-buffer";
import { idcValide, zipper } from "@constl/utils-ipa";
import { TimeoutController } from "timeout-abort-controller";
import Base64 from "crypto-js/enc-base64url.js";
import md5 from "crypto-js/md5.js";
import type { DagCborEncodable } from "@orbitdb/core";
import type { NestedValueWithUndefined } from "@orbitdb/nested-db";
import type { SansNonDéfinis } from "./types.js";
import type xlsx from "xlsx";

const { saveAs } = fileSaver;

export type DonnéesFichierBdExportées = {
  docu: xlsx.WorkBook;
  documentsMédias: Set<string>;
  nomFichier: string;
};

export const conversionsTypes: { [key: string]: xlsx.BookType } = {
  xls: "biff8",
};

export const obtIdIndex = (
  v: { [clef: string]: DagCborEncodable },
  colsIndex: string[],
): string => {
  const valsIndex = Object.fromEntries(
    Object.entries(v).filter((x) => colsIndex.includes(x[0])),
  );
  return Base64.stringify(md5(JSON.stringify(valsIndex)));
};

export const sauvegarderDonnéesExportées = async ({
  données,
  formatDocu,
  obtItérableAsyncSFIP,
  dossier = "",
  inclureDocuments = true,
  dossierMédias = "médias",
}: {
  données: DonnéesFichierBdExportées;
  formatDocu: xlsx.BookType | "xls";
  obtItérableAsyncSFIP: (args: {
    id: string;
    signal?: AbortSignal;
  }) => Promise<AsyncIterable<Uint8Array>>;
  dossier?: string;
  inclureDocuments?: boolean;
  dossierMédias?: string;
}): Promise<string> => {
  const { docu: doc, documentsMédias, nomFichier } = données;

  const bookType: xlsx.BookType = conversionsTypes[formatDocu] || formatDocu;

  // Créer le dossier si nécessaire. Sinon, xlsx n'écrit rien, et ce, sans se plaindre.
  if (!(isBrowser || isWebWorker)) {
    const fs = await import("fs");
    if (!fs.existsSync(dossier)) {
      // Mais juste si on n'est pas dans le navigateur ! Dans le navigateur, ça télécharge sans problème.
      fs.mkdirSync(dossier, { recursive: true });
    }
  }

  if (inclureDocuments) {
    const adresseFinale = path.join(dossier, `${nomFichier}.zip`);

    const fichierDoc = {
      octets: xlsxWrite(doc, { bookType, type: "buffer" }),
      nom: `${nomFichier}.${formatDocu}`,
    };
    const fichiersDeSFIP = (
      await Promise.allSettled(
        [...documentsMédias].map(async (fichier) => {
          const chrono = new TimeoutController(5000);
          const itérable = await obtItérableAsyncSFIP({
            id: fichier,
            signal: chrono.signal,
          });
          chrono.clear();

          return {
            nom: fichier.replace("/", "-"),
            octets: await toBuffer(itérable),
          };
        }),
      )
    )
      .filter(
        // On ignore les fichiers qui n'ont pas pu être trouvés sur le réseau
        (x): x is PromiseFulfilledResult<{ nom: string; octets: Uint8Array }> =>
          x.status === "fulfilled" && !!x.value.octets,
      )
      .map((x) => x.value);

    // Effacer le fichier s'il existe déjà (uniquement nécessaire pour `zipper`)
    if (!(isBrowser || isWebWorker)) {
      const fs = await import("fs");
      if (fs.existsSync(adresseFinale)) {
        fs.rmSync(adresseFinale);
      }
    }
    await zipper({
      fichiersDocus: [fichierDoc],
      fichiersMédias: fichiersDeSFIP,
      nomFichier: path.join(dossier, nomFichier),
      dossierMédias,
    });
    return adresseFinale;
  } else {
    const nomFichierAvecExt = `${nomFichier}.${formatDocu}`;
    const adresseFinale =
      isNode || isElectronMain
        ? path.join(dossier, nomFichierAvecExt)
        : nomFichierAvecExt;

    if (isNode || isElectronMain) {
      xlsxWriteFile(doc, adresseFinale, {
        bookType,
      });
    } else {
      const document = xlsxWrite(doc, {
        bookType,
        type: "buffer",
      }) as ArrayBuffer;
      saveAs(new Blob([new Uint8Array(document)]), nomFichierAvecExt);
    }
    return adresseFinale;
  }
};

export const diviserIdcEtFichier = (val: string) => {
  const premièreBarreOblique = val.indexOf("/");

  if (premièreBarreOblique === -1)
    // eslint-disable-next-line no-irregular-whitespace
    throw new Error(`Chemin IDC et fichier non valide : ${val}`);

  const idc = val.slice(0, premièreBarreOblique);
  const fichier = val.slice(premièreBarreOblique + 1);

  return { idc, fichier };
};

export const idcEtFichierValide = (val: string) => {
  let idc: string;
  let fichier: string;

  try {
    ({ idc, fichier } = diviserIdcEtFichier(val));
  } catch {
    return false;
  }

  if (!fichier) return false;
  if (!idcValide(idc)) return false;
  return { idc, fichier };
};

export const moyenne = (x: (number | undefined)[]): number => {
  const définis = x.filter((y): y is number => y !== undefined && !isNaN(y));
  return définis.reduce((a, b) => a + b, 0) / définis.length;
};

export const justeDéfinis = <T>(x: (T | undefined)[]): T[] => {
  return x.filter((y): y is T => !!y);
};

export const PROTOCOLE_ORBITE = "/orbitdb/";

export const ajouterPréfixeOrbite = (id: string) =>
  id.startsWith(PROTOCOLE_ORBITE) ? id : `${PROTOCOLE_ORBITE}${id}`;

export const enleverPréfixeOrbite = (id: string) =>
  id.startsWith(PROTOCOLE_ORBITE) ? id.replace(PROTOCOLE_ORBITE, "") : id;

export const ajouterPréfixes = (id: string, préfix: string): string => {
  if (!id.startsWith(préfix) && !id.startsWith(PROTOCOLE_ORBITE))
    id = `${PROTOCOLE_ORBITE}${id}`;

  if (!préfix.startsWith("/")) préfix = `/${préfix}`;
  if (!id.startsWith("/")) id = `/${id}`;
  if (!id.startsWith(`${préfix}`)) id = `${préfix}${id}`;

  return id;
};

export const enleverPréfixes = (id: string): string => {
  const composantes = id.split("/");
  return id.includes("/")
    ? "/" + composantes.slice(composantes.indexOf("orbitdb")).join("/")
    : id;
};

export const enleverPréfixesEtOrbite = (id: string): string => {
  return enleverPréfixeOrbite(enleverPréfixes(id));
};

export const définis = <T extends NestedValueWithUndefined>(
  x: T,
): SansNonDéfinis<T> => {
  return Object.fromEntries(
    Object.entries(x).filter(([_, v]) => v !== undefined),
  ) as SansNonDéfinis<T>;
};
