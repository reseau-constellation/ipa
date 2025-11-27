import { typedNested } from "@constl/bohr-db";
import { suivreDeFonctionListe } from "@constl/utils-ipa";
import { toObject } from "@orbitdb/nested-db";
import { v4 as uuidv4 } from "uuid";
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
import type {
  Rôle,
  AccèsUtilisateur,
} from "./crabe/services/compte/accès/types.js";
import type { TypedNested } from "@constl/bohr-db";
import type { Constellation, ServicesConstellation } from "./constellation.js";
import type { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import type { Oublier, Suivi } from "./crabe/types.js";
import type { StructureTableau } from "./tableaux.js";
import type {
  InfoAuteur,
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

  // Accès

  async inviterAuteur({
    idNuée,
    idCompte,
    rôle,
  }: {
    idNuée: string;
    idCompte: string;
    rôle: Rôle;
  }): Promise<void> {
    const compte = this.service("compte");

    return await compte.donnerAccèsObjet({
      idObjet: idNuée,
      identité: idCompte,
      rôle,
    });
  }

  async suivreAuteurs({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<InfoAuteur[]>;
  }): Promise<Oublier> {
    const compte = this.service("compte");

    return await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: Suivi<AccèsUtilisateur[]>;
      }) =>
        await compte.suivreAutorisations({
          idObjet: idNuée,
          f: fSuivreRacine,
        }),
      fBranche: async ({
        id: idCompte,
        fSuivreBranche,
        branche,
      }: {
        id: string;
        fSuivreBranche: Suivi<InfoAuteur>;
        branche: AccèsUtilisateur;
      }) => {
        // On doit appeler ça ici pour avancer même si l'autre compte n'est pas disponible.
        await fSuivreBranche({
          idCompte,
          accepté: false,
          rôle: branche.rôle,
        });
        return await this.suivreNuées({
          idCompte,
          f: async (nuéesCompte) => {
            return await fSuivreBranche({
              idCompte,
              accepté: (nuéesCompte || []).includes(idNuée),
              rôle: branche.rôle,
            });
          },
        });
      },
      fIdDeBranche: (x) => x.idCompte,
      f,
    });
  }

  async confirmerPermission({ idNuée }: { idNuée: string }): Promise<void> {
    const compte = this.service("compte");

    if (!(await compte.permission({ idObjet: idNuée })))
      throw new Error(
        `Permission de modification refusée pour la nuée ${idNuée}.`,
      );
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


  async sauvegarderNoms({
    idNuée,
    noms,
  }: {
    idNuée: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });

    for (const lng in noms) {
      await nuée.set(`noms/${lng}`, noms[lng]);
    }

    await oublier();
  }

  async sauvegarderNom({
    idNuée,
    langue,
    nom,
  }: {
    idNuée: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });

    await nuée.set(`noms/${langue}`, nom);
    await oublier();
  }

  async effacerNom({
    idNuée,
    langue,
  }: {
    idNuée: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });
    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });
    await nuée.del(`noms/${langue}`);

    await oublier();
  }

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

  async sauvegarderDescriptions({
    idNuée,
    descriptions,
  }: {
    idNuée: string;
    descriptions: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });
    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });
    for (const lng in descriptions) {
      await nuée.set(`descriptions/${lng}`, descriptions[lng]);
    }
    await oublier();
  }

  async sauvegarderDescription({
    idNuée,
    langue,
    description,
  }: {
    idNuée: string;
    langue: string;
    description: string;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });
    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });
    await nuée.set(`descriptions/${langue}`, description);
    await oublier();
  }

  async effacerDescription({
    idNuée,
    langue,
  }: {
    idNuée: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });
    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });
    await nuée.del(`descriptions/${langue}`);
    await oublier();
  }

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

  async ajouterMotsClefs({
    idNuée,
    idsMotsClefs,
  }: {
    idNuée: string;
    idsMotsClefs: string | string[];
  }): Promise<void> {
    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];

    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });

    for (const id of idsMotsClefs) {
      await nuée.put(`motsClefs/${id}`, null);
    }
    await oublier();
  }

  async effacerMotClef({
    idNuée,
    idMotClef,
  }: {
    idNuée: string;
    idMotClef: string;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });

    await nuée.del(`motsClefs/${idMotClef}`);

    await oublier();
  }

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

  // Tableaux

  async ajouterTableau({
    idNuée,
    idTableau,
  }: {
    idNuée: string;
    idTableau?: string;
  }): Promise<string> {
    await this.confirmerPermission({ idNuée });

    idTableau = idTableau || uuidv4();
    return await this.tableaux.créerTableau({ idStructure: idNuée, idTableau });
  }

  async effacerTableau({
    idNuée,
    idTableau,
  }: {
    idNuée: string;
    idTableau: string;
  }): Promise<void> {
    // L'interface du tableau s'occupe de tout !
    await this.tableaux.effacerTableau({ idStructure: idNuée, idTableau });
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
      fSuivreBranche: Suivi<string[]>;
    }): Promise<Oublier> => {
      return await this.tableaux.suivreVariables({
        idStructure: idNuée,
        idTableau: id,
        f: fSuivreBranche,
      });
    };

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<Oublier> => {
      return await this.suivreTableaux({
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
    const oublierNoms = await this.suivreNoms({
      idNuée,
      f: (noms) => {
        rés.noms = noms;
        fFinale();
      },
    });

    const oublierDescr = await this.suivreDescriptions({
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
