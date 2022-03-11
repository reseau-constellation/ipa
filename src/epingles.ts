import ClientConstellation from "@/client";
import {
  schémaFonctionOublier,
  élémentsBd,
  adresseOrbiteValide,
  cidValide,
} from "@/utils";

interface RequèteÉpingle {
  id: string;
  fOublier: schémaFonctionOublier | (() => Promise<void>);
  parent?: string;
}

export default class Épingles {
  client: ClientConstellation;
  requètes: RequèteÉpingle[];
  fsOublier: { [key: string]: schémaFonctionOublier };

  constructor(client: ClientConstellation) {
    this.client = client;
    this.requètes = [];
    this.fsOublier = {};
  }

  async épinglerBd(
    id: string,
    récursif = true,
    fichiers = true
  ): Promise<void> {
    if (this.épinglée(id)) return;

    await this._épingler(id, récursif, fichiers);
  }

  async désépinglerBd(id: string) {
    await Promise.all(
      this.requètes
        .filter((r) => r.id === id)
        .map(async (r) => await r.fOublier())
    );
    const dépendants = this.requètes.filter((r) => r.parent === id);

    this.requètes = this.requètes.filter((r) => r.id !== id);
    this.requètes = this.requètes.filter((r) => r.parent !== id);

    await Promise.all(
      dépendants.map(async (d) => {
        if (
          !this.requètes.filter((r) => r.id === d.id && r.parent !== id).length
        ) {
          await this.désépinglerBd(d.id);
        }
      })
    );
  }

  épinglée(id: string): boolean {
    return this.requètes.some((r) => r.id === id);
  }

  épingles(): Set<string> {
    return new Set(this.requètes.map((r) => r.id));
  }

  async _épingler(
    id: string,
    récursif: boolean,
    fichiers: boolean,
    parent?: string
  ): Promise<void> {
    if (this.épinglée(id)) return;

    const { bd, fOublier } = await this.client.ouvrirBd(id);
    this.requètes.push({ id, parent, fOublier });

    if (récursif) {
      const fSuivre = async (vals: élémentsBd) => {
        // Cette fonction détectera les éléments d'une liste ou d'un dictionnaire
        // (à un niveau de profondeur) qui représentent une adresse de BD Orbit.
        let l_vals: string[] = [];
        if (typeof vals === "object") {
          await Promise.all(
            (l_vals = Object.values(vals).filter(
              (v) => typeof v === "string"
            ) as string[])
          );
        } else if (Array.isArray(vals)) {
          l_vals = vals;
        } else if (typeof vals === "string") {
          l_vals = [vals];
        }
        const idsOrbite = l_vals.filter((v) => adresseOrbiteValide(v));

        if (fichiers) {
          // Épingler les fichiers si nécessaire
          const cids = l_vals.filter(
            (v) => cidValide(v) && !idsOrbite.includes(v)
          );

          cids.forEach((id_) => {
            // pas async car le contenu correspondant au CID n'est peut-être pas disponible au moment
            // (sinon ça bloquerait tout le programme en attendant de trouver le contenu sur le réseau SFIP !)
            this.client.sfip!.pin.add(id_);

            const fOublier_ = async () => {
              // rm par contre peut être async
              try {
                await this.client.sfip!.pin.rm(id_);
              } catch {
                // ignorer erreur si id_ n'était pas épinglé sur SFIP
              }
            };
            this.requètes.push({ id: id_, parent: id, fOublier: fOublier_ });
          });
        }

        await Promise.all(
          idsOrbite.map(
            async (id_) => await this._épingler(id_, récursif, fichiers, id)
          )
        );
      };

      if (bd.type === "keyvalue") {
        const fOublierBd = await this.client.suivreBdDic(id, fSuivre);
        this.fsOublier[id] = fOublierBd;
      } else if (bd.type === "feed") {
        const fOublierBd = await this.client.suivreBdListe(id, fSuivre);
        this.fsOublier[id] = fOublierBd;
      }
    }
  }

  async toutDésépingler(): Promise<void> {
    await Promise.all(
      [...this.épingles()].map(async (é) => {
        await this.désépinglerBd(é);
      })
    );
  }

  async fermer(): Promise<void> {
    Object.values(this.fsOublier).map(async (f) => f());
  }
}
