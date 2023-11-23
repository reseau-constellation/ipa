import type { ToFile } from "ipfs-core-types/src/utils";

import { WorkBook, BookType, write as writeXLSX, utils } from "xlsx";
import toBuffer from "it-to-buffer";
import path from "path";

import ClientConstellation from "@/client.js";
import type { objRôles } from "@/accès/types.js";
import générerContrôleurConstellation from "@/accès/cntrlConstellation.js";

type ContrôleurConstellation = Awaited<
  ReturnType<ReturnType<typeof générerContrôleurConstellation>>
>;

import { cacheSuivi } from "@/décorateursCache.js";
import {
  TYPES_STATUT,
  schémaStatut,
  schémaFonctionSuivi,
  schémaFonctionOublier,
  schémaStructureBdNoms,
  structureBdNoms,
} from "@/types.js";
import {
  traduire,
  zipper,
  uneFois,
  attendreStabilité,
  suivreBdsDeFonctionListe,
} from "@constl/utils-ipa";
import { ComposanteClientListe } from "./composanteClient.js";
import { JSONSchemaType } from "ajv";
import { donnéesBdExportation, schémaCopiéDe } from "./bds.js";
import { TypedKeyValue, TypedSet } from "@constl/bohr-db";
import { estUnContrôleurConstellation } from "./accès/utils.js";

const schémaStructureBdMotsClefsdeProjet: JSONSchemaType<string> = {
  type: "string",
};
const schémaStuctureBdsDeProjet: JSONSchemaType<string> = { type: "string" };

export interface donnéesProjetExportation {
  nomProjet: string;
  bds: donnéesBdExportation[];
}
export interface donnéesProjetExportées {
  docs: { doc: WorkBook; nom: string }[];
  fichiersSFIP: Set<string>;
  nomFichier: string;
}

export const MAX_TAILLE_IMAGE = 500 * 1000; // 500 kilooctets
export const MAX_TAILLE_IMAGE_VIS = 1500 * 1000; // 1,5 megaoctets

const schémaBdPrincipale: JSONSchemaType<string> = { type: "string" };

