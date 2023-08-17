import type {
  schémaFonctionOublier,
  schémaFonctionSuivi,
  élémentsBd,
} from "./types.js";
import type { ClientConstellation, structureBdCompte } from "@/client.js";
import { suivreBdDeFonction } from "@constl/utils-ipa";

import { cacheSuivi } from "./décorateursCache.js";
import { faisRien, ignorerNonDéfinis } from "@constl/utils-ipa";

import KeyValueStore from "orbit-db-kvstore";
import FeedStore from "orbit-db-feedstore";
import { JSONSchemaType } from "ajv";

// Obtenu de https://stackoverflow.com/a/54520829
type KeysMatching<T, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

export class ComposanteClient {
  client: ClientConstellation;
  clef: KeysMatching<structureBdCompte, string | undefined>;
  typeBd: "kvstore" | "feed";

  constructor({
    client,
    clef,
    typeBd,
  }: {
    client: ClientConstellation;
    clef: KeysMatching<structureBdCompte, string | undefined>;
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
    return idBd;
  }
}

export class ComposanteClientDic<
  T extends { [clef: string]: élémentsBd }
> extends ComposanteClient {
  schémaBdPrincipale: JSONSchemaType<T>;

  constructor({
    client,
    clef,
    schémaBdPrincipale,
  }: {
    client: ClientConstellation;
    clef: KeysMatching<structureBdCompte, string | undefined>;
    schémaBdPrincipale: JSONSchemaType<T>;
  }) {
    super({
      client,
      clef,
      typeBd: "kvstore",
    });
    this.schémaBdPrincipale = schémaBdPrincipale;
  }

  async obtBd(): Promise<{
    bd: KeyValueStore<T>;
    fOublier: schémaFonctionOublier;
  }> {
    const id = await this.obtIdBd();
    if (!id) throw new Error("Initialisation " + this.clef);

    return await this.client.ouvrirBd<T>({
      id,
      type: "keyvalue",
      schéma: this.schémaBdPrincipale,
    });
  }

  @cacheSuivi
  async suivreBdPrincipale({
    idCompte,
    f,
  }: {
    idCompte?: string;
    f: schémaFonctionSuivi<T>;
  }): Promise<schémaFonctionOublier> {
    return await suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        return await this.suivreIdBd({ f: fSuivreRacine, idCompte });
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBdDic<T>({
          id,
          schéma: this.schémaBdPrincipale,
          f: fSuivreBd,
        });
      },
    });
  }

  @cacheSuivi
  async suivreSousBdDic<U extends { [key: string]: élémentsBd }>({
    idCompte,
    clef,
    schéma,
    f,
  }: {
    idCompte?: string;
    clef: string;
    schéma: JSONSchemaType<U>;
    f: schémaFonctionSuivi<U>;
  }): Promise<schémaFonctionOublier> {
    return await suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        return await this.suivreIdBd({ f: fSuivreRacine, idCompte });
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBdDicDeClef({
          id,
          clef,
          schéma,
          f: fSuivreBd,
        });
      },
    });
  }

  @cacheSuivi
  async suivreSousBdListe<U extends élémentsBd>({
    idCompte,
    clef,
    schéma,
    f,
  }: {
    idCompte?: string;
    clef: string;
    schéma: JSONSchemaType<U>;
    f: schémaFonctionSuivi<U[]>;
  }): Promise<schémaFonctionOublier> {
    return await suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        return await this.suivreIdBd({ f: fSuivreRacine, idCompte });
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBdListeDeClef({
          id,
          clef: clef,
          f: fSuivreBd,
          schéma,
          renvoyerValeur: true,
        });
      },
    });
  }

  @cacheSuivi
  async suivreIdBd({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<string>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        if (idCompte) {
          await fSuivreRacine(idCompte);
          return faisRien;
        } else {
          return await this.client.suivreIdCompte({ f: fSuivreRacine });
        }
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBdDic<structureBdCompte>({
          id,
          f: async (données) => {
            const idBd = données[this.clef];
            return await fSuivreBd(idBd);
          },
        });
      },
    });
  }
}

export class ComposanteClientListe<
  T extends élémentsBd
> extends ComposanteClient {
  schémaBdPrincipale: JSONSchemaType<T>;

  constructor({
    client,
    clef,
    schémaBdPrincipale,
  }: {
    client: ClientConstellation;
    clef: KeysMatching<structureBdCompte, string | undefined>;
    schémaBdPrincipale: JSONSchemaType<T>;
  }) {
    super({
      client,
      clef,
      typeBd: "feed",
    });
    this.schémaBdPrincipale = schémaBdPrincipale;
  }

  async obtBd(): Promise<{
    bd: FeedStore<T>;
    fOublier: schémaFonctionOublier;
  }> {
    const id = await this.obtIdBd();
    if (!id) throw new Error("Initialisation " + this.clef);

    return await this.client.ouvrirBd({
      id,
      type: "feed",
      schéma: this.schémaBdPrincipale,
    });
  }

  @cacheSuivi
  async suivreBdPrincipale({
    idCompte,
    f,
  }: {
    idCompte?: string;
    f: schémaFonctionSuivi<T[]>;
  }): Promise<schémaFonctionOublier> {
    return await suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        return await this.suivreIdBd({ f: fSuivreRacine, idCompte });
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBdListe({
          id,
          f: fSuivreBd,
          schéma: this.schémaBdPrincipale,
          renvoyerValeur: true,
        });
      },
    });
  }

  @cacheSuivi
  async suivreBdPrincipaleBrute({
    idCompte,
    f,
  }: {
    idCompte?: string;
    f: schémaFonctionSuivi<LogEntry<T>[]>;
  }): Promise<schémaFonctionOublier> {
    return await suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        return await this.suivreIdBd({ f: fSuivreRacine, idCompte });
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBdListe({
          id,
          f: fSuivreBd,
          schéma: this.schémaBdPrincipale,
          renvoyerValeur: false,
        });
      },
    });
  }

  @cacheSuivi
  async suivreIdBd({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<string>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        if (idCompte) {
          await fSuivreRacine(idCompte);
          return faisRien;
        } else {
          return await this.client.suivreIdCompte({ f: fSuivreRacine });
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
