import KeyValueStore from "orbit-db-kvstore";
import estNode from "is-node";
import estÉlectron from "is-electron";

import ClientConstellation from "@/client.js";
import { schémaFonctionSuivi, schémaFonctionOublier } from "@/utils/index.js";

export type typeDispositifs = string | string[] | "TOUS" | "INSTALLÉ";

export interface épingleDispositif {
  idObjet: string;
  bd: boolean;
  fichiers: boolean;
  récursif: boolean;
}

export type ÉlémentFavoris = {
  récursif: boolean;
  dispositifs: typeDispositifs;
  dispositifsFichiers?: typeDispositifs;
};

export type ÉlémentFavorisAvecObjet = ÉlémentFavoris & { idObjet: string };

export default class Favoris {
  client: ClientConstellation;
  idBd: string;
  oublierÉpingler?: schémaFonctionOublier;

  constructor({ client, id }: { client: ClientConstellation; id: string }) {
    this.client = client;
    this.idBd = id;
    this._épinglerFavoris();
  }

  async _épinglerFavoris() {
    let précédentes: string[] = [];

    const fOublier = await this.client.suivreBdDic<ÉlémentFavoris>({
      id: this.idBd,
      f: async (favoris) => {
        const nouvelles: string[] = [];

        await Promise.all(
          Object.entries(favoris).map(async ([id, fav]) => {
            const épinglerBd = await this.estÉpingléSurDispositif({
              dispositifs: fav.dispositifs,
            });
            const épinglerFichiers = await this.estÉpingléSurDispositif({
              dispositifs: fav.dispositifsFichiers,
            });
            if (épinglerBd)
              await this.client.épingles!.épinglerBd({
                id,
                récursif: fav.récursif,
                fichiers: épinglerFichiers,
              });
            nouvelles.push(id);
          })
        );

        const àOublier = précédentes.filter((id) => !nouvelles.includes(id));

        await Promise.all(
          àOublier.map(async (id) =>
            this.client.épingles!.désépinglerBd({ id })
          )
        );

        précédentes = nouvelles;
      },
    });

    this.oublierÉpingler = fOublier;
  }

  async suivreFavoris({
    f,
    idBdFavoris,
  }: {
    f: schémaFonctionSuivi<ÉlémentFavorisAvecObjet[]>;
    idBdFavoris?: string;
  }): Promise<schémaFonctionOublier> {
    idBdFavoris = idBdFavoris || this.idBd;

    const fFinale = (favoris: { [key: string]: ÉlémentFavoris }): void => {
      const favorisFinaux = Object.entries(favoris).map(
        ([idObjet, élément]) => {
          return {
            idObjet,
            ...élément,
          };
        }
      );
      f(favorisFinaux);
    };

    return await this.client.suivreBdDic<ÉlémentFavoris>({
      id: idBdFavoris,
      f: fFinale,
    });
  }

  async épinglerFavori({
    id,
    dispositifs,
    dispositifsFichiers = "INSTALLÉ",
    récursif = true,
  }: {
    id: string;
    dispositifs: typeDispositifs;
    dispositifsFichiers?: typeDispositifs | undefined;
    récursif?: boolean;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<ÉlémentFavoris>
    >({ id: this.idBd });

    const élément: ÉlémentFavoris = {
      récursif,
      dispositifs,
    };
    if (dispositifsFichiers) élément.dispositifsFichiers = dispositifsFichiers;
    await bd.put(id, élément);

    fOublier();
  }

  async désépinglerFavori({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<ÉlémentFavoris>
    >({ id: this.idBd });
    await bd.del(id);
    fOublier();
  }

  async suivreÉtatFavori({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<ÉlémentFavoris | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDic<ÉlémentFavoris>({
      id: this.idBd,
      f: (favoris) => f(favoris[id]),
    });
  }

  async suivreEstÉpingléSurDispositif({
    idObjet,
    f,
    idOrbite,
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<épingleDispositif>;
    idOrbite?: string;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (élément?: ÉlémentFavoris): Promise<void> => {
      const bdEstÉpinglée = await this.estÉpingléSurDispositif({
        dispositifs: élément?.dispositifs,
        idOrbite,
      });
      const fichiersSontÉpinglés = await this.estÉpingléSurDispositif({
        dispositifs: élément?.dispositifsFichiers,
        idOrbite,
      });

      f({
        idObjet,
        bd: bdEstÉpinglée,
        fichiers: fichiersSontÉpinglés,
        récursif: élément?.récursif || false,
      });
    };
    return await this.suivreÉtatFavori({ id: idObjet, f: fFinale });
  }

  async estÉpingléSurDispositif({
    dispositifs,
    idOrbite,
  }: {
    dispositifs: ÉlémentFavoris["dispositifs"] | undefined;
    idOrbite?: string;
  }): Promise<boolean> {
    idOrbite = idOrbite || (await this.client.obtIdOrbite());
    if (dispositifs === undefined) {
      return false;
    } else if (dispositifs === "TOUS") {
      return true;
    } else if (dispositifs === "INSTALLÉ") {
      if (idOrbite === (await this.client.obtIdOrbite())) {
        return estNode || estÉlectron();
      } else {
        return false; // En réalité, inconnu. Mais on ne peut pas magiquement deviner la plateforme d'un autre paire.
      }
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
