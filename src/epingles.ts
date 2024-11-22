import type { Constellation } from "@/client.js";
import {
  schémaFonctionOublier,
  schémaFonctionSuivi,
  élémentsBd,
} from "@/types.js";
import { idcValide } from "@constl/utils-ipa";
import { isValidAddress } from "@orbitdb/core";
import { EventEmitter } from "events";
import { CID } from "multiformats";

interface RequêteÉpingle {
  id: string;
  fOublier: schémaFonctionOublier | (() => Promise<void>);
  parent?: string;
}

export const cidEtFichierValide = (val: string) => {
  let cid: string;
  let fichier: string;
  try {
    [cid, fichier] = val.split("/");
  } catch {
    return false;
  }
  if (!fichier) return false;
  if (!idcValide(cid)) return false;
  return { cid, fichier };
};

export class Épingles {
  client: Constellation;
  requêtes: RequêteÉpingle[];
  fsOublier: { [key: string]: schémaFonctionOublier };
  événements: EventEmitter;

  constructor({ client }: { client: Constellation }) {
    this.client = client;
    this.requêtes = [];
    this.fsOublier = {};
    this.événements = new EventEmitter();
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

    // On n'attend pas, au cas où la base de données ne serait pas immédiatement disponible...
    this._épingler({ id, récursif, fichiers });
  }

  async désépinglerBd({ id }: { id: string }) {
    await Promise.all(
      this.requêtes
        .filter((r) => r.id === id)
        .map(async (r) => await r.fOublier()),
    );
    const dépendants = this.requêtes.filter((r) => r.parent === id);

    this.requêtes = this.requêtes.filter((r) => r.id !== id);
    this.requêtes = this.requêtes.filter((r) => r.parent !== id);

    await Promise.all(
      dépendants.map(async (d) => {
        if (
          !this.requêtes.filter((r) => r.id === d.id && r.parent !== id).length
        ) {
          await this.désépinglerBd({ id: d.id });
        }
      }),
    );
    this.événements.emit("changement épingles");
  }

  async épinglée({ id }: { id: string }): Promise<boolean> {
    return this.requêtes.some((r) => r.id === id);
  }

  async épingléeParParent({
    id,
    parent,
  }: {
    id: string;
    parent?: string;
  }): Promise<boolean> {
    return this.requêtes.some((r) => r.id === id && r.parent === parent);
  }

  async directementÉpinglée({ id }: { id: string }): Promise<boolean> {
    return await this.épingléeParParent({ id });
  }

  async épingles(): Promise<Set<string>> {
    return new Set(this.requêtes.map((r) => r.id));
  }

  async suivreÉpingles({
    f,
  }: {
    f: schémaFonctionSuivi<Set<string>>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async () => {
      const épingles = await this.épingles();
      return await f(épingles);
    };
    this.événements.on("changement épingles", fFinale);
    return async () => {
      this.événements.off("changement épingles", fFinale);
    };
  }

  private async _épingler({
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
    this.requêtes.push({ id, parent, fOublier });
    this.événements.emit("changement épingles");

    if (récursif) {
      const fSuivre = async (vals: élémentsBd) => {
        // Cette fonction détectera les éléments d'une liste ou d'un dictionnaire
        // (à un niveau de profondeur) qui représentent une adresse de BD Orbite.
        let l_vals: string[] = [];
        if (typeof vals === "object") {
          l_vals = Object.values(vals).filter(
            (v) => typeof v === "string",
          ) as string[];
          l_vals.push(
            ...Object.keys(vals).filter((v) => typeof v === "string"),
          );
        } else if (Array.isArray(vals)) {
          l_vals = vals;
        } else if (typeof vals === "string") {
          l_vals = [vals];
        }
        const idsOrbite = l_vals.filter((v) => isValidAddress(v));

        if (fichiers) {
          // Épingler les fichiers si nécessaire
          const cids = l_vals.filter(
            (v) => cidEtFichierValide(v) && !idsOrbite.includes(v),
          );

          const { sfip } = await this.client.attendreSfipEtOrbite();
          cids.forEach(async (id_) => {
            for await (const _ of sfip.pins.add(CID.parse(id_.split("/")[0]))) {
              // rien à faire... assurer que ceci ne bloque pas tout le programme en attendant de trouver le contenu sur le réseau SFIP !
            }

            const fOublier_ = async () => {
              // rm par contre peut être async
              try {
                await sfip.pins.rm(CID.parse(id_));
              } catch {
                // Ignorer erreur si id_ n'était pas épinglé sur SFIP
              }
            };
            this.requêtes.push({ id: id_, parent: id, fOublier: fOublier_ });
            this.événements.emit("changement épingles");
          });
        }

        await Promise.all(
          idsOrbite.map(
            async (id_) =>
              await this._épingler({ id: id_, récursif, fichiers, parent: id }),
          ),
        );
      };

      if (bd.type === "keyvalue") {
        const fOublierBd = await this.client.suivreBdDic({
          id,
          f: fSuivre,
        });
        this.fsOublier[id] = fOublierBd;
      } else if (bd.type === "ordered-keyvalue") {
        const fOublierBd = await this.client.suivreBdDicOrdonnée({
          id,
          f: fSuivre,
        });
        this.fsOublier[id] = fOublierBd;
      } else if (bd.type === "set") {
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
      }),
    );
  }

  async fermer(): Promise<void> {
    await Promise.all(Object.values(this.fsOublier).map((f) => f()));
  }
}
