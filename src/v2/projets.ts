import { join } from "path";
import { attendreStabilité, suivreDeFonctionListe, traduire, uneFois, zipper } from "@constl/utils-ipa";
import { toObject } from "@orbitdb/nested-db";
import { typedNested } from "@constl/bohr-db";
import { utils as xlsxUtils, write as xlsxWrite } from "xlsx";
import toBuffer from "it-to-buffer";
import { ServiceDonnéesNébuleuse } from "./crabe/services/services.js";
import { cacheSuivi } from "./crabe/cache.js";
import { ajouterProtocoleOrbite, conversionsTypes, extraireEmpreinte } from "./utils.js";
import { schémaStatutDonnées, schémaTraducsTexte } from "./schémas.js";
import { RechercheProjets } from "./recherche/projets.js";
import {
  DISPOSITIFS_INSTALLÉS,
  TOUS_DISPOSITIFS,
  résoudreDéfauts,
} from "./favoris.js";
import { mapÀObjet } from "./crabe/utils.js";
import type { BookType, WorkBook} from "xlsx";
import type { DagCborEncodable } from "@orbitdb/core";
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
  Métadonnées,
  PartielRécursif,
  StatutDonnées,
  TraducsTexte,
} from "./types.js";
import type { Suivi, Oublier } from "./crabe/types.js";
import type { DonnéesBdExportées, ÉpingleBd } from "./bds/bds.js";

// Types épingles

export type ÉpingleProjet = BaseÉpingleFavoris & {
  type: "projet";
  bds: ÉpingleBd;
};

// Types données

export type DonnéesProjetExportées = {
  nomProjet: string;
  bds: DonnéesBdExportées[];
};

export type DonnéesFichierProjetExportées = {
  docs: { doc: WorkBook; nom: string }[];
  fichiersSFIP: Set<string>;
  nomFichier: string;
}

// Types structure

