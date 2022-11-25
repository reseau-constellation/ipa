import { v4 as uuidv4 } from "uuid";
import { EventEmitter } from "events";
import { isElectronMain } from "wherearewe";
import path from "path";
import { readFileSync } from "fs";
import { writeFile } from "fs/promises";
import Semaphore from "@chriscdn/promise-semaphore";

let _localStorage: LocalStorage;

class LocalStorage {
  fichier: string;
  _données: { [clef: string]: string };
  _événements: EventEmitter;
  _idRequèteSauvegarde?: string;
  verrou: Semaphore;
  fOublier?: () => void;

  constructor(dossier: string) {
    this.fichier = path.join(dossier, "données.json");
    this._événements = new EventEmitter();
    this.verrou = new Semaphore();
    try {
      this._données = JSON.parse(readFileSync(this.fichier).toString());
    } catch {
      this._données = {};
    }
    const fSuivre = () => {
      const id = uuidv4();
      this._idRequèteSauvegarde = id;
      this.sauvegarder(id);
    };
    this._événements.on("sauvegarder", fSuivre);
    this.fOublier = () => this._événements.off("sauvegarder", fSuivre);
  }
  getItem(clef: string): string {
    return this._données[clef];
  }
  setItem(clef: string, val: string) {
    this._données[clef] = val;
    this.demanderSauvegarde();
  }
  demanderSauvegarde() {
    this._événements.emit("sauvegarder");
  }
  removeItem(clef: string): void {
    delete this._données[clef];
    this.demanderSauvegarde();
  }
  async sauvegarder(id: string): Promise<void> {
    await this.verrou.acquire("sauvegarder");
    if (this._idRequèteSauvegarde !== id) {
      this.verrou.release("sauvegarder");
      return;
    }
    await writeFile(this.fichier, JSON.stringify(this._données));
    this.verrou.release("sauvegarder");
  }

  async fermer(): Promise<void> {
    await this.verrou.acquire("sauvegarder");
    this.fOublier && this.fOublier();
    this.verrou.release("sauvegarder");
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
