import { isElectronMain } from "wherearewe";
import path from "path";

let _localStorage: Storage;

export default async (dossier?: string): Promise<Storage> => {
  if (typeof localStorage === "undefined" || localStorage === null) {
    if (_localStorage) return _localStorage;

    let DOSSIER_STOCKAGE_LOCAL: string;

    if (isElectronMain) {
      const electron = await import("electron");
      DOSSIER_STOCKAGE_LOCAL =
        dossier ||
        path.join(electron.default.app.getPath("userData"), "_stockageTemp");
    } else {
      const nomDossier = dossier || path.join(".", "_stockageTemp");
      DOSSIER_STOCKAGE_LOCAL = nomDossier;
    }

    const LocalStorage = (await import("node-localstorage")).LocalStorage;

    _localStorage = new LocalStorage(DOSSIER_STOCKAGE_LOCAL);
    return _localStorage;
  } else {
    if (dossier)
      console.warn(
        "Vous avez spécifié un dossier de stockage local mais votre choix sera ignoré car nous sommes dans le navigateur."
      );
    return localStorage;
  }
};
