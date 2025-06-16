import {
  suivreFonctionImbriquée,
  faisRien,
  ignorerNonDéfinis,
} from "@constl/utils-ipa";
import { TypedKeyValue, TypedSet } from "@constl/bohr-db";
import { JSONSchemaType } from "ajv";
import {
  schémaStructureBdCompte,
  type Constellation,
  type structureBdCompte,
} from "@/client.js";
import { cacheSuivi } from "./décorateursCache.js";
import type {
  schémaFonctionOublier,
  schémaFonctionSuivi,
  élémentsBd,
} from "./types.js";

// Obtenu de https://stackoverflow.com/a/54520829
type KeysMatching<T, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

export class ServiceConstellation {
  client: Constellation;
  clef: string;
  dépendences: string[];

  constructor({
    client,
    clef,
    dépendences,
  }: {
    client: Constellation;
    clef: string
    dépendences?: string[]
  }) {
    this.client = client;
    this.clef = clef;
    this.dépendences = dépendences || [];
  }

  async initialiser(): Promise<void> {}
  async fermer() {}

  async initialisé() {}

}

export class ServiceConstellationAvecBd extends ServiceConstellation {
  typeBd: "keyvalue" | "set";
  clef: KeysMatching<structureBdCompte, string | undefined>;

  constructor({
    client,
    clef,
    typeBd,
  }: {
    client: Constellation;
    clef: KeysMatching<structureBdCompte, string | undefined>;
    typeBd: "keyvalue" | "set";
  }) {
    super({ clef, client })
    this.typeBd = typeBd;
    this.clef = clef
  }

  async obtIdBd(): Promise<string> {
    const { idCompte } = await this.client.attendreInitialisée();
    const idBd = await this.client.obtIdBd({
      nom: this.clef,
      racine: idCompte,
      type: this.typeBd,
    });
    if (!idBd) throw new Error("Mal initialisé");
    return idBd;
  }
}

export class ComposanteClientDic<
  T extends { [clef: string]: élémentsBd },
> extends ServiceConstellationAvecBd {
  schémaBdPrincipale: JSONSchemaType<T>;

  constructor({
    client,
    clef,
    schémaBdPrincipale,
  }: {
    client: Constellation;
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

    return await this.client.ouvrirBdTypée({
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
    return await suivreFonctionImbriquée({
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
    return await suivreFonctionImbriquée({
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

  // @cacheSuivi À faire
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
    return await suivreFonctionImbriquée({
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
    return await suivreFonctionImbriquée({
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
        return await this.client.suivreBdDic({
          id,
          schéma: schémaStructureBdCompte,
          f: async (données) => {
            const idBdComposante = données[this.clef];
            await fSuivreBd(idBdComposante);
          },
        });
      },
    });
  }
}

export class ComposanteClientListe<
  T extends élémentsBd,
> extends ServiceConstellationAvecBd {
  schémaBdPrincipale: JSONSchemaType<T>;

  constructor({
    client,
    clef,
    schémaBdPrincipale,
  }: {
    client: Constellation;
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

    return await this.client.ouvrirBdTypée({
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
    return await suivreFonctionImbriquée({
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
    return await suivreFonctionImbriquée({
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
        return await this.client.suivreBdDic({
          id,
          schéma: schémaStructureBdCompte,
          f: async (données) => {
            const idBdComposante = données[this.clef];
            await fSuivreBd(idBdComposante);
          },
        });
      },
    });
  }
}
