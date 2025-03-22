import fs from "fs";
import path from "path";

const stockagesLocaux: { [dossier: string]: LocalStorage } = {};

class LocalStorage {
  fichier: string;
  _données: { [clef: string]: string };

  constructor(dossier: string) {
    this.fichier = path.join(dossier, "données.json");

    if (!fs.existsSync(dossier)) {
      fs.mkdirSync(dossier, { recursive: true });
    }
    try {
      this._données = JSON.parse(fs.readFileSync(this.fichier).toString());
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
  clear(): void {
    this._données = {};
    this.sauvegarder();
  }
  async sauvegarder(): Promise<void> {
    fs.writeFileSync(this.fichier, JSON.stringify(this._données));
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
