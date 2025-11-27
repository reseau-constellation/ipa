import { suivreDeFonctionListe } from "@constl/utils-ipa";
import { toObject } from "@orbitdb/nested-db";
import { typedNested } from "@constl/bohr-db";
import { ServiceDonnéesNébuleuse } from "./crabe/services/services.js";
import { cacheSuivi } from "./crabe/cache.js";
import { ajouterProtocoleOrbite, extraireEmpreinte } from "./utils.js";
import { schémaStatutDonnées, schémaTraducsTexte } from "./schémas.js";
import { RechercheProjets } from "./recherche/projets.js";
import {
  DISPOSITIFS_INSTALLÉS,
  TOUS_DISPOSITIFS,
  résoudreDéfauts,
} from "./favoris.js";
import type {
  BaseÉpingleFavoris,
  ÉpingleFavorisAvecIdBooléennisée,
} from "./favoris.js";
import type { TypedNested } from "@constl/bohr-db";
import type {
  Rôle,
  AccèsUtilisateur,
} from "./crabe/services/compte/accès/types.js";
import type { JSONSchemaType } from "ajv";
import type { Constellation, ServicesConstellation } from "./constellation.js";
import type { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import type {
  InfoAuteur,
  PartielRécursif,
  StatutDonnées,
  TraducsTexte,
} from "./types.js";
import type { Suivi, Oublier } from "./crabe/types.js";
import type { ÉpingleBd } from "./bds/bds.js";

// Types épingles

export type ÉpingleProjet = BaseÉpingleFavoris & {
  type: "projet";
  bds: ÉpingleBd;
};

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
      projets: this,
      constl: this.nébuleuse,
      service: (clef) => this.service(clef),
    });

    const favoris = this.service("favoris");
    favoris.inscrireRésolution({
      clef: "projet",
      résolution: this.suivreRésolutionÉpingle.bind(this),
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

  async créerProjet({
    épingler = true,
  }: { épingler?: boolean } = {}): Promise<string> {
    const compte = this.service("compte");

    const { bd, oublier: oublierBd } = await compte.créerObjet({
      type: "nested",
    });
    const idProjet = bd.address;
    await oublierBd();
    const { projet, oublier } = await this.ouvrirProjet({ idProjet });

    await this.ajouterÀMesProjets({ idProjet });

    if (épingler) await this.épingler({ idProjet });

    await projet.put({
      type: "projet",
      statut: { statut: "active" },
    });

    await oublier();

    return idProjet;
  }

  async effacerProjet({ idProjet }: { idProjet: string }): Promise<void> {
    const orbite = this.service("orbite");

    // D'abord effacer l'entrée dans notre liste de Projets
    await this.enleverDeMesProjets({ idProjet });

    const favoris = this.service("favoris");
    await favoris.désépinglerFavori({ idObjet: idProjet });

    // enfin, effacer le Projet lui-même
    await orbite.effacerBd({ id: idProjet });
  }

  async ajouterÀMesProjets({ idProjet }: { idProjet: string }): Promise<void> {
    const bd = await this.bd();
    await bd.put(extraireEmpreinte(idProjet), null);
  }

  async enleverDeMesProjets({ idProjet }: { idProjet: string }): Promise<void> {
    const bd = await this.bd();
    await bd.del(extraireEmpreinte(idProjet));
  }

  async ouvrirProjet({
    idProjet,
  }: {
    idProjet: string;
  }): Promise<{ projet: TypedNested<StructureProjet>; oublier: Oublier }> {
    const { bd, oublier } = await this.service("orbite").ouvrirBd({
      id: idProjet,
      type: "nested",
    });
    return {
      projet: typedNested<StructureProjet>({ db: bd, schema: schémaProjet }),
      oublier,
    };
  }

  // Accès

  async inviterAuteur({
    idProjet,
    idCompte,
    rôle,
  }: {
    idProjet: string;
    idCompte: string;
    rôle: Rôle;
  }): Promise<void> {
    const compte = this.service("compte");

    return await compte.donnerAccèsObjet({
      idObjet: idProjet,
      identité: idCompte,
      rôle,
    });
  }

  async suivreAuteurs({
    idProjet,
    f,
  }: {
    idProjet: string;
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
          idObjet: idProjet,
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
        return await this.suivreProjets({
          idCompte,
          f: async (projetsCompte) => {
            return await fSuivreBranche({
              idCompte,
              accepté: (projetsCompte || []).includes(idProjet),
              rôle: branche.rôle,
            });
          },
        });
      },
      fIdDeBranche: (x) => x.idCompte,
      f,
    });
  }

  async confirmerPermission({ idProjet }: { idProjet: string }): Promise<void> {
    const compte = this.service("compte");

    if (!(await compte.permission({ idObjet: idProjet })))
      throw new Error(
        `Permission de modification refusée pour le projet ${idProjet}.`,
      );
  }

  // Épingles

  async épingler({
    idProjet,
    options = {},
  }: {
    idProjet: string;
    options?: PartielRécursif<ÉpingleProjet>;
  }) {
    const favoris = this.service("favoris");

    const épingle: ÉpingleProjet = résoudreDéfauts(options, {
      type: "projet",
      base: TOUS_DISPOSITIFS,
      bds: {
        type: "bd",
        base: TOUS_DISPOSITIFS,
        données: {
          tableaux: TOUS_DISPOSITIFS,
          fichiers: DISPOSITIFS_INSTALLÉS,
        },
      },
    });
    await favoris.épinglerFavori({ idObjet: idProjet, épingle });
  }

  async désépingler({ idProjet }: { idProjet: string }): Promise<void> {
    const favoris = this.service("favoris");

    await favoris.désépinglerFavori({ idObjet: idProjet });
  }

  async suivreÉpingle({
    idProjet,
    f,
    idCompte,
  }: {
    idProjet: string;
    f: Suivi<PartielRécursif<ÉpingleProjet> | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    const favoris = this.service("favoris");

    return await favoris.suivreÉtatFavori({
      idObjet: idProjet,
      f: async (épingle) => {
        if (épingle?.type === "projet")
          await f(épingle as PartielRécursif<ÉpingleProjet>);
        else await f(undefined);
      },
      idCompte,
    });
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisAvecIdBooléennisée<ÉpingleProjet>;
    f: Suivi<Set<string>>;
  }): Promise<Oublier> {
    const info: {
      base?: (string | undefined)[];
      bds?: (string | undefined)[];
    } = {};

    const fFinale = async () => {
      return await f(
        new Set(
          Object.values(info)
            .flat()
            .filter((x) => !!x) as string[],
        ),
      );
    };

    const fsOublier: Oublier[] = [];
    const orbite = this.service("orbite");
    if (épingle.épingle.base) {
      const fOublierBase = await orbite.suivreBdTypée({
        id: épingle.idObjet,
        type: "nested",
        schéma: schémaProjet,
        f: async (bd) => {
          try {
            const image = await bd.get("image");
            info.base = [épingle.idObjet, image];
          } catch {
            return; // Si la structure n'est pas valide.
          }
          await fFinale();
        },
      });
      fsOublier.push(fOublierBase);
    }

    // Bds associées
    const { bds: épingleBds } = épingle.épingle;
    if (épingleBds) {
      const serviceBds = this.service("bds");
      const fOublierTableaux = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (éléments: string[]) => Promise<void>;
        }) => {
          return await this.suivreBds({
            idProjet: épingle.idObjet,
            f: (bds) => fSuivreRacine(bds || []),
          });
        },
        fBranche: async ({
          id: idBd,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: Suivi<Set<string>>;
        }) => {
          return await serviceBds.suivreRésolutionÉpingle({
            épingle: {
              idObjet: idBd,
              épingle: {
                ...épingleBds,
                type: "bd",
              },
            },
            f: fSuivreBranche,
          });
        },
        f: async (bds: string[]) => {
          info.bds = bds;
          await fFinale();
        },
      });
      fsOublier.push(fOublierTableaux);
    }

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
  }

  // Noms

  async sauvegarderNoms({
    idProjet,
    noms,
  }: {
    idProjet: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });
    await projet.put("noms", noms);
    await oublier();
  }

  async sauvegarderNom({
    idProjet,
    langue,
    nom,
  }: {
    idProjet: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });
    await projet.set(`noms/${langue}`, nom);
    await oublier();
  }

  async effacerNom({
    idProjet,
    langue,
  }: {
    idProjet: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });
    await projet.del(`noms/${langue}`);
    await oublier();
  }

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

  async sauvegarderDescriptions({
    idProjet,
    descriptions,
  }: {
    idProjet: string;
    descriptions: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });
    await projet.put("descriptions", descriptions);
    await oublier();
  }

  async sauvegarderDescription({
    idProjet,
    langue,
    description,
  }: {
    idProjet: string;
    langue: string;
    description: string;
  }): Promise<void> {
    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });
    await projet.set(`descriptions/${langue}`, description);
    await oublier();
  }

  async effacerDescription({
    idProjet,
    langue,
  }: {
    idProjet: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });
    await projet.del(`descriptions/${langue}`);
    await oublier();
  }

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

  async ajouterMotsClefs({
    idProjet,
    idsMotsClefs,
  }: {
    idProjet: string;
    idsMotsClefs: string | string[];
  }): Promise<void> {
    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];

    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });

    for (const id of idsMotsClefs) {
      await projet.put(`motsClefs/${id}`, null);
    }
    await oublier();
  }

  async effacerMotClef({
    idProjet,
    idMotClef,
  }: {
    idProjet: string;
    idMotClef: string;
  }): Promise<void> {
    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });

    await projet.del(`motsClefs/${idMotClef}`);

    await oublier();
  }

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

  async ajouterBds({
    idProjet,
    idsBds,
  }: {
    idProjet: string;
    idsBds: string | string[];
  }): Promise<void> {
    if (!Array.isArray(idsBds)) idsBds = [idsBds];

    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });

    for (const id of idsBds) {
      await projet.put(`bds/${id}`, null);
    }
    await oublier();
  }

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
