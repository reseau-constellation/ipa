import {
  suivreFonctionImbriquée,
  faisRien,
  ignorerNonDéfinis,
} from "@constl/utils-ipa";
import { TypedKeyValue, TypedNested, TypedSet } from "@constl/bohr-db";
import { JSONSchemaType } from "ajv";
import {
  NestedDatabaseType,
  NestedKey,
  joinKey,
  splitKey,
} from "@orbitdb/nested-db";
import { ExtractKeys } from "node_modules/@constl/bohr-db/dist/types.js";
import { DefaultLibp2pServices } from "helia";
import {
  ServicesConstellation,
  ServicesDéfautConstellation,
  schémaStructureBdCompte,
  type Constellation,
  type structureBdCompte,
} from "@/client.js";
import { ServicesLibp2p } from "./sfip/index.js";
import { cacheSuivi } from "./décorateursCache.js";
import { Profil } from "./profil.js";
import type {
  schémaFonctionOublier,
  schémaFonctionSuivi,
  élémentsBd,
} from "./types.js";

// Obtenu de https://stackoverflow.com/a/54520829
type KeysMatching<T, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

export class ServiceConstellation<
  S extends ServicesConstellation,
  L extends ServicesLibp2p,
> {
  constl: Constellation;
  clef: string;
  dépendences: (keyof S)[];
  signaleur: AbortController;

  constructor({
    constl,
    clef,
    dépendences,
  }: {
    constl: Constellation<S, L>;
    clef: string;
    dépendences?: (keyof S)[];
  }) {
    this.constl = constl;
    this.clef = clef;
    this.dépendences = dépendences || [];

    this.signaleur = new AbortController();
  }

  async démarrer(): Promise<void> {}
  async fermer() {
    this.signaleur.abort();
    // Attendre démarré
  }

  async démarré() {}
}

export class ServiceConstellationDic<
  S extends ServicesConstellation = ServicesDéfautConstellation,
  L extends ServicesLibp2p = ServicesLibp2p,
> extends ServiceConstellation<S, L> {
  constructor({
    constl,
    clef,
    dépendences,
  }: {
    constl: Constellation<S, L>;
    clef: string;
    dépendences?: (keyof S)[];
  }) {
    super({ constl, clef, dépendences });
  }

  // À faire: types pour `clef`
  clefBd(clef: NestedKey = []): ExtractKeys<structureBdCompte> {
    const composantesClef = typeof clef === "string" ? splitKey(clef) : clef;
    return joinKey([
      this.clef,
      ...composantesClef,
    ]) as ExtractKeys<structureBdCompte>;
  }

  async bdConstl(): Promise<TypedNested<structureBdCompte>> {
    const { idCompte } = await this.constl.attendreInitialisée();
    return await this.constl.ouvrirBdTypée({
      id: idCompte,
      type: "nested",
      schéma: schémaStructureBdCompte,
    });
  }

  async fermer() {
    await super.fermer();
  }
}

const x = new ServiceConstellationDic<{ a: Profil }>({});

export class ServiceConstellationAvecBd extends ServiceConstellation {
  typeBd: "keyvalue" | "set";
  clef: keyof structureBdCompte;
  client: Constellation;

  constructor({
    client,
    clef,
    typeBd,
  }: {
    client: Constellation;
    clef: keyof structureBdCompte;
    typeBd: "keyvalue" | "set";
  }) {
    super({ clef, constl: client });
    this.client = this.constl;
    this.typeBd = typeBd;
    this.clef = clef;
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
    clef: keyof structureBdCompte;
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
            await fSuivreBd(idBdComposante as string);
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
            await fSuivreBd(idBdComposante as string);
          },
        });
      },
    });
  }
}
