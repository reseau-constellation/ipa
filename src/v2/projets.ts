import { join } from "path";
import {
  attendreStabilité,
  faisRien,
  suivreDeFonctionListe,
  traduire,
  uneFois,
  zipper,
} from "@constl/utils-ipa";
import { utils as xlsxUtils, write as xlsxWrite } from "xlsx";
import toBuffer from "it-to-buffer";
import Base64 from "crypto-js/enc-base64url.js";
import md5 from "crypto-js/md5.js";
import { cacheSuivi } from "./nébuleuse/cache.js";
import { conversionsTypes, définis } from "./utils.js";
import { schémaStatutDonnées, schémaTraducsTexte } from "./schémas.js";
import { RechercheProjets } from "./recherche/projets.js";
import {
  DISPOSITIFS_INSTALLÉS,
  TOUS_DISPOSITIFS,
  résoudreDéfauts,
} from "./nébuleuse/services/favoris.js";
import { ObjetConstellation } from "./objets.js";
import type { Variables } from "./variables.js";
import type { MotsClefs } from "./motsClefs.js";
import type { ServicesNécessairesObjet } from "./objets.js";
import type { BookType, WorkBook } from "xlsx";
import type { DagCborEncodable } from "@orbitdb/core";
import type {
  BaseÉpingleFavoris,
  ÉpingleFavorisAvecId,
  ÉpingleFavorisBooléenniséeAvecId,
} from "./nébuleuse/services/favoris.js";
import type { TypedNested } from "@constl/bohr-db";
import type { Rôle } from "./nébuleuse/services/compte/accès/types.js";
import type { JSONSchemaType } from "ajv";
import type {
  InfoAuteur,
  Métadonnées,
  PartielRécursif,
  StatutDonnées,
  TraducsTexte,
} from "./types.js";
import type { Suivi, Oublier } from "./nébuleuse/types.js";
import type { Bds, DonnéesBdExportées, ÉpingleBd } from "./bds/bds.js";
import type { OptionsAppli } from "./nébuleuse/appli/appli.js";
import type { ServicesNécessairesRechercheProjets } from "./recherche/fonctions/projets.js";
import type { AccesseurService } from "./recherche/types.js";

// Types mots-clefs

export type MotClefProjet = { idMotClef: string; source: "projet" | "bds" };

// Types épingles

export type ÉpingleProjet = {
  type: "projet";
  épingle: ContenuÉpingleProjet;
};

export type ContenuÉpingleProjet = BaseÉpingleFavoris & {
  bds: ÉpingleBd;
};

// Types données

export type DonnéesProjetExportées = {
  nomProjet: string;
  bds: DonnéesBdExportées[];
};

export type DonnéesFichierProjetExportées = {
  docus: { docu: WorkBook; nom: string }[];
  documentsMédias: Set<string>;
  nomFichier: string;
};

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

export type ServicesNécessairesProjets = ServicesNécessairesObjet<"projets"> & {
  motsClefs: MotsClefs;
  bds: Bds;
  variables: Variables;
};

export class Projets extends ObjetConstellation<
  "projets",
  StructureProjet,
  ServicesNécessairesProjets
