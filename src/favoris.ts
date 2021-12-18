import deepEqual from "deep-equal";

import FeedStore from "orbit-db-feedstore";

import ClientConstellation from "./client";
import { schémaFonctionSuivi, schémaFonctionOublier } from "@/utils";

export type ÉlémentFavoris = {
  id: string;
  dispositifs?: string | string[] | "TOUS" | "INSTALLÉ";
};

export default class Favoris {
  client: ClientConstellation;
  idBd: string;
  oublierÉpingler?: schémaFonctionOublier;

  constructor(client: ClientConstellation, id: string) {
    this.client = client;
    this.idBd = id;
    this._épinglerFavoris();
  }

  async _épinglerFavoris() {
    const précédentes: string[] = [];

    const fOublier = await this.client.suivreBdListe<ÉlémentFavoris>(
      this.idBd,
      async (favoris) => {
        const nouvelles: string[] = [];
        await Promise.all(
          favoris.map(async (fav) => {
            const épingler = await this._épinglerSurCeDispositif(
              fav.dispositifs
            );
            if (épingler) await this.client.épingles!.épinglerBd(fav.id);
            nouvelles.push(fav.id);
          })
        );
        const àOublier = précédentes.filter((id) => !nouvelles.includes(id));
        await Promise.all(
          àOublier.map(
            async (id) => await this.client.épingles!.désépinglerBd(id)
          )
        );
      }
    );
    this.oublierÉpingler = fOublier;
  }

  async suivreFavoris(
    f: schémaFonctionSuivi<ÉlémentFavoris[]>,
    idBdRacine?: string
  ): Promise<schémaFonctionOublier> {
    idBdRacine = idBdRacine || this.idBd;
    const fFinale = (listeFavoris: ÉlémentFavoris[]) => {
      f(
        listeFavoris
          .map((x: ÉlémentFavoris) => (typeof x === "string" ? { id: x } : x))
          .filter((x) => x)
      );
    };
    return await this.client.suivreBdListe<ÉlémentFavoris>(idBdRacine, fFinale);
  }

  async épinglerFavori(
    id: string,
    dispositifs: ÉlémentFavoris["dispositifs"]
  ): Promise<void> {
    const existant = await this.client.rechercherBdListe(
      this.idBd,
      (e: LogEntry<ÉlémentFavoris>) => e.payload.value.id === id
    );
    const élément = { id, dispositifs };

    if (!deepEqual(élément, existant.payload.value)) {
      const bdRacine = (await this.client.ouvrirBd(
        this.idBd
      )) as FeedStore<ÉlémentFavoris>;
      await bdRacine.add(élément);
      if (existant) {
        await bdRacine.remove(existant.hash);
      }
    }
  }

  async désépinglerFavori(id: string): Promise<void> {
    const existante = await this.client.rechercherBdListe<ÉlémentFavoris>(
      this.idBd,
      (e) => e.payload.value.id === id
    );
    if (existante) {
      const bdRacine = (await this.client.ouvrirBd(
        this.idBd
      )) as FeedStore<ÉlémentFavoris>;
      await bdRacine.remove(existante.hash);
    }
  }

  async suivreÉtatFavori(
    id: string,
    f: schémaFonctionSuivi<boolean>
  ): Promise<schémaFonctionOublier> {
    const fFinale = (favoris: ÉlémentFavoris[]) => {
      f(favoris.map((x) => x.id).includes(id));
    };
    return await this.client.suivreBdListe(
      this.idBd,
      fFinale as (x: unknown) => Promise<schémaFonctionOublier>
    );
  }

  async _épinglerSurCeDispositif(
    dispositifs: ÉlémentFavoris["dispositifs"],
    idOrbite?: string
  ): Promise<boolean> {
    idOrbite = idOrbite || (await this.client.obtIdOrbite());
    if (dispositifs === "TOUS" || dispositifs === undefined) {
      return true;
    } else if (typeof dispositifs === "string") {
      return dispositifs === idOrbite;
    } else {
      return dispositifs.includes(idOrbite);
    }
  }

  async fermer(): Promise<void> {
    if (this.oublierÉpingler) this.oublierÉpingler();
  }
}
