import { typedNested } from "@constl/bohr-db";
import { suivreDeFonctionListe } from "@constl/utils-ipa";
import { toObject } from "@orbitdb/nested-db";
import { ServiceDonnéesNébuleuse } from "./crabe/services/services.js";
import { Tableaux, schémaTableau } from "./tableaux.js";
import { ajouterProtocoleOrbite, extraireEmpreinte } from "./utils.js";
import { schémaStatutDonnées, schémaTraducsTexte } from "./schémas.js";
import {
  DISPOSITIFS_INSTALLÉS,
  TOUS_DISPOSITIFS,
  résoudreDéfauts,
} from "./favoris.js";
import { cacheSuivi } from "./crabe/cache.js";
import { RechercheNuées } from "./recherche/nuées.js";
import type { TypedNested } from "@constl/bohr-db";
import type { Constellation, ServicesConstellation } from "./constellation.js";
import type { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import type { Oublier, Suivi } from "./crabe/types.js";
import type { StructureTableau } from "./tableaux.js";
import type {
  Métadonnées,
  PartielRécursif,
  StatutDonnées,
  TraducsTexte,
} from "./types.js";
import type { BaseÉpingleFavoris } from "./favoris.js";
import type { ÉpingleBd } from "./bds/bds.js";
import type { JSONSchemaType } from "ajv";

// Types épingles

export type ÉpingleNuée = BaseÉpingleFavoris & {
  type: "nuée";
  données: ÉpingleBd;
};

// Types structure

export type AutorisationNuée = {
  type: "ouverte" | "par invitation";
  bloqués: string[];
  invités: string[];
};

export type StructureNuée = {
  type: "nuée";
  noms: TraducsTexte;
  descriptions: TraducsTexte;
  image: string;
  motsClefs: { [id: string]: null };
  métadonnées: Métadonnées;
  statut: StatutDonnées;
  autorisation: AutorisationNuée;
  tableaux: { [clef: string]: StructureTableau };
  parent: string;
};

export const schémaNuée: JSONSchemaType<PartielRécursif<StructureNuée>> = {
  type: "object",
  properties: {
    type: { type: "string", nullable: true },
    noms: schémaTraducsTexte,
    descriptions: schémaTraducsTexte,
    image: { type: "string", nullable: true },
    métadonnées: {
      type: "object",
      additionalProperties: true,
      required: [],
      nullable: true,
    },
    motsClefs: {
      type: "object",
      nullable: true,
      additionalProperties: {
        type: "null",
        nullable: true,
      },
    },
    statut: schémaStatutDonnées,
    autorisation: {
      type: "object",
      properties: {
        type: { type: "string", nullable: true },
        bloqués: { type: "array", items: { type: "string" }, nullable: true },
        invités: { type: "array", items: { type: "string" }, nullable: true },
      },
      nullable: true,
    },
    tableaux: {
      type: "object",
      additionalProperties: schémaTableau,
      nullable: true,
    },
    parent: { type: "string", nullable: true },
  },
};

export type StructureServiceNuées = {
  [nuée: string]: null;
};

export const SchémaServiceNuées: JSONSchemaType<
  PartielRécursif<StructureServiceNuées>
> = {
  type: "object",
  additionalProperties: true,
  required: [],
};

export class Nuées<
  L extends ServicesLibp2pCrabe,
> extends ServiceDonnéesNébuleuse<
  "nuées",
  StructureServiceNuées,
  L,
  ServicesConstellation<L>
> {
  tableaux: Tableaux<L>;
  recherche: RechercheNuées<L>;

  constructor({ nébuleuse }: { nébuleuse: Constellation }) {
    super({
      clef: "nuées",
      nébuleuse,
      dépendances: ["compte", "orbite", "hélia"],
      options: {
        schéma: SchémaServiceNuées,
      },
    });
    this.tableaux = new Tableaux({
      service: (clef) => this.service(clef),
    });
    this.recherche = new RechercheNuées({
      nuées: this,
      constl: this.nébuleuse,
      service: (clef) => this.service(clef),
    });
  }

  @cacheSuivi
  async suivreNuées({
    f,
    idCompte,
  }: {
    f: Suivi<string[] | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    const compte = this.service("compte");

    return await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }: { fSuivreRacine: Suivi<string[]> }) =>
        await this.suivreBd({
          idCompte,
          f: async (nuées) =>
            await fSuivreRacine(
              nuées ? Object.keys(nuées).map(ajouterProtocoleOrbite) : [],
            ),
        }),
      fBranche: async ({ id: idObjet, fSuivreBranche }) => {
        return await compte.suivrePermission({
          idObjet,
          idCompte,
          f: async (permission) =>
            await fSuivreBranche(permission ? idObjet : undefined),
        });
      },
      f,
    });
  }

  async créerNuée({
    nuéeParent,
    autorisation = "ouverte",
    épingler = true,
  }: {
    nuéeParent?: string;
    autorisation?: AutorisationNuée["type"];
    épingler?: boolean;
  } = {}): Promise<string> {
    const compte = this.service("compte");

    const { bd, oublier: oublierBd } = await compte.créerObjet({
      type: "nested",
    });
    const idNuée = bd.address;
    await oublierBd();
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });

    await this.ajouterÀMesNuées({ idNuée });

    if (épingler) await this.épingler({ idNuée });

    await nuée.put({
      type: "nuée",
      autorisation: {
        type: autorisation,
      },
      statut: { statut: "active" },
      parent: nuéeParent,
    });

    await oublier();

    return idNuée;
  }

  async effacerNuée({ idNuée }: { idNuée: string }): Promise<void> {
    const orbite = this.service("orbite");

    // D'abord effacer l'entrée dans notre liste de Nuées
    await this.enleverDeMesNuées({ idNuée });

    // On court-circuite `this.service("favoris")`
    const favoris = this.nébuleuse.services["favoris"];
    await favoris.désépinglerFavori({ idObjet: idNuée });

    // enfin, effacer la Nuée elle-même
    await orbite.effacerBd({ id: idNuée });
  }

  async ajouterÀMesNuées({ idNuée }: { idNuée: string }): Promise<void> {
    const bd = await this.bd();
    await bd.put(extraireEmpreinte(idNuée), null);
  }

  async enleverDeMesNuées({ idNuée }: { idNuée: string }): Promise<void> {
    const bd = await this.bd();
    await bd.del(extraireEmpreinte(idNuée));
  }

  async confirmerPermission({ idNuée }: { idNuée: string }): Promise<void> {
    const compte = this.service("compte");

    if (!(await compte.permission({ idObjet: idNuée })))
      throw new Error(
        `Permission de modification refusée pour la nuée ${idNuée}.`,
      );
  }

  async ouvrirNuée({
    idNuée,
  }: {
    idNuée: string;
  }): Promise<{ nuée: TypedNested<StructureNuée>; oublier: Oublier }> {
    const { bd, oublier } = await this.service("orbite").ouvrirBd({
      id: idNuée,
      type: "nested",
    });
    return {
      nuée: typedNested<StructureNuée>({ db: bd, schema: schémaNuée }),
      oublier,
    };
  }

  // Épingles

  async épingler({
    idNuée,
    options = {},
  }: {
    idNuée: string;
    options?: PartielRécursif<ÉpingleNuée>;
  }) {
    // On court-circuite `this.service("favoris")`
    const favoris = this.nébuleuse.services["favoris"];

    const épingle: ÉpingleNuée = résoudreDéfauts(options, {
      type: "nuée",
      base: TOUS_DISPOSITIFS,
      données: {
        type: "bd",
        base: TOUS_DISPOSITIFS,
        données: {
          tableaux: TOUS_DISPOSITIFS,
          fichiers: DISPOSITIFS_INSTALLÉS,
        },
      },
    });
    await favoris.épinglerFavori({ idObjet: idNuée, épingle });
  }

  // Noms

  @cacheSuivi
  async suivreNoms({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<TraducsTexte>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idNuée,
      type: "nested",
      schéma: schémaNuée,
      f: (nuée) => f(toObject(nuée).noms || {}),
    });
  }

  // Descriptions

  @cacheSuivi
  async suivreDescriptions({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<TraducsTexte>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idNuée,
      type: "nested",
      schéma: schémaNuée,
      f: (nuée) => f(toObject(nuée).descriptions || {}),
    });
  }

  // Mots-clefs

  @cacheSuivi
  async suivreMotsClefs({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");

    return await orbite.suivreDonnéesBd({
      id: idNuée,
      type: "nested",
      schéma: schémaNuée,
      f: (nuée) => f(Object.keys(toObject(nuée).motsClefs)),
    });
  }

  // Variables

  async suivreVariables({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    const fFinale = async (variables?: string[]) => {
      return await f(variables || []);
    };

    const fBranche = async ({
      id,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<string[]>;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.tableaux.suivreVariables({
        idTableau: id,
        f: fSuivreBranche,
      });
    };

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxNuée({
        idNuée,
        f: (x) => fSuivreRacine(x.map((x) => x.id)),
      });
    };

    return await suivreDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  // Qualité

  @cacheSuivi
  async suivreScoreQualité({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<number>;
  }): Promise<Oublier> {
    const rés: {
      noms: { [key: string]: string };
      descr: { [key: string]: string };
    } = {
      noms: {},
      descr: {},
    };
    const fFinale = async () => {
      const scores = [
        Object.keys(rés.noms).length ? 1 : 0,
        Object.keys(rés.descr).length ? 1 : 0,
      ];

      const qualité = scores.reduce((a, b) => a + b, 0) / scores.length;
      await f(qualité);
    };
    const oublierNoms = await this.suivreNomsNuée({
      idNuée,
      f: (noms) => {
        rés.noms = noms;
        fFinale();
      },
    });

    const oublierDescr = await this.suivreDescriptionsNuée({
      idNuée,
      f: (descr) => {
        rés.descr = descr;
        fFinale();
      },
    });

    const fOublier = async () => {
      await oublierNoms();
      await oublierDescr();
    };

    return fOublier;
  }
}