export type structureBdProjet = {
  type: "projet";
  noms: string;
  descriptions: string;
  image?: string;
  bds: string;
  motsClefs: string;
  statut: schémaStatut;
  copiéDe: schémaCopiéDe;
};
const schémaStructureBdProjet: JSONSchemaType<structureBdProjet> = {
  type: "object",
  properties: {
    type: { type: "string" },
    noms: { type: "string" },
    descriptions: { type: "string" },
    bds: { type: "string" },
    image: { type: "string", nullable: true },
    motsClefs: { type: "string" },
    statut: {
      type: "object",
      properties: {
        statut: { type: "string" },
        idNouvelle: { type: "string", nullable: true },
      },
      required: ["statut"],
    },
    copiéDe: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  required: ["noms", "descriptions", "statut", "type", "bds", "copiéDe"],
};

export default class Projets extends ComposanteClientListe<string> {
  constructor({ client }: { client: ClientConstellation }) {
    super({ client, clef: "projets", schémaBdPrincipale: schémaBdPrincipale });
  }

  async épingler() {
    await this.client.épingles.épinglerBd({
      id: await this.obtIdBd(),
      récursif: false,
      fichiers: false,
    });
  }

  @cacheSuivi
  async suivreProjets({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({
      idCompte,
      f,
    });
  }

  async créerProjet(): Promise<string> {
    const { bd: bdRacine, fOublier: fOublierRacine } =
      await this.client.ouvrirBdTypée({
        id: await this.obtIdBd(),
        type: "set",
        schéma: schémaBdPrincipale,
      });
    const idBdProjet = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès: {
        address: undefined,
        write: await this.client.obtIdCompte(),
      },
    });

    const { bd: bdProjet, fOublier: fOublierProjet } =
      await this.client.ouvrirBdTypée({
        id: idBdProjet,
        type: "keyvalue",
        schéma: schémaStructureBdProjet,
      });

    const accès = bdProjet.access as ContrôleurConstellation;
    if (!estUnContrôleurConstellation(accès))
      throw Error("Contrôleur de type non reconnu.");

    const optionsAccès = { address: accès.address };

    await bdProjet.set("type", "projet");

    const idBdNoms = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès,
    });
    await bdProjet.set("noms", idBdNoms);

    const idBdDescr = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès,
    });
    await bdProjet.set("descriptions", idBdDescr);

    const idBdBds = await this.client.créerBdIndépendante({
      type: "set",
      optionsAccès,
    });
    await bdProjet.set("bds", idBdBds);

    const idBdMotsClefs = await this.client.créerBdIndépendante({
      type: "set",
      optionsAccès,
    });
    await bdProjet.set("motsClefs", idBdMotsClefs);

    await bdProjet.set("statut", { statut: TYPES_STATUT.ACTIVE });

    await bdRacine.add(idBdProjet);

    await Promise.all([fOublierRacine(), fOublierProjet()]);

    return idBdProjet;
  }

  async copierProjet({ idProjet }: { idProjet: string }): Promise<string> {
    const { bd: bdBase, fOublier: fOublierBase } =
      await this.client.ouvrirBdTypée({
        id: idProjet,
        type: "keyvalue",
        schéma: schémaStructureBdProjet,
      });
    const idNouveauProjet = await this.créerProjet();
    const { bd: nouvelleBd, fOublier: fOublierNouvelle } =
      await this.client.ouvrirBdTypée({
        id: idNouveauProjet,
        type: "keyvalue",
        schéma: schémaStructureBdProjet,
      });

    const idBdNoms = await bdBase.get("noms");
    if (idBdNoms) {
      const { bd: bdNoms, fOublier: fOublierNoms } =
        await this.client.ouvrirBdTypée({
          id: idBdNoms,
          type: "keyvalue",
          schéma: schémaStructureBdNoms,
        });
      const noms = await bdNoms.allAsJSON();
      await fOublierNoms();
      await this.sauvegarderNomsProjet({ idProjet: idNouveauProjet, noms });
    }

    const idBdDescr = await bdBase.get("descriptions");
    if (idBdDescr) {
      const { bd: bdDescr, fOublier: fOublierDescr } =
        await this.client.ouvrirBdTypée({
          id: idBdDescr,
          type: "keyvalue",
          schéma: schémaStructureBdNoms,
        });
      const descriptions = await bdDescr.allAsJSON();
      await fOublierDescr();
      await this.sauvegarderDescriptionsProjet({
        idProjet: idNouveauProjet,
        descriptions,
      });
    }

    const idBdMotsClefs = await bdBase.get("motsClefs");
    if (idBdMotsClefs) {
      const { bd: bdMotsClefs, fOublier: fOublierMotsClefs } =
        await this.client.ouvrirBdTypée({
          id: idBdMotsClefs,
          type: "set",
          schéma: schémaStructureBdMotsClefsdeProjet,
        });
      const idsMotsClefs = (await bdMotsClefs.all()).map((x) => x.value);
      await fOublierMotsClefs();
      await this.ajouterMotsClefsProjet({
        idProjet: idNouveauProjet,
        idsMotsClefs,
      });
    }

    const idBdBds = await bdBase.get("bds");
    if (idBdBds) {
      const { bd: bdBds, fOublier: fOublierBds } =
        await this.client.ouvrirBdTypée({
          id: idBdBds,
          type: "set",
          schéma: schémaStuctureBdsDeProjet,
        });
      const bds = (await bdBds.all()).map((x) => x.value);
      await fOublierBds();
      await Promise.all(
        bds.map(async (idBd: string) => {
          await this.ajouterBdProjet({ idProjet: idNouveauProjet, idBd });
        }),
      );
    }

    const statut = (await bdBase.get("statut")) || {
      statut: TYPES_STATUT.ACTIVE,
    };
    await nouvelleBd.set("statut", statut);

    const image = await bdBase.get("image");
    if (image) await nouvelleBd.set("image", image);

    await nouvelleBd.set("copiéDe", { id: idProjet });

    await Promise.all([fOublierBase(), fOublierNouvelle()]);
    return idNouveauProjet;
  }

  async ajouterÀMesProjets({ idProjet }: { idProjet: string }): Promise<void> {
    const { bd: bdRacine, fOublier } = await this.client.ouvrirBdTypée({
      id: await this.obtIdBd(),
      type: "set",
      schéma: schémaBdPrincipale,
    });
    await bdRacine.add(idProjet);
    await fOublier();
  }

  async enleverDeMesProjets({ idProjet }: { idProjet: string }): Promise<void> {
    const { bd: bdRacine, fOublier } = await this.client.ouvrirBdTypée({
      id: await this.obtIdBd(),
      type: "set",
      schéma: schémaBdPrincipale,
    });
    await bdRacine.del(idProjet);
    await fOublier();
  }

  async inviterAuteur({
    idProjet,
    idCompteAuteur,
    rôle,
  }: {
    idProjet: string;
    idCompteAuteur: string;
    rôle: keyof objRôles;
  }): Promise<void> {
    await this.client.donnerAccès({
      idBd: idProjet,
      identité: idCompteAuteur,
      rôle,
    });
  }

  async _obtBdNoms({ idProjet }: { idProjet: string }): Promise<{
    bd: TypedKeyValue<structureBdNoms>;
    fOublier: schémaFonctionOublier;
  }> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idProjet,
      type: "keyvalue",
    });
    if (!idBdNoms) {
      throw new Error(
        `Permission de modification refusée pour Projet ${idProjet}.`,
      );
    }

    return await this.client.ouvrirBdTypée({
      id: idBdNoms,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
  }

  async sauvegarderNomsProjet({
    idProjet,
    noms,
  }: {
    idProjet: string;
    noms: { [langue: string]: string };
  }): Promise<void> {
    const { bd: bdNoms, fOublier } = await this._obtBdNoms({ idProjet });
    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
    await fOublier();
  }

  async sauvegarderNomProjet({
    idProjet,
    langue,
    nom,
  }: {
    idProjet: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    const { bd: bdNoms, fOublier } = await this._obtBdNoms({ idProjet });
    await bdNoms.set(langue, nom);
    await fOublier();
  }

  async effacerNomProjet({
    idProjet,
    langue,
  }: {
    idProjet: string;
    langue: string;
  }): Promise<void> {
    const { bd: bdNoms, fOublier } = await this._obtBdNoms({ idProjet });
    await bdNoms.del(langue);
    await fOublier();
  }

  async _obtBdDescr({ idProjet }: { idProjet: string }): Promise<{
    bd: TypedKeyValue<structureBdNoms>;
    fOublier: schémaFonctionOublier;
  }> {
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: idProjet,
      type: "keyvalue",
    });
    if (!idBdDescr) {
      throw new Error(
        `Permission de modification refusée pour Projet ${idProjet}.`,
      );
    }

    return await this.client.ouvrirBdTypée({
      id: idBdDescr,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
  }

  async sauvegarderDescriptionsProjet({
    idProjet,
    descriptions,
  }: {
    idProjet: string;
    descriptions: { [key: string]: string };
  }): Promise<void> {
    const { bd: bdDescr, fOublier } = await this._obtBdDescr({ idProjet });
    for (const lng in descriptions) {
      await bdDescr.set(lng, descriptions[lng]);
    }
    await fOublier();
  }

  async sauvegarderDescriptionProjet({
    idProjet,
    langue,
    description,
  }: {
    idProjet: string;
    langue: string;
    description: string;
  }): Promise<void> {
    const { bd: bdDescr, fOublier } = await this._obtBdDescr({ idProjet });
    await bdDescr.set(langue, description);
    await fOublier();
  }

  async effacerDescriptionProjet({
    idProjet,
    langue,
  }: {
    idProjet: string;
    langue: string;
  }): Promise<void> {
    const { bd: bdDescr, fOublier } = await this._obtBdDescr({ idProjet });
    await bdDescr.del(langue);
    await fOublier();
  }

  async _obtBdMotsClefs({
    idProjet,
  }: {
    idProjet: string;
  }): Promise<{ bd: TypedSet<string>; fOublier: schémaFonctionOublier }> {
    const idBdMotsClefs = await this.client.obtIdBd({
      nom: "motsClefs",
      racine: idProjet,
      type: "set",
    });
    if (!idBdMotsClefs) {
      throw new Error(
        `Permission de modification refusée pour projet ${idProjet}.`,
      );
    }

    return await this.client.ouvrirBdTypée({
      id: idBdMotsClefs,
      type: "set",
      schéma: schémaStructureBdMotsClefsdeProjet,
    });
  }

  async ajouterMotsClefsProjet({
    idProjet,
    idsMotsClefs,
  }: {
    idProjet: string;
    idsMotsClefs: string | string[];
  }): Promise<void> {
    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];
    const { bd: bdMotsClefs, fOublier } = await this._obtBdMotsClefs({
      idProjet,
    });

    await Promise.all(
      idsMotsClefs.map(async (id: string) => {
        const motsClefsExistants = (await bdMotsClefs.all()).map(
          (x) => x.value,
        );

        if (!motsClefsExistants.includes(id)) await bdMotsClefs.add(id);
      }),
    );
    await fOublier();
  }

  async effacerMotClefProjet({
    idProjet,
    idMotClef,
  }: {
    idProjet: string;
    idMotClef: string;
  }): Promise<void> {
    const { bd: bdMotsClefs, fOublier } = await this._obtBdMotsClefs({
      idProjet,
    });
    await bdMotsClefs.del(idMotClef);
    await fOublier();
  }

  async _obtBdBds({
    idProjet,
  }: {
    idProjet: string;
  }): Promise<{ bd: TypedSet<string>; fOublier: schémaFonctionOublier }> {
    const idBdBds = await this.client.obtIdBd({
      nom: "bds",
      racine: idProjet,
      type: "set",
    });
    if (!idBdBds)
      throw new Error(
        `Permission de modification refusée pour Projet ${idProjet}.`,
      );

    return await this.client.ouvrirBdTypée({
      id: idBdBds,
      type: "set",
      schéma: schémaStructureBdMotsClefsdeProjet,
    });
  }

  async ajouterBdProjet({
    idProjet,
    idBd,
  }: {
    idProjet: string;
    idBd: string;
  }): Promise<void> {
    const { bd: bdBds, fOublier } = await this._obtBdBds({ idProjet });
    await bdBds.add(idBd);
    await fOublier();
  }

  async effacerBdProjet({
    idProjet,
    idBd,
  }: {
    idProjet: string;
    idBd: string;
  }): Promise<void> {
    const { bd: bdBds, fOublier } = await this._obtBdBds({ idProjet });

    // Effacer l'entrée dans notre liste de bds (n'efface pas la BD elle-même)
    await bdBds.del(idBd);
    await fOublier();
  }

  async marquerObsolète({
    idProjet,
    idNouvelle,
  }: {
    idProjet: string;
    idNouvelle?: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idProjet,
      type: "keyvalue",
      schéma: schémaStructureBdProjet,
    });
    bd.set("statut", { statut: TYPES_STATUT.OBSOLÈTE, idNouvelle });
    await fOublier();
  }

  async changerStatutProjet({
    idProjet,
    statut,
  }: {
    idProjet: string;
    statut: schémaStatut;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idProjet,
      type: "keyvalue",
      schéma: schémaStructureBdProjet,
    });
    bd.set("statut", statut);
    await fOublier();
  }

  async marquerActif({ idProjet }: { idProjet: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idProjet,
      type: "keyvalue",
      schéma: schémaStructureBdProjet,
    });
    bd.set("statut", { statut: TYPES_STATUT.ACTIVE });
    await fOublier();
  }

  async marquerBêta({ idProjet }: { idProjet: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idProjet,
      type: "keyvalue",
      schéma: schémaStructureBdProjet,
    });
    bd.set("statut", { statut: TYPES_STATUT.BÊTA });
    await fOublier();
  }

  async marquerInterne({ idProjet }: { idProjet: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idProjet,
      type: "keyvalue",
      schéma: schémaStructureBdProjet,
    });
    bd.set("statut", { statut: TYPES_STATUT.INTERNE });
    await fOublier();
  }

  async sauvegarderImage({
    idProjet,
    image,
  }: {
    idProjet: string;
    image: ToFile & { path: string };
  }): Promise<void> {
    let contenu: ToFile & { path: string };

    if ((image.content as File).size !== undefined) {
      if ((image.content as File).size > MAX_TAILLE_IMAGE) {
        throw new Error("Taille maximale excédée");
      }
      contenu = {
        path: image.path,
        content: await (image.content as File).arrayBuffer(),
      };
    } else {
      contenu = image;
    }
    const idImage = await this.client.ajouterÀSFIP({ fichier: contenu });
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idProjet,
      type: "keyvalue",
      schéma: schémaStructureBdProjet,
    });
    await bd.set("image", idImage);
    await fOublier();
  }

  async effacerImage({ idProjet }: { idProjet: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idProjet,
      type: "keyvalue",
      schéma: schémaStructureBdProjet,
    });
    await bd.del("image");
    await fOublier();
  }

  @cacheSuivi
  async suivreImage({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: schémaFonctionSuivi<Uint8Array | null>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idProjet,
      type: "keyvalue",
      schéma: schémaStructureBdProjet,
      f: async (bd) => {
        const idImage = await bd.get("image");
        if (!idImage) {
          return await f(null);
        } else {
          const image = await this.client.obtFichierSFIP({
            id: idImage,
            max: MAX_TAILLE_IMAGE_VIS,
          });
          return await f(image);
        }
      },
    });
  }

  @cacheSuivi
  async suivreNomsProjet({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({
      id: idProjet,
      clef: "noms",
      schéma: schémaStructureBdNoms,
      f,
    });
  }

  @cacheSuivi
  async suivreDescriptionsProjet({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: schémaFonctionSuivi<{ [langue: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({
      id: idProjet,
      clef: "descriptions",
      schéma: schémaStructureBdNoms,
      f,
    });
  }

  @cacheSuivi
  async suivreMotsClefsProjet({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: schémaFonctionSuivi<{ idMotClef: string; source: "projet" | "bds" }[]>;
  }): Promise<schémaFonctionOublier> {
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

    const fFinalePropres = async (mots: string[]) => {
      motsClefs.propres = mots;
      return await fFinale();
    };
    const fOublierMotsClefsPropres = await this.client.suivreBdListeDeClef({
      id: idProjet,
      clef: "motsClefs",
      schéma: { type: "string" },
      f: fFinalePropres,
    });

    const fFinaleBds = async (mots: string[]) => {
      motsClefs.bds = mots;
      return await fFinale();
    };
    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>,
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBdsProjet({ idProjet, f: fSuivreRacine });
    };
    const fBranche = async (
      idBd: string,
      fSuivi: schémaFonctionSuivi<string[]>,
    ): Promise<schémaFonctionOublier> => {
      return await this.client.bds.suivreMotsClefsBd({ idBd, f: fSuivi });
    };
    const fOublierMotsClefsBds = await suivreBdsDeFonctionListe({
      fListe,
      f: fFinaleBds,
      fBranche,
    });

    return async () => {
      await fOublierMotsClefsPropres();
      await fOublierMotsClefsBds();
    };
  }

  @cacheSuivi
  async suivreBdsProjet({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdListeDeClef<string>({
      id: idProjet,
      clef: "bds",
      schéma: { type: "string" },
      f,
    });
  }

  @cacheSuivi
  async suivreVariablesProjet({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (variables?: string[]) => {
      return await f(variables || []);
    };
    const fBranche = async (
      idBd: string,
      f: schémaFonctionSuivi<string[]>,
    ): Promise<schémaFonctionOublier> => {
      return await this.client.bds.suivreVariablesBd({ idBd, f });
    };
    const fSuivreBds = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<string[]>;
    }) => {
      return await this.client.suivreBdsDeBdListe({
        id,
        f: fSuivreBd,
        fBranche,
      });
    };
    return await this.client.suivreBdDeClef({
      id: idProjet,
      clef: "bds",
      f: fFinale,
      fSuivre: fSuivreBds,
    });
  }

  @cacheSuivi
  async suivreQualitéProjet({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: schémaFonctionSuivi<number>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (scoresBds: number[]) => {
      return await f(
        scoresBds.length
          ? scoresBds.reduce((a, b) => a + b, 0) / scoresBds.length
          : 0,
      );
    };
    const fListe = async (
      fSuiviListe: schémaFonctionSuivi<string[]>,
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBdsProjet({ idProjet, f: fSuiviListe });
    };
    const fBranche = async (
      idBd: string,
      fSuiviBranche: schémaFonctionSuivi<number>,
    ): Promise<schémaFonctionOublier> => {
      return await this.client.bds.suivreQualitéBd({
        idBd,
        f: (score) => fSuiviBranche(score.total),
      });
    };
    const fRéduction = (scores: number[]) => {
      return scores.flat();
    };
    return await suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
      fRéduction,
    });
  }

  async suivreDonnéesExportation({
    idProjet,
    langues,
    f,
  }: {
    idProjet: string;
    langues?: string[];
    f: schémaFonctionSuivi<donnéesProjetExportation>;
  }): Promise<schémaFonctionOublier> {
    const info: {
      nomsProjet?: { [langue: string]: string };
      données?: donnéesBdExportation[];
    } = {};
    const fsOublier: schémaFonctionOublier[] = [];

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

    const fOublierDonnées = await suivreBdsDeFonctionListe({
      fListe: async (fSuivreRacine: (éléments: string[]) => Promise<void>) => {
        return await this.suivreBdsProjet({ idProjet, f: fSuivreRacine });
      },
      f: async (données: donnéesBdExportation[]) => {
        info.données = données;
        await fFinale();
      },
      fBranche: async (
        id: string,
        fSuivreBranche: schémaFonctionSuivi<donnéesBdExportation>,
      ): Promise<schémaFonctionOublier> => {
        return await this.client.bds.suivreDonnéesExportation({
          idBd: id,
          langues,
          f: fSuivreBranche,
        });
      },
    });
    fsOublier.push(fOublierDonnées);

    if (langues) {
      const fOublierNomsProjet = await this.suivreNomsProjet({
        idProjet,
        f: async (noms) => {
          info.nomsProjet = noms;
          await fFinale();
        },
      });
      fsOublier.push(fOublierNomsProjet);
    }

    return async () => {
      await Promise.all(fsOublier.map((f) => f()));
    };
  }

  async exporterDonnées({
    idProjet,
    langues,
    nomFichier,
  }: {
    idProjet: string;
    langues?: string[];
    nomFichier?: string;
  }): Promise<donnéesProjetExportées> {
    const données = await uneFois(
      async (
        fSuivi: schémaFonctionSuivi<donnéesProjetExportation>,
      ): Promise<schémaFonctionOublier> => {
        return await this.suivreDonnéesExportation({
          idProjet,
          langues,
          f: fSuivi,
        });
      },
      attendreStabilité(500),
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
        const doc = utils.book_new();
        for (const tableau of donnéesBd.tableaux) {
          /* Créer le tableau */
          const tableauXLSX = utils.json_to_sheet(tableau.données);

          /* Ajouter la feuille au document. XLSX n'accepte pas les noms de colonne > 31 caractères */
          utils.book_append_sheet(
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

  async exporterDocumentDonnées({
    données,
    formatDoc,
    dossier = "",
    inclureFichiersSFIP = true,
  }: {
    données: donnéesProjetExportées;
    formatDoc: BookType | "xls";
    dossier?: string;
    inclureFichiersSFIP?: boolean;
  }): Promise<void> {
    const { docs, fichiersSFIP, nomFichier } = données;

    const conversionsTypes: { [key: string]: BookType } = {
      xls: "biff8",
    };
    const bookType: BookType = conversionsTypes[formatDoc] || formatDoc;

    const fichiersDocs = docs.map((d) => {
      return {
        nom: `${d.nom}.${formatDoc}`,
        octets: writeXLSX(d.doc, { bookType, type: "buffer" }),
      };
    });
    const fichiersDeSFIP = inclureFichiersSFIP
      ? await Promise.all(
          [...fichiersSFIP].map(async (fichier) => {
            return {
              nom: fichier.replace("/", "-"),
              octets: await toBuffer(
                this.client.obtItérableAsyncSFIP({ id: fichier }),
              ),
            };
          }),
        )
      : [];
    await zipper(fichiersDocs, fichiersDeSFIP, path.join(dossier, nomFichier));
  }

  async effacerProjet({ idProjet }: { idProjet: string }): Promise<void> {
    // D'abord effacer l'entrée dans notre liste de projets
    await this.enleverDeMesProjets({ idProjet });

    // Et puis maintenant aussi effacer les données et le projet lui-même
    for (const clef in ["noms", "descriptions", "motsClefs", "bds"]) {
      const idBd = await this.client.obtIdBd({
        nom: clef,
        racine: idProjet,
      });
      if (idBd) await this.client.effacerBd({ id: idBd });
    }

    await this.client.effacerBd({ id: idProjet });
  }
}
