import { FeedStore, élémentFeedStore } from "orbit-db";
import ClientConstellation, {
  schémaFonctionSuivi,
  schémaFonctionOublier,
} from "./client";

export type EntréeFavoris = {
  id: string;
};

export default class Favoris {
  client: ClientConstellation;
  idBd: string;

  constructor(client: ClientConstellation, id: string) {
    this.client = client;
    this.idBd = id;
  }

  async suivreFavoris(
    f: schémaFonctionSuivi<string[]>,
    idBdRacine?: string
  ): Promise<schémaFonctionOublier> {
    idBdRacine = idBdRacine || this.idBd;
    const fFinale = (listeFavoris: EntréeFavoris[]) => {
      f(
        listeFavoris
          .map((x: EntréeFavoris) => (typeof x === "string" ? x : x.id))
          .filter((x) => x)
      );
    };
    return await this.client.suivreBdListe(
      idBdRacine,
      fFinale as (x: unknown) => Promise<schémaFonctionOublier>
    );
  }

  async épinglerFavori(id: string): Promise<void> {
    const existante = await this.client.rechercherBdListe(
      this.idBd,
      (e: élémentFeedStore<EntréeFavoris>) => e.payload.value.id === id
    );
    if (!existante) {
      const bdRacine = (await this.client.ouvrirBd(this.idBd)) as FeedStore;
      const élément = {
        id: id,
      };
      await bdRacine.add(élément);
    }
  }

  async désépinglerFavori(id: string): Promise<void> {
    const existante = await this.client.rechercherBdListe(
      this.idBd,
      (e: élémentFeedStore<EntréeFavoris>) => e.payload.value.id === id
    );
    if (existante) {
      const bdRacine = (await this.client.ouvrirBd(this.idBd)) as FeedStore;
      await bdRacine.remove(existante.hash);
    }
  }

  async suivreÉtatFavori(
    id: string,
    f: schémaFonctionSuivi<boolean>
  ): Promise<schémaFonctionOublier> {
    const fFinale = (favoris: EntréeFavoris[]) => {
      f(favoris.map((x: EntréeFavoris) => x.id).includes(id));
    };
    return await this.client.suivreBdListe(
      this.idBd,
      fFinale as (x: unknown) => Promise<schémaFonctionOublier>
    );
  }
}
