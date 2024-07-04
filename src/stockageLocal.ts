import { v4 as uuidv4 } from "uuid";
import { EventEmitter } from "events";
import path from "path";
import fs from "fs";
import Semaphore from "@chriscdn/promise-semaphore";

const stockagesLocaux: { [dossier: string]: LocalStorage } = {};

class LocalStorage {
  fichier: string;
  _données: { [clef: string]: string };
  _événements: EventEmitter;
  _idRequêteSauvegarde?: string;
  verrou: Semaphore;
  fOublier?: () => void;

  constructor(dossier: string) {
    this.fichier = path.join(dossier, "données.json");
    this._événements = new EventEmitter();
    this.verrou = new Semaphore();
    if (!fs.existsSync(dossier)) {
      fs.mkdirSync(dossier, { recursive: true });
    }
    try {
      this._données = JSON.parse(fs.readFileSync(this.fichier).toString());
    } catch {
      this._données = {};
    }
    const fSuivre = () => {
      const id = uuidv4();
      this._idRequêteSauvegarde = id;
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
  clear(): void {
    this._données = {};
    fs.rmSync(this.fichier);
  }
  async sauvegarder(id: string): Promise<void> {
    await this.verrou.acquire("sauvegarder");
    if (this._idRequêteSauvegarde !== id) {
      this.verrou.release("sauvegarder");
      return;
    }
    await fs.promises.writeFile(this.fichier, JSON.stringify(this._données));
    this.verrou.release("sauvegarder");
  }

  async fermer(): Promise<void> {
    await this.verrou.acquire("sauvegarder");
    this.fOublier && this.fOublier();
    this.verrou.release("sauvegarder");
  }
}

export const obtStockageLocal = async (
  dossierConstellation: string,
): Promise<Storage | LocalStorage> => {
  if (typeof localStorage === "undefined" || localStorage === null) {
    const dossierStockageLocal = path.join(
      dossierConstellation,
      "stockageLocal",
    );
    if (!stockagesLocaux[dossierStockageLocal]) {
      stockagesLocaux[dossierStockageLocal] = new LocalStorage(
        dossierStockageLocal,
      );
    }
    return stockagesLocaux[dossierStockageLocal];
  } else {
    return localStorage;
  }
};
export default obtStockageLocal;

export const exporterStockageLocal = async (
  dossierConstellation: string,
): Promise<string> => {
  const stockageLocal = await obtStockageLocal(dossierConstellation);
  if (stockageLocal instanceof LocalStorage) {
    return JSON.stringify(stockageLocal._données);
  } else {
    return JSON.stringify(stockageLocal);
  }
};
