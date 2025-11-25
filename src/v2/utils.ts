import path from "path";
import { write as xlsxWrite, writeFile as xlsxWriteFile } from "xlsx";
import { isBrowser, isElectronMain, isNode, isWebWorker } from "wherearewe";
import fileSaver from "file-saver";
import toBuffer from "it-to-buffer";
import { idcValide, zipper } from "@constl/utils-ipa";
import type xlsx from "xlsx";

const { saveAs } = fileSaver;

export type DonnéesFichierBdExportées = {
  docu: xlsx.WorkBook;
  fichiersSFIP: Set<string>;
  nomFichier: string;
};

export const conversionsTypes: { [key: string]: xlsx.BookType } = {
  xls: "biff8",
};

export const sauvegarderDonnéesExportées = async ({
  données,
  formatDocu,
  obtItérableAsyncSFIP,
  dossier = "",
  inclureDocuments = true,
}: {
  données: DonnéesFichierBdExportées;
  formatDocu: xlsx.BookType | "xls";
  obtItérableAsyncSFIP: (args: {
    id: string;
  }) => Promise<AsyncIterable<Uint8Array>>;
  dossier?: string;
  inclureDocuments?: boolean;
}): Promise<string> => {
  const { docu: doc, fichiersSFIP, nomFichier } = données;

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
      await Promise.all(
        [...fichiersSFIP].map(async (fichier) => {
          return {
            nom: fichier.replace("/", "-"),
            octets: await toBuffer(await obtItérableAsyncSFIP({ id: fichier })),
          };
        }),
      )
    ).filter((x): x is { nom: string; octets: Uint8Array } => !!x.octets);
    // Effacer le fichier s'il existe déjà (uniquement nécessaire pour `zipper`)
    if (!(isBrowser || isWebWorker)) {
      const fs = await import("fs");
      if (fs.existsSync(adresseFinale)) {
        fs.rmSync(adresseFinale);
      }
    }
    await zipper([fichierDoc], fichiersDeSFIP, path.join(dossier, nomFichier));
    return adresseFinale;
  } else {
    const adresseFinale = path.join(dossier, `${nomFichier}.${formatDocu}`);
    if (isNode || isElectronMain) {
      xlsxWriteFile(doc, adresseFinale, {
        bookType,
      });
    } else {
      const document = xlsxWrite(doc, {
        bookType,
        type: "buffer",
      }) as ArrayBuffer;
      saveAs(
        new Blob([new Uint8Array(document)]),
        `${nomFichier}.${formatDocu}`,
      );
    }
    return adresseFinale;
  }
};

export const extraireEmpreinte = (adresseOrbite: string): string => {
  return adresseOrbite.replace("/orbitdb/", "");
};

export const ajouterProtocoleOrbite = (empreinte: string): string => {
  return `/orbitdb/${empreinte}`;
};

export const diviserIdcEtFichier = (val: string) => {
  const premièreBarreOblique = val.indexOf("/");

  if (premièreBarreOblique === -1)
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
