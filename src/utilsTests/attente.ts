import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { isWebWorker } from "wherearewe";
import { isBrowser } from "wherearewe";
import type { Download } from "playwright";

export class AttendreRésultat<T> {
  val?: T;
  fsOublier: { [clef: string]: () => void };
  événements: EventEmitter;

  constructor() {
    this.événements = new EventEmitter();
    this.val = undefined;
    this.fsOublier = {};
  }

  mettreÀJour(x?: T) {
    this.val = x;
    this.événements.emit("changé");
  }

  async attendreQue(f: (x: T) => boolean): Promise<T> {
    if (this.val !== undefined && f(this.val)) return this.val;
    const id = uuidv4();

    return new Promise((résoudre) => {
      const fLorsqueChangé = () => {
        if (this.val !== undefined && f(this.val)) {
          this.oublier(id);
          résoudre(this.val);
        }
      };
      this.événements.on("changé", fLorsqueChangé);
      this.fsOublier[id] = () => this.événements.off("changé", fLorsqueChangé);
    });
  }

  async attendreExiste(): Promise<T> {
    const val = (await this.attendreQue((x) => !!x)) as T;
    return val;
  }

  oublier(id: string) {
    this.fsOublier[id]();
    delete this.fsOublier[id];
  }

  toutAnnuler() {
    Object.keys(this.fsOublier).forEach((id) => this.oublier(id));
  }
}

export class AttendreFichierExiste extends EventEmitter {
  fOublier?: () => void;
  fichier: string;
  attenteTéléchargement?: Promise<Download>;

  constructor(fichier: string) {
    super();
    this.fichier = fichier;
    if (isBrowser || isWebWorker)
      this.attenteTéléchargement = page.waitForEvent("download");
  }

  async attendre(): Promise<void> {
    if (isBrowser || isWebWorker) {
      const téléchargement = await this.attenteTéléchargement;
      if (!téléchargement) throw new Error("Erreur d'initialisation.");
      const fichier = await téléchargement.path();
      if (fichier === this.fichier) return;
      else throw new Error(`Fichier téléchargé a le nom ${fichier}, et non pas ${this.fichier}.`);
    } else {
      const chokidar = await import("chokidar");
      const fs = await import("fs");
      const path = await import("path");

      await new Promise<void>((résoudre) => {
        if (fs.existsSync(this.fichier)) résoudre();
        const dossier = path.dirname(this.fichier);
        const écouteur = chokidar.watch(dossier);
        this.fOublier = () => écouteur.close();
        écouteur.on("add", async () => {
          if (fs.existsSync(this.fichier)) {
            await écouteur.close();
            résoudre();
          }
        });
        if (fs.existsSync(this.fichier)) {
          écouteur.close();
          résoudre();
        }
      });
    }
  }

  annuler() {
    this.fOublier && this.fOublier();
  }
}

export class AttendreFichierModifié extends EventEmitter {
  fsOublier: (() => void)[];
  fichier: string;
  attendreExiste: AttendreFichierExiste;

  constructor(fichier: string) {
    super();
    this.fichier = fichier;
    this.attendreExiste = new AttendreFichierExiste(fichier);
    this.fsOublier = [];
    this.fsOublier.push(() => this.attendreExiste.annuler());
  }

  async attendre(tempsAvant: number): Promise<void> {
    await this.attendreExiste.attendre();
    const chokidar = await import("chokidar");
    const fs = await import("fs");
    return new Promise((résoudre, rejeter) => {
      const écouteur = chokidar.watch(this.fichier);
      this.fsOublier.push(() => écouteur.close());

      écouteur.on("change", async (adresse) => {
        if (adresse !== this.fichier) return;
        try {
          const { mtime } = fs.statSync(this.fichier);
          const prêt = mtime.getTime() > tempsAvant;
          if (prêt) {
            await écouteur.close();
            résoudre();
          }
        } catch (e) {
          // Le fichier a été effacé
          écouteur.close();
          rejeter(e);
        }
      });
    });
  }

  annuler() {
    this.fsOublier.forEach((f) => f());
  }
}