> {
  schémaObjet = schémaProjet;

  recherche: RechercheProjets;

  constructor({
    services,
    options,
  }: {
    services: ServicesNécessairesProjets;
    options: OptionsAppli;
  }) {
    super({
      clef: "projets",
      services,
      dépendances: ["motsClefs", "bds", "favoris", "compte", "orbite", "hélia"],
      options,
    });

    this.recherche = new RechercheProjets({
      projets: this,
      service: ((clef) =>
        clef === "projets"
          ? this
          : this.service(
              clef,
            )) as AccesseurService<ServicesNécessairesRechercheProjets>,
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
    return this.suivreObjets({ f, idCompte });
  }

  async créerProjet({
    épingler = true,
  }: { épingler?: boolean } = {}): Promise<string> {
    const compte = this.service("compte");

    const { bd, oublier: oublierBd } = await compte.créerObjet({
      type: "nested",
    });
    const idProjet = this.ajouterProtocole(bd.address);
    const { projet, oublier } = await this.ouvrirProjet({ idProjet });

    await this.ajouterÀMesProjets({ idProjet, épingler });

    await projet.insert({
      type: "projet",
      statut: { statut: "active" },
    });

    await oublierBd();
    await oublier();

    return idProjet;
  }

  async effacerProjet({ idProjet }: { idProjet: string }): Promise<void> {
    const orbite = this.service("orbite");

    // D'abord effacer l'entrée dans notre liste de Projets
    await this.enleverDeMesProjets({ idProjet });

    await this.désépingler({ idProjet });

    // enfin, effacer le Projet lui-même
    await orbite.effacerBd({ id: this.àIdOrbite(idProjet) });
  }

  async ajouterÀMesProjets({
    idProjet,
    épingler = true,
  }: {
    idProjet: string;
    épingler?: boolean;
  }): Promise<void> {
    if (épingler) await this.épingler({ idProjet });
    await this.ajouterÀMesObjets({ idObjet: idProjet });
  }

  async enleverDeMesProjets({ idProjet }: { idProjet: string }): Promise<void> {
    await this.enleverDeMesObjets({ idObjet: idProjet });
  }

  async copierProjet({ idProjet }: { idProjet: string }): Promise<string> {
    const { projet, oublier } = await this.ouvrirProjet({ idProjet });

    const idNouveauProjet = await this.créerProjet();

    const { projet: nouveauProjet, oublier: oublierNouveau } =
      await this.ouvrirProjet({
        idProjet: idNouveauProjet,
      });

    await nouveauProjet.insert(await projet.all());
    await nouveauProjet.set("copiéDe", { id: idProjet });

    await Promise.allSettled([oublier(), oublierNouveau()]);
    return idNouveauProjet;
  }

  @cacheSuivi
  async suivreSource({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: Suivi<{ id?: string } | undefined>;
  }): Promise<Oublier> {
    return await this.suivreObjet({
      idObjet: idProjet,
      f: async (projet) => await f(projet.copiéDe),
    });
  }

  async ouvrirProjet({
    idProjet,
  }: {
    idProjet: string;
  }): Promise<{ projet: TypedNested<StructureProjet>; oublier: Oublier }> {
    const { objet, oublier } = await this.ouvrirObjet({ idObjet: idProjet });
    return { projet: objet, oublier };
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
    return await this.donnerAccèsObjet({
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
    return await this.suivreAuteursObjet({ idObjet: idProjet, f });
  }

  async confirmerPermission({ idProjet }: { idProjet: string }): Promise<void> {
    const compte = this.service("compte");

    if (!(await compte.permission({ idObjet: this.àIdOrbite(idProjet) })))
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
    options?: PartielRécursif<ContenuÉpingleProjet>;
  }) {
    const favoris = this.service("favoris");

    const épingle: ContenuÉpingleProjet = résoudreDéfauts(options, {
      base: TOUS_DISPOSITIFS,
      bds: {
        type: "bd",
        épingle: {
          base: TOUS_DISPOSITIFS,
          données: {
            tableaux: TOUS_DISPOSITIFS,
            fichiers: DISPOSITIFS_INSTALLÉS,
          },
        },
      },
    });
    await favoris.épinglerFavori({
      idObjet: idProjet,
      épingle: { type: "projet", épingle },
    });
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
    f: Suivi<ÉpingleProjet | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    const favoris = this.service("favoris");

    return await favoris.suivreFavoris({
      idCompte,
      f: async (épingles) => {
        const épingleProjet = épingles?.find(({ idObjet, épingle }) => {
          return idObjet === idProjet && épingle.type === "projet"
            ? épingle
            : undefined;
        }) as ÉpingleFavorisAvecId<ContenuÉpingleProjet> | undefined;
        await f(épingleProjet?.épingle as ÉpingleProjet);
      },
    });
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisBooléenniséeAvecId<ÉpingleProjet>;
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
    if (épingle.épingle.épingle.base) {
      const oublierBase = await this.suivreObjet({
        idObjet: épingle.idObjet,
        f: async (projet) => {
          info.base = [this.àIdOrbite(épingle.idObjet), projet.image];
          await fFinale();
        },
      });
      fsOublier.push(oublierBase);
    }

    // Bds associées
    const { bds: épingleBds } = épingle.épingle.épingle;
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
          if (épingleBds.épingle)
            return await serviceBds.suivreRésolutionÉpingle({
              épingle: {
                idObjet: idBd,
                épingle: {
                  type: "bd",
                  épingle: épingleBds.épingle,
                },
              },
              f: fSuivreBranche,
            });
          else return faisRien;
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
    noms: TraducsTexte;
  }): Promise<void> {
    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });
    await projet.insert("noms", noms);
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
    await projet.insert(`noms/${langue}`, nom);
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
    return await this.suivreObjet({
      idObjet: idProjet,
      f: (projet) => f(définis(projet.noms || {})),
    });
  }

  // Descriptions

  async sauvegarderDescriptions({
    idProjet,
    descriptions,
  }: {
    idProjet: string;
    descriptions: TraducsTexte;
  }): Promise<void> {
    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });
    await projet.insert("descriptions", descriptions);
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
    return await this.suivreObjet({
      idObjet: idProjet,
      f: (projet) => f(définis(projet.descriptions || {})),
    });
  }

  // Image

  async sauvegarderImage({
    idProjet,
    image,
  }: {
    idProjet: string;
    image: { contenu: Uint8Array; nomFichier: string };
  }): Promise<string> {
    const { sauvegarder: maxTailleImage } =
      await this.service("compte").maxTailleImages();

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
    const { visualiser: maxTailleImage } =
      await this.service("compte").maxTailleImages();

    return await this.suivreObjet({
      idObjet: idProjet,
      f: async (projet) => {
        const idImage = projet.image;
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

    await projet.insert("métadonnées", métadonnées);
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
    return await this.suivreObjet({
      idObjet: idProjet,
      f: async (projet) => {
        await f(définis(projet.métadonnées || {}));
      },
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
    const motsClefs = this.service("motsClefs");

    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];

    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });

    for (const id of idsMotsClefs) {
      await projet.put(`motsClefs/${motsClefs.enleverProtocole(id)}`, null);
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
    const motsClefs = this.service("motsClefs");

    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });

    await projet.del(`motsClefs/${motsClefs.enleverProtocole(idMotClef)}`);

    await oublier();
  }

  @cacheSuivi
  async suivreMotsClefs({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: Suivi<MotClefProjet[]>;
  }): Promise<Oublier> {
    const bds = this.service("bds");
    const serviceMotsClefs = this.service("motsClefs");

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

    const oublierMotsClefsPropres = await this.suivreObjet({
      idObjet: idProjet,
      f: async (projet) => {
        motsClefs.propres = Object.keys(projet.motsClefs || {}).map((id) =>
          serviceMotsClefs.ajouterProtocole(id),
        );
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
    const bds = this.service("bds");

    if (!Array.isArray(idsBds)) idsBds = [idsBds];

    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });

    for (const id of idsBds) {
      await projet.put(`bds/${bds.enleverProtocole(id)}`, null);
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
    const bds = this.service("bds");

    await this.confirmerPermission({ idProjet });

    const { projet, oublier } = await this.ouvrirProjet({ idProjet });

    await projet.del(`bds/${bds.enleverProtocole(idBd)}`);

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
    const bds = this.service("bds");

    return await this.suivreObjet({
      idObjet: idProjet,
      f: (projet) =>
        f(
          Object.keys(projet.motsClefs || {}).map((id) =>
            bds.ajouterProtocole(id),
          ),
        ),
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
    f: Suivi<PartielRécursif<StatutDonnées> | undefined>;
  }): Promise<Oublier> {
    return await this.suivreObjet({
      idObjet: idProjet,
      f: (projet) => f(projet.statut),
    });
  }

  // Empreinte

  async suivreEmpreinteTête({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: Suivi<string>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");

    const empreintes: {
      bds?: string[];
      variables?: string[];
      projet?: string;
    } = {};
    const fFinale = async () => {
      const texte = [
        empreintes.projet,
        ...(empreintes.bds || []),
        ...(empreintes.variables || []),
      ]
        .toSorted()
        .join("/");
      await f(Base64.stringify(md5(texte)));
    };

    const oublierEmpreinteProjet = await orbite.suivreEmpreinteTêteBd({
      idBd: idProjet,
      f: async (x) => {
        empreintes.projet = x;
        await fFinale();
      },
    });

    const oublierEmpreintesBds = await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }) =>
        await this.suivreBds({ idProjet, f: fSuivreRacine }),
      fBranche: async ({
        id: idBd,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: Suivi<string>;
      }) =>
        await this.service("bds").suivreEmpreinteTête({
          idBd,
          f: fSuivreBranche,
        }),
      f: async (x: string[]) => {
        empreintes.bds = x;
        await fFinale();
      },
    });

    const oublierEmpreinteVariables = await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }) =>
        await this.suivreVariables({ idProjet, f: fSuivreRacine }),
      fBranche: async ({ id: idVariable, fSuivreBranche }) =>
        await orbite.suivreEmpreinteTêteBd({
          idBd: idVariable,
          f: fSuivreBranche,
        }),
      f: async (x: string[]) => {
        empreintes.variables = x;
        await fFinale();
      },
    });

    return async () => {
      await oublierEmpreintesBds();
      await oublierEmpreinteVariables();
      await oublierEmpreinteProjet();
    };
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

      const idCourt = this.enleverProtocole(idProjet);
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
      async (fSuivi: Suivi<DonnéesProjetExportées>): Promise<Oublier> => {
        return await this.suivreDonnéesExportation({
          idProjet,
          langues,
          f: fSuivi,
        });
      },
      attendreStabilité(patience),
    );

    nomFichier = nomFichier || données.nomProjet;

    const documentsMédias = new Set<string>();
    données.bds.forEach((bd) => {
      bd.tableaux.forEach((t) =>
        t.documentsMédias.forEach((x) => documentsMédias.add(x)),
      );
    });

    return {
      docus: données.bds.map((donnéesBd) => {
        const docu = xlsxUtils.book_new();
        for (const tableau of donnéesBd.tableaux) {
          /* Créer le tableau */
          const tableauXLSX = xlsxUtils.json_to_sheet(tableau.données);

          /* Ajouter la feuille au document. XLSX n'accepte pas les noms de colonne > 31 caractères */
          xlsxUtils.book_append_sheet(
            docu,
            tableauXLSX,
            tableau.nomTableau.slice(0, 30),
          );
        }
        return { docu, nom: donnéesBd.nomBd };
      }),
      documentsMédias,
      nomFichier,
    };
  }

  async exporterÀFichier({
    idProjet,
    langues,
    nomFichier,
    patience = 500,
    formatDocu,
    dossier = "",
    inclureDocuments = true,
    dossierMédias,
  }: {
    idProjet: string;
    langues?: string[];
    nomFichier?: string;
    patience?: number;
    formatDocu: BookType | "xls";
    dossier?: string;
    inclureDocuments?: boolean;
    dossierMédias?: string;
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
      dossierMédias,
    });
  }

  async documentDonnéesÀFichier({
    données,
    formatDocu,
    dossier = "",
    inclureDocuments = true,
    dossierMédias,
  }: {
    données: DonnéesFichierProjetExportées;
    formatDocu: BookType | "xls";
    dossier?: string;
    inclureDocuments?: boolean;
    dossierMédias?: string;
  }): Promise<string> {
    const hélia = this.service("hélia");

    const { docus, documentsMédias, nomFichier } = données;

    const bookType: BookType = conversionsTypes[formatDocu] || formatDocu;

    const fichiersDocus = docus.map((d) => {
      return {
        nom: `${d.nom}.${formatDocu}`,
        octets: xlsxWrite(d.docu, { bookType, type: "buffer" }),
      };
    });
    const fichiersMédias = inclureDocuments
      ? await Promise.all(
          [...documentsMédias].map(async (fichier) => {
            return {
              nom: fichier.replace("/", "-"),
              octets: await toBuffer(
                await hélia.obtItérableAsyncSFIP({ id: fichier }),
              ),
            };
          }),
        )
      : [];
    await zipper({
      fichiersDocus,
      fichiersMédias,
      nomFichier: join(dossier, nomFichier),
      dossierMédias,
    });

    return join(dossier, nomFichier);
  }
}
