import oùSommesNous from "wherearewe";
import path from "path";

let _localStorage: Storage;

export default async (dossier?: string): Promise<Storage> => {
  if (typeof localStorage === "undefined" || localStorage === null) {
    if (_localStorage) return _localStorage;

    let DOSSIER_STOCKAGE_LOCAL: string;

    if (oùSommesNous.isElectronMain) {
      const electron = await import("electron");
      const nomDossier = dossier || "_stockageTemp"
      DOSSIER_STOCKAGE_LOCAL = path.join(
        electron.default.app.getPath("userData"),
        nomDossier
      );
    } else {
      const nomDossier = dossier || path.join(".", "_stockageTemp")
      DOSSIER_STOCKAGE_LOCAL = nomDossier;
    }

    const LocalStorage = require("node-localstorage").LocalStorage;

    _localStorage = new LocalStorage(DOSSIER_STOCKAGE_LOCAL);
    return _localStorage;
  } else {
    return localStorage;
  }
};
