import electron from "electron";
import estÉlectron from "is-electron";
import path from "path";

declare let localStorage: any;

export const DOSSIER_STOCKAGE_LOCAL = path.join(
  estÉlectron() ? electron.app.getPath('userData') : ".", "_stockageTemp"
);

let final: any;

if (typeof localStorage === "undefined" || localStorage === null) {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const LocalStorage = require("node-localstorage").LocalStorage;
  final = new LocalStorage(DOSSIER_STOCKAGE_LOCAL);
} else {
  final = localStorage;
}

export default final;
