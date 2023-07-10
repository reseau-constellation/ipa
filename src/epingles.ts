import type { default as ClientConstellation } from "@/client.js";
import {
  schémaFonctionOublier,
  élémentsBd,
  adresseOrbiteValide,
  cidValide,
} from "@/utils/index.js";

interface RequèteÉpingle {
  id: string;
  fOublier: schémaFonctionOublier | (() => Promise<void>);
  parent?: string;
}

export default class Épingles {
  client: ClientConstellation;
  requètes: RequèteÉpingle[];
  fsOublier: { [key: string]: schémaFonctionOublier };

  constructor({ client }: { client: ClientConstellation }) {
    this.client = client;
    this.requètes = [];
    this.fsOublier = {};
  }

  async épinglerBd({
    id,
    récursif = false,
    fichiers = true,
  }: {
    id: string;
    récursif?: boolean;
    fichiers?: boolean;
  }): Promise<void> {
    if (await this.directementÉpinglée({ id })) return;

    await this._épingler({ id, récursif, fichiers });
  }

  async désépinglerBd({ id }: { id: string }) {
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
          await this.désépinglerBd({ id: d.id });
        }
      })
    );
  }

  async épinglée({ id }: { id: string }): Promise<boolean> {
    return this.requètes.some((r) => r.id === id);
  }

  async épingléeParParent({
    id,
    parent,
  }: {
    id: string;
    parent?: string;
  }): Promise<boolean> {
    return this.requètes.some((r) => r.id === id && r.parent === parent);
  }

  async directementÉpinglée({ id }: { id: string }): Promise<boolean> {
    return await this.épingléeParParent({ id });
  }

  async épingles(): Promise<Set<string>> {
    return new Set(this.requètes.map((r) => r.id));
  }

  async _épingler({
    id,
    récursif,
    fichiers,
    parent,
  }: {
    id: string;
    récursif: boolean;
    fichiers: boolean;
    parent?: string;
  }): Promise<void> {
    if (await this.épingléeParParent({ id, parent })) return;

    const { bd, fOublier } = await this.client.ouvrirBd({ id });
    this.requètes.push({ id, parent, fOublier });

    if (récursif) {
      const fSuivre = async (vals: élémentsBd) => {
        // Cette fonction détectera les éléments d'une liste ou d'un dictionnaire
        // (à un niveau de profondeur) qui représentent une adresse de BD Orbit.
        let l_vals: string[] = [];
        if (typeof vals === "object") {
          l_vals = Object.values(vals).filter(
            (v) => typeof v === "string"
          ) as string[];
          l_vals.push(
            ...Object.keys(vals).filter((v) => typeof v === "string")
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
            // Pas async car le contenu correspondant au CID n'est peut-être pas disponible au moment
            // (Sinon ça bloquerait tout le programme en attendant de trouver le contenu sur le réseau SFIP !)
            this.client.sfip!.pin.add(id_);

            const fOublier_ = async () => {
              // rm par contre peut être async
              try {
                await this.client.sfip!.pin.rm(id_);
              } catch {
                // Ignorer erreur si id_ n'était pas épinglé sur SFIP
              }
            };
            this.requètes.push({ id: id_, parent: id, fOublier: fOublier_ });
          });
        }

        await Promise.all(
          idsOrbite.map(
            async (id_) =>
              await this._épingler({ id: id_, récursif, fichiers, parent: id })
          )
        );
      };

      if (bd.type === "keyvalue") {
        const fOublierBd = await this.client.suivreBdDic({ id, f: fSuivre });
        this.fsOublier[id] = fOublierBd;
      } else if (bd.type === "feed") {
        const fOublierBd = await this.client.suivreBdListe({ id, f: fSuivre });
        this.fsOublier[id] = fOublierBd;
      }
    }
  }

  async toutDésépingler(): Promise<void> {
    const épingles = await this.épingles();
    await Promise.all(
      [...épingles].map(async (id) => {
        await this.désépinglerBd({ id });
      })
    );
  }

  async fermer(): Promise<void> {
    await Promise.all(Object.values(this.fsOublier).map((f) => f()));
  }
}
