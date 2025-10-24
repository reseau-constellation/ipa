import path from "path";
import xlsx, { write as xlsxWrite, writeFile as xlsxWriteFile } from "xlsx";
import { isBrowser, isElectronMain, isNode, isWebWorker } from "wherearewe";
import fileSaver from "file-saver";
import toBuffer from "it-to-buffer";
import { zipper } from "@constl/utils-ipa";
const { saveAs } = fileSaver;

export interface DonnéesFichierBdExportées {
  doc: xlsx.WorkBook;
  fichiersSFIP: Set<string>;
  nomFichier: string;
}

export const sauvegarderDonnéesExportées = async ({
  données,
  formatDoc,
  obtItérableAsyncSFIP,
  dossier = "",
  inclureDocuments = true,
}: {
  données: DonnéesFichierBdExportées;
  formatDoc: xlsx.BookType | "xls";
  obtItérableAsyncSFIP: (args: {
    id: string;
  }) => Promise<AsyncIterable<Uint8Array>>;
  dossier?: string;
  inclureDocuments?: boolean;
}): Promise<string> => {
  const { doc, fichiersSFIP, nomFichier } = données;

  const conversionsTypes: { [key: string]: xlsx.BookType } = {
    xls: "biff8",
  };
  const bookType: xlsx.BookType = conversionsTypes[formatDoc] || formatDoc;

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
      nom: `${nomFichier}.${formatDoc}`,
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
    const adresseFinale = path.join(dossier, `${nomFichier}.${formatDoc}`);
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
        `${nomFichier}.${formatDoc}`,
      );
    }
    return adresseFinale;
  }
};
