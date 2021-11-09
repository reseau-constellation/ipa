import estÉlectron from "is-electron";
import path from "path";

let _localStorage: Storage

export default async (): Promise<Storage> => {
  if (typeof localStorage === "undefined" || localStorage === null) {
    if (_localStorage) return _localStorage;

    let DOSSIER_STOCKAGE_LOCAL: string;

    if (estÉlectron()) {
      const electron = await import("electron");
      DOSSIER_STOCKAGE_LOCAL = path.join(
        electron.default.app.getPath('userData'), "_stockageTemp"
      );
    } else {
      DOSSIER_STOCKAGE_LOCAL = path.join(".", "_stockageTemp");
    }

    const LocalStorage = require("node-localstorage").LocalStorage;

    _localStorage = new LocalStorage(DOSSIER_STOCKAGE_LOCAL);
    return _localStorage;
  } else {
    return localStorage
  }
}
