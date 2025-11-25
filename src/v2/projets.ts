import { suivreDeFonctionListe } from "@constl/utils-ipa";
import { toObject } from "@orbitdb/nested-db";
import { ServiceDonnéesNébuleuse } from "./crabe/services/services.js";
import { cacheSuivi } from "./crabe/cache.js";
import { ajouterProtocoleOrbite } from "./utils.js";
import { schémaStatutDonnées, schémaTraducsTexte } from "./schémas.js";
import { RechercheProjets } from "./recherche/projets.js";
import type { JSONSchemaType } from "ajv";
import type { Constellation, ServicesConstellation } from "./constellation.js";
import type { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import type { PartielRécursif, StatutDonnées, TraducsTexte } from "./types.js";
import type { Suivi, Oublier } from "./crabe/types.js";

// Types structure

export type StructureProjet = {
  type: "projet";
  noms: TraducsTexte;
  descriptions: TraducsTexte;
  image: string;
  motsClefs: { [id: string]: null };
  bds: { [id: string]: null };
  statut: StatutDonnées;
  copiéDe: { id: string };
};

export const schémaProjet: JSONSchemaType<PartielRécursif<StructureProjet>> = {
  type: "object",
  properties: {
    type: { type: "string", nullable: true },
    noms: schémaTraducsTexte,
    descriptions: schémaTraducsTexte,
    image: { type: "string", nullable: true },
    motsClefs: {
      type: "object",
      nullable: true,
      additionalProperties: {
        type: "null",
        nullable: true,
      },
    },
    bds: {
      type: "object",
      nullable: true,
      additionalProperties: {
        type: "null",
        nullable: true,
      },
    },
    statut: schémaStatutDonnées,
    copiéDe: {
      type: "object",
      properties: {
        id: { type: "string", nullable: true },
      },
      required: [],
      nullable: true,
    },
  },
};

export type StructureServiceProjets = {
  [projet: string]: null;
};

export const SchémaServiceProjets: JSONSchemaType<
  PartielRécursif<StructureServiceProjets>
> = {
  type: "object",
  additionalProperties: true,
  required: [],
};
export class Projets<
  L extends ServicesLibp2pCrabe,
> extends ServiceDonnéesNébuleuse<
  "projets",
  StructureServiceProjets,
  L,
  ServicesConstellation<L>
> {
  recherche: RechercheProjets<L>;

  constructor({ nébuleuse }: { nébuleuse: Constellation }) {
    super({
      clef: "projets",
      nébuleuse,
      dépendances: ["compte", "orbite", "hélia"],
      options: {
        schéma: SchémaServiceProjets,
      },
    });
    this.recherche = new RechercheProjets({
      nuées: this,
      constl: this.nébuleuse,
      service: (clef) => this.service(clef),
    });
  }

  @cacheSuivi
  async suivreProjets({
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
          f: async (projets) =>
            await fSuivreRacine(
              projets ? Object.keys(projets).map(ajouterProtocoleOrbite) : [],
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

  // Noms

  @cacheSuivi
  async suivreNoms({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: Suivi<TraducsTexte>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idProjet,
      type: "nested",
      schéma: schémaProjet,
      f: (projet) => f(toObject(projet).noms || {}),
    });
  }

  // Descriptions

  @cacheSuivi
  async suivreDescriptions({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: Suivi<TraducsTexte>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idProjet,
      type: "nested",
      schéma: schémaProjet,
      f: (projet) => f(toObject(projet).descriptions || {}),
    });
  }

  // Mots-clefs

  @cacheSuivi
  async suivreMotsClefs({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: Suivi<{ idMotClef: string; source: "projet" | "bds" }[]>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");
    const bds = this.service("bds");

    const motsClefs: { propres?: string[]; bds?: string[] } = {};

    const fFinale = async () => {
      if (motsClefs.propres && motsClefs.bds) {
        const motsClefsFinaux = [
          ...motsClefs.propres.map((idMotClef) => ({
            idMotClef,
            source: "projet",
          })),
          ...motsClefs.bds.map((idMotClef) => ({ idMotClef, source: "bds" })),
        ] as { idMotClef: string; source: "projet" | "bds" }[];
        return await f(motsClefsFinaux);
      }
    };

    const oublierMotsClefsPropres = await orbite.suivreDonnéesBd({
      id: idProjet,
      type: "nested",
      schéma: schémaProjet,
      f: async (projet) => {
        motsClefs.propres = Object.keys(toObject(projet).motsClefs);
        return await fFinale();
      },
    });

    const fFinaleBds = async (mots: string[]) => {
      motsClefs.bds = mots;
      return await fFinale();
    };
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<Oublier> => {
      return await this.suivreBds({ idProjet, f: fSuivreRacine });
    };
    const fBranche = async ({
      id: idBd,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: Suivi<string[]>;
    }): Promise<Oublier> => {
      return await bds.suivreMotsClefs({
        idBd,
        f: fSuivreBranche,
      });
    };
    const oublierMotsClefsBds = await suivreDeFonctionListe({
      fListe,
      fBranche,
      f: fFinaleBds,
    });

    return async () => {
      await oublierMotsClefsPropres();
      await oublierMotsClefsBds();
    };
  }

  // Bds

  @cacheSuivi
  async suivreBds({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");

    return await orbite.suivreDonnéesBd({
      id: idProjet,
      type: "nested",
      schéma: schémaProjet,
      f: (bd) => f(Object.keys(toObject(bd).motsClefs)),
    });
  }

  // Variables

  @cacheSuivi
  async suivreVariables({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    const bds = this.service("bds");

    return await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }: { fSuivreRacine: Suivi<string[]> }) =>
        await this.suivreBds({ idProjet, f: fSuivreRacine }),
      fBranche: async ({
        id: idBd,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: Suivi<string[]>;
      }): Promise<Oublier> => {
        return await bds.suivreVariables({
          idBd,
          f: fSuivreBranche,
        });
      },
      f,
    });
  }

  // Qualité

  @cacheSuivi
  async suivreScoreQualité({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: Suivi<number>;
  }): Promise<Oublier> {
    const bds = this.service("bds");

    const fFinale = async (scoresBds: number[]) => {
      return await f(
        scoresBds.length
          ? scoresBds.reduce((a, b) => a + b, 0) / scoresBds.length
          : 0,
      );
    };
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: Suivi<string[]>;
    }): Promise<Oublier> => {
      return await this.suivreBds({ idProjet, f: fSuivreRacine });
    };
    const fBranche = async ({
      id: idBd,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: Suivi<number>;
    }): Promise<Oublier> => {
      return await bds.suivreScoreQualité({
        idBd,
        f: (score) => fSuivreBranche(score.total),
      });
    };
    const fRéduction = (scores: number[]) => {
      return scores.flat();
    };
    return await suivreDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
      fRéduction,
    });
  }
}
