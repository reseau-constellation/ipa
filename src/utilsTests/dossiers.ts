import { isNode, isElectronMain } from "wherearewe";
import { v4 as uuidv4 } from "uuid";

export const dossierRessourcesTests = async (): Promise<string> => {
  const path = await import("path");
  return path.resolve(path.dirname(""), "src", "utilsTests", "ressources");
};

export const dossierTempoTests = async (): Promise<string> => {
  if (isNode || isElectronMain) {
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    return fs.mkdtempSync(path.join(os.tmpdir(), "constl-ipa"));
  } else {
    return uuidv4() + "/constl-ipa";
  }
};

export const obtDirTempoPourTest = async (
  nom?: string
): Promise<{ dossier: string; fEffacer: () => void }> => {
  if (isNode || isElectronMain) {
    const fs = await import("fs");
    const path = await import("path");
    const rimraf = (await import("rimraf")).default;

    const dossierRacine = await dossierTempoTests();
    const dossier = path.resolve(dossierRacine, (nom || "") + uuidv4());
    fs.mkdirSync(dossier, { recursive: true });
    const fEffacer = () => rimraf.sync(dossier);
    return { dossier, fEffacer };
  } else {
    const dossier = (await dossierTempoTests()) + "/" + (nom || "") + uuidv4();
    return {
      dossier,
      fEffacer: () => {
        // Rien à faire, je crois
      },
    };
  }
};
