import { join } from "path";
import fs from "fs";
import {
  Nébuleuse,
  ServiceNébuleuse,
  ServicesNébuleuse,
} from "@/v2/nébuleuse/nébuleuse.js";

export class StockageLocal implements Storage {
  fichier: string;
  _données: Map<string, string>;

  constructor({ fichier }: { fichier: string }) {
    this.fichier = fichier;
    try {
      this._données = new Map(
        Object.entries(JSON.parse(fs.readFileSync(this.fichier).toString())),
      );
    } catch {
      this._données = new Map();
    }
  }
  getItem(clef: string): string | null {
    return this._données.get(clef) ?? null;
  }
  setItem(clef: string, val: string) {
    this._données.set(clef, val);
    this.sauvegarder();
  }
  removeItem(clef: string): void {
    this._données.delete(clef);
    this.sauvegarder();
  }
  clear(): void {
    this._données.clear();
    this.sauvegarder();
  }

  public get length(): number {
    return this._données.size;
  }

  key(index: number): string | null {
    return index >= this.length ? null : [...this._données.keys()][index];
  }

  jsonifier() {
    return JSON.stringify(Object.fromEntries(this._données));
  }
  sauvegarder() {
    fs.writeFileSync(this.fichier, this.jsonifier());
  }
}

const localStorageDossier = ({ dossier }: { dossier: string }) => {
  const résoudreClef = (clef: string) => `${dossier}/${clef}`;
  const clefCorrespond = (clef: string) => clef.startsWith(`${dossier}/`);

  return new Proxy(localStorage, {
    get: (target, prop) => {
      switch (prop) {
        case "getItem":
          return (clef: string) => target.getItem(résoudreClef(clef));
        case "setItem":
          return (clef: string, valeur: string) =>
            target.setItem(résoudreClef(clef), valeur);
        case "removeItem":
          return (clef: string) => target.removeItem(résoudreClef(clef));
        case "clear":
          return () => {
            const clefs = Object.keys(target);
            clefs.filter(clefCorrespond).forEach((c) => target.removeItem(c));
          };
        case "key":
          return (n: number) => {
            const clefs = Object.keys(target);
            const clefsCorrespondantes = clefs.filter(clefCorrespond);
            return clefsCorrespondantes[n] ?? null;
          };
        case "length":
          return Object.keys(target).filter(clefCorrespond).length;
        default:
          return target[prop as keyof typeof target];
      }
    },
  });
};

export class ServiceStockage extends ServiceNébuleuse<
  "stockage",
  ServicesNébuleuse,
  { stockageLocal: Storage }
> {
  constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesNébuleuse> }) {
    super({
      clef: "stockage",
      nébuleuse,
    });
  }

  async démarrer(): Promise<{ stockageLocal: Storage }> {
    let stockageLocal: Storage;

    const dossier = await this.nébuleuse.dossier();
    if (typeof localStorage === "undefined" || localStorage === null) {
      const fichier = join(dossier, "stockage.json");
      stockageLocal = new StockageLocal({ fichier });
    } else {
      stockageLocal = localStorageDossier({ dossier });
    }
    this.estDémarré = { stockageLocal };

    return await super.démarrer();
  }

  async obtenirItem(clef: string): Promise<string | null> {
    const { stockageLocal } = await this.démarré();
    return stockageLocal.getItem(clef);
  }

  async sauvegarderItem(clef: string, valeur: string): Promise<void> {
    const { stockageLocal } = await this.démarré();
    return stockageLocal.setItem(clef, valeur);
  }

  async effacerItem(clef: string) {
    const { stockageLocal } = await this.démarré();
    return stockageLocal.removeItem(clef);
  }

  async exporter() {
    const { stockageLocal } = await this.démarré();
    if (stockageLocal instanceof StockageLocal) {
      return stockageLocal.jsonifier();
    } else return JSON.stringify(stockageLocal);
  }
}
