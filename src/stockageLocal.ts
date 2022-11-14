import { isElectronMain } from "wherearewe";
import path from "path";
import { readFileSync } from "fs";
import { writeFile } from "fs/promises";

let _localStorage: LocalStorage;

class LocalStorage {
  fichier: string;
  _données: { [clef: string]: string };

  constructor(dossier: string) {
    this.fichier = path.join(dossier, "données.json");
    try {
      this._données = JSON.parse(readFileSync(this.fichier).toString());
    } catch {
      this._données = {};
    }
  }
  getItem(clef: string): string {
    return this._données[clef];
  }
  setItem(clef: string, val: string) {
    this._données[clef] = val;
    this.sauvegarder();
  }
  removeItem(clef: string): void {
    delete this._données[clef];
    this.sauvegarder();
  }
  async sauvegarder(): Promise<void> {
    await writeFile(this.fichier, JSON.stringify(this._données));
  }
}

export default async (dossier?: string): Promise<Storage | LocalStorage> => {
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
