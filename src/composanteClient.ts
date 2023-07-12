import type {
    schémaFonctionOublier,
    schémaFonctionSuivi,
    élémentsBd,
} from "./utils/types.js";
import type { ClientConstellation } from "@/client.js";

import { cacheSuivi } from "./décorateursCache.js";
import { faisRien, ignorerNonDéfinis } from "./utils/fonctions.js";
import Store from "orbit-db-store";
import KeyValueStore from "orbit-db-kvstore";
import FeedStore from "orbit-db-feedstore";

export class ComposanteClient<T extends Store> {
  client: ClientConstellation;
  clef: string;
  typeBd: string;

  constructor({
    client,
    clef,
    typeBd,
  }: {
    client: ClientConstellation;
    clef: string;
    typeBd: string;
  }) {
    this.client = client;
    this.clef = clef;
    this.typeBd = typeBd;
  }

  async obtIdBd(): Promise<string> {
    const idBd = await this.client.obtIdBd({
      nom: this.clef,
      racine: this.client.bdCompte!,
      type: this.typeBd,
    });
    if (!idBd) throw new Error("Mal initialisé");
    return idBd
  }

  async obtBd(): Promise<{
    bd: T;
    fOublier: schémaFonctionOublier;
  }> {
    const id = await this.obtIdBd();
    if (!id) throw new Error("Initialisation " + this.clef);

    return await this.client.ouvrirBd<T>({
      id,
    });
  }

  @cacheSuivi
  async suivreIdBd({
    f,
    idBd,
  }: {
    f: schémaFonctionSuivi<string>;
    idBd?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        if (idBd) {
          await fSuivreRacine(idBd);
          return faisRien;
        } else {
          return await this.client.suivreIdBdCompte({ f: fSuivreRacine });
        }
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBd<T>({
          id,
          f: async () => {
            const idBd = await this.client.obtIdBd({
              nom: this.clef,
              racine: id,
              type: this.typeBd,
            });
            return await fSuivreBd(idBd);
          },
        });
      },
    });
  }
}

export class ComposanteClientDic<T extends élémentsBd> extends ComposanteClient<KeyValueStore<T>> {
  constructor({ client, clef }: { client: ClientConstellation; clef: string }) {
    super({
      client,
      clef,
      typeBd: "kvstore",
    });
  }


  @cacheSuivi
  async suivreBdPrincipale({
    idBd,
    f,
  }: {
    idBd?: string;
    f: schémaFonctionSuivi<{[clef: string]: T}>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        return await this.suivreIdBd({ f: fSuivreRacine, idBd });
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBdDic<T>({
          id,
          f: fSuivreBd,
        });
      },
    });
  }
  

  @cacheSuivi
  async suivreSousBdDic<T extends élémentsBd>({
    idBd,
    clef,
    f,
  }: {
    idBd?: string;
    clef: string;
    f: schémaFonctionSuivi<{
      [key: string]: T;
    }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        return await this.suivreIdBd({ f: fSuivreRacine, idBd });
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBdDicDeClef({
          id,
          clef: clef,
          f: fSuivreBd,
        });
      },
    });
  }

  @cacheSuivi
  async suivreSousBdListe<T extends élémentsBd>({
    idBd,
    clef,
    f,
  }: {
    idBd?: string;
    clef: string;
    f: schémaFonctionSuivi<T[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        return await this.suivreIdBd({ f: fSuivreRacine, idBd });
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBdListeDeClef<T>({
          id,
          clef: clef,
          f: fSuivreBd,
          renvoyerValeur: true,
        });
      },
    });
  }
}

export class ComposanteClientListe<T extends élémentsBd> extends ComposanteClient<FeedStore<T>> {
  constructor({ client, clef }: { client: ClientConstellation; clef: string }) {
      super({
          client,
          clef,
          typeBd: "feed",
      });
  }

  @cacheSuivi
  async suivreBdPrincipale({
    idBd,
    f,
  }: {
    idBd?: string;
    f: schémaFonctionSuivi<T[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        return await this.suivreIdBd({ f: fSuivreRacine, idBd });
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBdListe<T>({
          id,
          f: fSuivreBd,
          renvoyerValeur: true,
        });
      },
    });
  }

  @cacheSuivi
  async suivreBdPrincipaleBrute({
    idBd,
    f,
  }: {
    idBd?: string;
    f: schémaFonctionSuivi<LogEntry<T>[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        return await this.suivreIdBd({ f: fSuivreRacine, idBd });
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBdListe<T>({
          id,
          f: fSuivreBd,
          renvoyerValeur: false,
        });
      },
    });
  }
}
