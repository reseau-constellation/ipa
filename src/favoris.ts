import KeyValueStore from "orbit-db-kvstore";

import ClientConstellation from "@/client";
import { schémaFonctionSuivi, schémaFonctionOublier } from "@/utils";

export type typeDispositifs = string | string[] | "TOUS" | "INSTALLÉ";

export interface épingleDispositif {
  bd: boolean;
  fichiers: boolean;
  récursif: boolean;
}

export type ÉlémentFavoris = {
  récursif: boolean;
  dispositifs: typeDispositifs;
  dispositifsFichiers?: typeDispositifs;
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
    let précédentes: string[] = [];

    const fOublier = await this.client.suivreBdDic<ÉlémentFavoris>(
      this.idBd,
      async (favoris) => {
        const nouvelles: string[] = [];

        await Promise.all(
          Object.entries(favoris).map(async ([id, fav]) => {
            const épinglerBd = await this.estÉpingléSurDispositif(
              fav.dispositifs
            );
            const épinglerFichiers = await this.estÉpingléSurDispositif(
              fav.dispositifsFichiers
            );
            if (épinglerBd)
              await this.client.épingles!.épinglerBd(
                id,
                fav.récursif,
                épinglerFichiers
              );
            nouvelles.push(id);
          })
        );

        const àOublier = précédentes.filter((id) => !nouvelles.includes(id));

        await Promise.all(
          àOublier.map(async (id) => this.client.épingles!.désépinglerBd(id))
        );

        précédentes = nouvelles;
      }
    );

    this.oublierÉpingler = fOublier;
  }

  async suivreFavoris(
    f: schémaFonctionSuivi<(ÉlémentFavoris & { idObjet: string })[]>,
    idBdFavoris?: string
  ): Promise<schémaFonctionOublier> {
    idBdFavoris = idBdFavoris || this.idBd;

    const fFinale = (favoris: {[key: string]: ÉlémentFavoris}): void => {
      const favorisFinaux = Object.entries(favoris).map(([idObjet, élément]) => {
        return {
          idObjet,
          ...élément
        }
      })
      f(favorisFinaux);
    }

    return await this.client.suivreBdDic<ÉlémentFavoris>(idBdFavoris, fFinale);
  }

  async épinglerFavori(
    id: string,
    dispositifs: typeDispositifs,
    dispositifsFichiers: typeDispositifs,
    récursif = true
  ): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<ÉlémentFavoris>
    >(this.idBd);

    const élément: ÉlémentFavoris = {
      récursif,
      dispositifs,
      dispositifsFichiers,
    };
    await bd.put(id, élément);

    fOublier();
  }

  async désépinglerFavori(id: string): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<ÉlémentFavoris>
    >(this.idBd);
    await bd.del(id);
    fOublier();
  }

  async suivreÉtatFavori(
    id: string,
    f: schémaFonctionSuivi<ÉlémentFavoris | undefined>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDic<ÉlémentFavoris>(this.idBd, (favoris) =>
      f(favoris[id])
    );
  }

  async suivreEstÉpingléSurDispositif(
    idObjet: string,
    f: schémaFonctionSuivi<épingleDispositif>,
    idOrbite?: string
  ): Promise<schémaFonctionOublier> {
    const fFinale = async (élément?: ÉlémentFavoris): Promise<void> => {
      const bdEstÉpinglée = await this.estÉpingléSurDispositif(
        élément?.dispositifs,
        idOrbite
      );
      const fichiersSontÉpinglés = await this.estÉpingléSurDispositif(
        élément?.dispositifsFichiers,
        idOrbite
      );

      f({
        bd: bdEstÉpinglée,
        fichiers: fichiersSontÉpinglés,
        récursif: élément?.récursif || false,
      });
    };
    return await this.suivreÉtatFavori(idObjet, fFinale);
  }

  async estÉpingléSurDispositif(
    dispositifs: ÉlémentFavoris["dispositifs"] | undefined,
    idOrbite?: string
  ): Promise<boolean> {
    idOrbite = idOrbite || (await this.client.obtIdOrbite());
    if (dispositifs === undefined) {
      return false;
    } else if (dispositifs === "TOUS") {
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
