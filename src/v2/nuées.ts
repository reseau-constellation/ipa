import { typedNested } from "@constl/bohr-db";
import { ServiceDonnéesNébuleuse } from "./crabe/services/services.js";
import { Tableaux, schémaTableau } from "./tableaux.js";
import { extraireEmpreinte } from "./utils.js";
import { schémaStatutDonnées, schémaTraducsTexte } from "./schémas.js";
import {
  DISPOSITIFS_INSTALLÉS,
  TOUS_DISPOSITIFS,
  résoudreDéfauts,
} from "./favoris.js";
import type { TypedNested} from "@constl/bohr-db";
import type { Constellation, ServicesConstellation } from "./constellation.js";
import type { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import type { Oublier } from "./crabe/types.js";
import type { StructureTableau} from "./tableaux.js";
import type {
  Métadonnées,
  PartielRécursif,
  StatutDonnées,
  TraducsTexte,
} from "./types.js";
import type {
  BaseÉpingleFavoris} from "./favoris.js";
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
  [motClef: string]: null;
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

  async effacerBd({ idNuée }: { idNuée: string }): Promise<void> {
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
}
