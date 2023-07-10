import { isNode, isElectronMain } from "wherearewe";
import { v4 as uuidv4 } from "uuid";

export const dossierRessourcesTests = async (): Promise<string> => {
  const path = await import("path");
  return path.resolve(path.dirname(""), "src", "utilsTests", "ressources");
};

export const dossierTempoTests = async (): Promise<{
  dossier: string;
  fEffacer: () => void;
}> => {
  if (isNode || isElectronMain) {
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const rimraf = (await import("rimraf")).default;

    const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "constl-ipa"));
    const fEffacer = () => rimraf.sync(dossier);
    return { dossier, fEffacer };
  } else {
    const dossier = uuidv4() + "/constl-ipa";
    return {
      dossier,
      fEffacer: () => {
        // Rien à faire, je crois
      },
    };
  }
};

export const obtDirTempoPourTest = async ({
  base,
  nom,
}: {
  base: string;
  nom?: string;
}): Promise<string> => {
  if (isNode || isElectronMain) {
    const fs = await import("fs");
    const path = await import("path");

    const dossier = path.resolve(base, (nom || "") + uuidv4());
    fs.mkdirSync(dossier, { recursive: true });
    return dossier;
  } else {
    const dossier = base + "/" + (nom || "") + uuidv4();
    return dossier;
  }
};
