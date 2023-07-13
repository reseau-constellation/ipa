import type {
    schémaFonctionOublier,
    schémaFonctionSuivi,
    élémentsBd,
} from "./utils/types.js";
import type { ClientConstellation, structureBdCompte } from "@/client.js";

import { cacheSuivi } from "./décorateursCache.js";
import { faisRien, ignorerNonDéfinis } from "./utils/fonctions.js";

import KeyValueStore from "orbit-db-kvstore";
import FeedStore from "orbit-db-feedstore";

// Obtenu de https://stackoverflow.com/a/54520829
type KeysMatching<T, V> = {[K in keyof T]-?: T[K] extends V ? K : never}[keyof T];

export class ComposanteClient {
  client: ClientConstellation;
  clef: KeysMatching<structureBdCompte, string>;
  typeBd: "kvstore" | "feed";

  constructor({
    client,
    clef,
    typeBd,
  }: {
    client: ClientConstellation;
    clef: KeysMatching<structureBdCompte, string>;
    typeBd: "kvstore" | "feed";
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

}

export class ComposanteClientDic<T extends {[clef: string]: élémentsBd}> extends ComposanteClient {
  constructor({ client, clef }: { client: ClientConstellation; clef: KeysMatching<structureBdCompte, string> }) {
    super({
      client,
      clef,
      typeBd: "kvstore",
    });
  }

  async obtBd(): Promise<{
    bd: KeyValueStore<T>;
    fOublier: schémaFonctionOublier;
  }> {
    const id = await this.obtIdBd();
    if (!id) throw new Error("Initialisation " + this.clef);

    return await this.client.ouvrirBd({
      id,
      type: "keyvalue"
    });
  }

  @cacheSuivi
  async suivreBdPrincipale({
    idBd,
    f,
  }: {
    idBd?: string;
    f: schémaFonctionSuivi<T>;
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
  async suivreSousBdDic<U extends {[key: string]: élémentsBd}>({
    idBd,
    clef,
    f,
  }: {
    idBd?: string;
    clef: string;
    f: schémaFonctionSuivi<U>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        return await this.suivreIdBd({ f: fSuivreRacine, idBd });
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBdDicDeClef<U>({
          id,
          clef,
          f: fSuivreBd,
        });
      },
    });
  }

  @cacheSuivi
  async suivreSousBdListe<U extends élémentsBd>({
    idBd,
    clef,
    f,
  }: {
    idBd?: string;
    clef: string;
    f: schémaFonctionSuivi<U[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        return await this.suivreIdBd({ f: fSuivreRacine, idBd });
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBdListeDeClef<U>({
          id,
          clef: clef,
          f: fSuivreBd,
          renvoyerValeur: true,
        });
      },
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
        return await this.client.suivreBd({
          id,
          type: "keyvalue",
          f: async () => {
            const idBd = await this.client.obtIdBd({
              nom: this.clef,
              racine: id,
              type: "keyvalue",
            });
            return await fSuivreBd(idBd);
          },
        });
      },
    });
  }
}

export class ComposanteClientListe<T extends élémentsBd> extends ComposanteClient {
  constructor({ client, clef }: { client: ClientConstellation; clef: KeysMatching<structureBdCompte, string> }) {
      super({
          client,
          clef,
          typeBd: "feed",
      });
  }

  async obtBd(): Promise<{
    bd: FeedStore<T>;
    fOublier: schémaFonctionOublier;
  }> {
    const id = await this.obtIdBd();
    if (!id) throw new Error("Initialisation " + this.clef);

    return await this.client.ouvrirBd({
      id,
      type: "feed"
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
        return await this.client.suivreBd({
          id,
          type: "keyvalue",
          f: async () => {
            const idBd = await this.client.obtIdBd({
              nom: this.clef,
              racine: id,
              type: "feed",
            });
            return await fSuivreBd(idBd);
          },
        });
      },
    });
  }
}
