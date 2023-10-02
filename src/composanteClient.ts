import type {
  schémaFonctionOublier,
  schémaFonctionSuivi,
  élémentsBd,
} from "./types.js";
import {
  schémaStructureBdCompte,
  type ClientConstellation,
  type structureBdCompte,
} from "@/client.js";
import { suivreBdDeFonction } from "@constl/utils-ipa";

import { cacheSuivi } from "./décorateursCache.js";
import { faisRien, ignorerNonDéfinis } from "@constl/utils-ipa";

import { JSONSchemaType } from "ajv";
import { TypedSet, TypedKeyValue } from "@constl/bohr-db";

// Obtenu de https://stackoverflow.com/a/54520829
type KeysMatching<T, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

export class ComposanteClient {
  client: ClientConstellation;
  clef: KeysMatching<structureBdCompte, string | undefined>;
  typeBd: "keyvalue" | "set";

  constructor({
    client,
    clef,
    typeBd,
  }: {
    client: ClientConstellation;
    clef: KeysMatching<structureBdCompte, string | undefined>;
    typeBd: "keyvalue" | "set";
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
      typeBd: "keyvalue",
    });
    this.schémaBdPrincipale = schémaBdPrincipale;
  }

  async obtBd(): Promise<{
    bd: TypedKeyValue<T>;
    fOublier: schémaFonctionOublier;
  }> {
    const id = await this.obtIdBd();
    if (!id) throw new Error("Initialisation " + this.clef);

    return await this.client.orbite!.ouvrirBdTypée({
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
        return await this.client.suivreBd({
          id,
          type: "keyvalue",
          f: async (bd) => {
            const idBd = await this.client.obtIdBd({
              nom: this.clef,
              racine: bd,
              type: "keyvalue",
            });
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
      typeBd: "set",
    });
    this.schémaBdPrincipale = schémaBdPrincipale;
  }

  async obtBd(): Promise<{
    bd: TypedSet<T>;
    fOublier: schémaFonctionOublier;
  }> {
    const id = await this.obtIdBd();
    if (!id) throw new Error("Initialisation " + this.clef);

    return await this.client.orbite!.ouvrirBdTypée({
      id,
      type: "set",
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
          schéma: schémaStructureBdCompte,
          f: async () => {
            const idBd = await this.client.obtIdBd({
              nom: this.clef,
              racine: id,
              type: "set",
            });
            return await fSuivreBd(idBd);
          },
        });
      },
    });
  }
}