export type StructureProjet = {
  type: "projet";
  noms: TraducsTexte;
  descriptions: TraducsTexte;
  image: string;
  motsClefs: { [id: string]: null };
  bds: { [id: string]: null };
  métadonnées: Métadonnées;
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
    métadonnées: {
      type: "object",
      additionalProperties: true,
      required: [],
      nullable: true,
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
      dépendances: ["bds", "compte", "orbite", "hélia"],
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

  async copierProjet({
    idProjet,
  }: {
    idProjet: string;
  }): Promise<string> {
    const { projet, oublier } = await this.ouvrirProjet({ idProjet });
    
    const idNouveauProjet = await this.créerProjet();

    const métadonnées = mapÀObjet(await projet.get("métadonnées"));
    if (métadonnées) {
      await this.sauvegarderMétadonnées({ idProjet: idNouveauProjet, métadonnées });
    }

    const noms = mapÀObjet(await projet.get("noms"));
    if (noms) {
      await this.sauvegarderNoms({ idProjet: idNouveauProjet, noms });
    }

    const descriptions = mapÀObjet(await projet.get("descriptions"));
    if (descriptions) {
      await this.sauvegarderDescriptions({
        idProjet: idNouveauProjet,
        descriptions,
      });
    }

    const motsClefs = await projet.get("motsClefs");
    if (motsClefs)
      await this.ajouterMotsClefs({
        idProjet: idNouveauProjet,
        idsMotsClefs: Object.keys(mapÀObjet(motsClefs)!),
      });

    const statut = await projet.get("statut");
    if (statut)
      await this.sauvegarderStatut({
        idProjet: idNouveauProjet,
        statut: mapÀObjet(statut)!,
      });

    const { projet: nouveauProjet, oublier: oublierNouveau } = await this.ouvrirProjet({
      idProjet: idNouveauProjet,
    });

    const image = await projet.get("image");
    if (image) await nouveauProjet.set(`image`, image);

    await nouveauProjet.set("copiéDe", { id: idProjet });

    await Promise.allSettled([oublier(), oublierNouveau()]);
    return idNouveauProjet;
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
      const oublierBase = await orbite.suivreBdTypée({
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
      fsOublier.push(oublierBase);
    }

    // Bds associées
    const { bds: épingleBds } = épingle.épingle;
    if (épingleBds) {
      const serviceBds = this.service("bds");
      const oublierBds = await suivreDeFonctionListe({
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
      fsOublier.push(oublierBds);
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

  // Image

  async sauvegarderImage({
    idProjet,
    image,
  }: {
    idProjet: string;
    image: { contenu: Uint8Array; nomFichier: string };
  }): Promise<string> {
    const maxTailleImage =
      this.service("compte").options.consts.maxTailleImageSauvegarder;

    if (image.contenu.byteLength > maxTailleImage) {
      throw new Error("Taille maximale excédée");
    }

    const idImage = await this.service("hélia").ajouterFichierÀSFIP(image);

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });
    await projet.set("image", idImage);
    await oublier();

    return idImage;
  }

  async effacerImage({ idProjet }: { idProjet: string }): Promise<void> {
    const { projet, oublier } = await this.ouvrirProjet({ idProjet });
    await projet.del("image");
    await oublier();
  }

  @cacheSuivi
  async suivreImage({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: Suivi<{ image: Uint8Array; idImage: string } | null>;
  }): Promise<Oublier> {
    const maxTailleImage =
      this.service("compte").options.consts.maxTailleImageVisualiser;

    return await this.service("orbite").suivreDonnéesBd({
      id: idProjet,
      type: "nested",
      schéma: schémaProjet,
      f: async (projet) => {
        const idImage = projet.get("image");
        if (!idImage) {
          return await f(null);
        } else {
          const image = await this.service("hélia").obtFichierDeSFIP({
            id: idImage,
            max: maxTailleImage,
          });
          return await f(image ? { image, idImage } : null);
        }
      },
    });
  }

  // Métadonnées

  async sauvegarderMétadonnées({
    idProjet,
    métadonnées,
  }: {
    idProjet: string;
    métadonnées: Métadonnées;
  }): Promise<void> {
    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });

    await projet.put("métadonnées", métadonnées);
    await oublier();
  }

  async sauvegarderMétadonnée({
    idProjet,
    clef,
    valeur,
  }: {
    idProjet: string;
    clef: string;
    valeur: DagCborEncodable;
  }): Promise<void> {
    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });
    await projet.set(`métadonnées/${clef}`, valeur);
    await oublier();
  }

  async effacerMétadonnée({
    idProjet,
    clef,
  }: {
    idProjet: string;
    clef: string;
  }): Promise<void> {
    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });
    await projet.del(`métadonnées/${clef}`);
    await oublier();
  }

  @cacheSuivi
  async suivreMétadonnées({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: Suivi<Métadonnées>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idProjet,
      type: "nested",
      schéma: schémaProjet,
      f: async (projet) => {
        await f(mapÀObjet(projet.get("métadonnées")) || {});
      },
    });
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

  async enleverBd({
    idProjet,
    idBd,
  }: {
    idProjet: string;
    idBd: string;
  }): Promise<void> {
    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });

    await projet.del(`bds/${idBd}`);

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


  // Statut

  async sauvegarderStatut({
    idProjet,
    statut,
  }: {
    idProjet: string;
    statut: StatutDonnées;
  }): Promise<void> {
    const { projet, oublier } = await this.ouvrirProjet({ idProjet });
    projet.set("statut", statut);
    await oublier();
  }

  @cacheSuivi
  async suivreStatut({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: Suivi<StatutDonnées | null>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");
    return await orbite.suivreDonnéesBd({
      id: idProjet,
      type: "nested",
      schéma: schémaProjet,
      f: (projet) => f(mapÀObjet(projet)?.statut || null),
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

  // Exportation

  async suivreDonnéesExportation({
    idProjet,
    langues,
    f,
  }: {
    idProjet: string;
    langues?: string[];
    f: Suivi<DonnéesProjetExportées>;
  }): Promise<Oublier> {
    const bds = this.service("bds");

    const info: {
      nomsProjet?: TraducsTexte;
      données?: DonnéesBdExportées[];
    } = {};
    const fsOublier: Oublier[] = [];

    const fFinale = async () => {
      const { nomsProjet, données } = info;
      if (!données) return;

      const idCourt = idProjet.split("/").pop()!;
      const nomProjet =
        nomsProjet && langues
          ? traduire(nomsProjet, langues) || idCourt
          : idCourt;
      return await f({
        nomProjet,
        bds: données,
      });
    };

    const oublierDonnées = await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (éléments: string[]) => Promise<void>;
      }) => {
        return await this.suivreBds({ idProjet, f: fSuivreRacine });
      },
      f: async (données: DonnéesBdExportées[]) => {
        info.données = données;
        await fFinale();
      },
      fBranche: async ({
        id,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: Suivi<DonnéesBdExportées>;
      }): Promise<Oublier> => {
        return await bds.suivreDonnéesExportation({
          idBd: id,
          langues,
          f: fSuivreBranche,
        });
      },
    });
    fsOublier.push(oublierDonnées);

    if (langues) {
      const oublierNomsProjet = await this.suivreNoms({
        idProjet,
        f: async (noms) => {
          info.nomsProjet = noms;
          await fFinale();
        },
      });
      fsOublier.push(oublierNomsProjet);
    }

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
  }

  async exporterDonnées({
    idProjet,
    langues,
    nomFichier,
    patience = 500,
  }: {
    idProjet: string;
    langues?: string[];
    nomFichier?: string;
    patience?: number;
  }): Promise<DonnéesFichierProjetExportées> {
    const données = await uneFois(
      async (
        fSuivi: Suivi<DonnéesProjetExportées>,
      ): Promise<Oublier> => {
        return await this.suivreDonnéesExportation({
          idProjet,
          langues,
          f: fSuivi,
        });
      },
      attendreStabilité(patience),
    );

    nomFichier = nomFichier || données.nomProjet;

    const fichiersSFIP = new Set<string>();
    données.bds.forEach((bd) => {
      bd.tableaux.forEach((t) =>
        t.fichiersSFIP.forEach((x) => fichiersSFIP.add(x)),
      );
    });

    return {
      docs: données.bds.map((donnéesBd) => {
        const doc = xlsxUtils.book_new();
        for (const tableau of donnéesBd.tableaux) {
          /* Créer le tableau */
          const tableauXLSX = xlsxUtils.json_to_sheet(tableau.données);

          /* Ajouter la feuille au document. XLSX n'accepte pas les noms de colonne > 31 caractères */
          xlsxUtils.book_append_sheet(
            doc,
            tableauXLSX,
            tableau.nomTableau.slice(0, 30),
          );
        }
        return { doc, nom: donnéesBd.nomBd };
      }),
      fichiersSFIP,
      nomFichier,
    };
  }

  async exporterProjetÀFichier({
    idProjet,
    langues,
    nomFichier,
    patience = 500,
    formatDocu,
    dossier = "",
    inclureDocuments = true,
  }: {
    idProjet: string;
    langues?: string[];
    nomFichier?: string;
    patience?: number;
    formatDocu: BookType | "xls";
    dossier?: string;
    inclureDocuments?: boolean;
  }): Promise<string> {
    const donnéesExportées = await this.exporterDonnées({
      idProjet,
      langues,
      nomFichier,
      patience,
    });
    return await this.documentDonnéesÀFichier({
      données: donnéesExportées,
      formatDocu,
      dossier,
      inclureDocuments,
    });
  }

  async documentDonnéesÀFichier({
    données,
    formatDocu,
    dossier = "",
    inclureDocuments = true,
  }: {
    données: DonnéesFichierProjetExportées;
    formatDocu: BookType | "xls";
    dossier?: string;
    inclureDocuments?: boolean;
  }): Promise<string> {
    const hélia = this.service("hélia");

    const { docs, fichiersSFIP, nomFichier } = données;

    const bookType: BookType = conversionsTypes[formatDocu] || formatDocu;

    const fichiersDocs = docs.map((d) => {
      return {
        nom: `${d.nom}.${formatDocu}`,
        octets: xlsxWrite(d.doc, { bookType, type: "buffer" }),
      };
    });
    const fichiersDeSFIP = inclureDocuments
      ? await Promise.all(
          [...fichiersSFIP].map(async (fichier) => {
            return {
              nom: fichier.replace("/", "-"),
              octets: await toBuffer(
                await hélia.obtItérableAsyncSFIP({ id: fichier }),
              ),
            };
          }),
        )
      : [];
    await zipper(fichiersDocs, fichiersDeSFIP, join(dossier, nomFichier));
    return join(dossier, nomFichier);
  }
}
