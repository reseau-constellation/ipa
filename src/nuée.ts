import ClientConstellation from "@/client.js";

import type { ImportCandidate } from "ipfs-core-types/src/utils";

import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  schémaStatut,
  TYPES_STATUT,
  schémaRetourFonctionRechercheParProfondeur,
  infoAuteur,
  schémaFonctionSuiviRecherche,
  infoRésultatVide,
  résultatRecherche,
  schémaStructureBdNoms,
  schémaStructureBdMétadonnées,
} from "@/types.js";
import {
  faisRien,
  uneFois,
  ignorerNonDéfinis,
  traduire,
} from "@constl/utils-ipa";

import générerContrôleurConstellation from "@/accès/cntrlConstellation.js";
import { suivreBdDeFonction } from "@constl/utils-ipa";

import { cacheRechercheParNRésultats, cacheSuivi } from "@/décorateursCache.js";
import type { objRôles } from "@/accès/types.js";
import {
  type différenceBds,
  type différenceBDTableauManquant,
  type différenceBDTableauSupplémentaire,
  type différenceTableauxBds,
  type donnéesBdExportées,
  type infoTableau,
  type infoTableauAvecId,
  type schémaSpécificationBd,
  schémaBdTableauxDeBd,
} from "@/bds.js";
import { v4 as uuidv4 } from "uuid";
import type { erreurValidation, règleVariable, règleColonne } from "@/valid.js";
import type { élémentDonnées } from "@/tableaux.js";
import type { élémentDeMembreAvecValid } from "@/reseau.js";
import type { schémaRetourFonctionRechercheParN, élémentsBd } from "@/types.js";

import {
  type différenceTableaux,
  type InfoCol,
  type InfoColAvecCatégorie,
  type élémentBdListeDonnées,
} from "@/tableaux.js";
import { ComposanteClientListe } from "./composanteClient.js";
import Base64 from "crypto-js/enc-base64.js";
import md5 from "crypto-js/md5.js";
import { utils } from "xlsx";
import { JSONSchemaType } from "ajv";
import { isValidAddress } from "@orbitdb/core";
import { KeyValueStoreTypé } from "./orbite.js";

type ContrôleurConstellation = Awaited<
  ReturnType<ReturnType<typeof générerContrôleurConstellation>>
>;

export const MAX_TAILLE_IMAGE = 500 * 1000; // 500 kilooctets
export const MAX_TAILLE_IMAGE_VIS = 1500 * 1000; // 1,5 megaoctets

export type correspondanceBdEtNuée = {
  nuée: string;
  différences: différenceBds[];
};

export type statutMembreNuée = {
  idCompte: string;
  statut: "exclus" | "accepté";
};

const schémaBdAutorisations: JSONSchemaType<{
  [idCompte: string]: statutMembreNuée["statut"];
}> = {
  type: "object",
  additionalProperties: {
    type: "string",
  },
  required: [],
};

export type structureBdNuée = {
  type: "nuée";
  noms: string;
  métadonnées: string;
  descriptions: string;
  motsClefs: string;
  tableaux: string;
  autorisation: string;
  statut: Partial<schémaStatut>;
  parent?: string;
  image?: string;
  copiéDe?: string;
};
const schémaStructureBdNuée: JSONSchemaType<Partial<structureBdNuée>> = {
  type: "object",
  properties: {
    type: { type: "string", nullable: true },
    métadonnées: { type: "string", nullable: true },
    noms: { type: "string", nullable: true },
    descriptions: { type: "string", nullable: true },
    motsClefs: { type: "string", nullable: true },
    image: { type: "string", nullable: true },
    tableaux: { type: "string", nullable: true },
    autorisation: { type: "string", nullable: true },
    statut: {
      type: "object",
      properties: {
        idNouvelle: { type: "string", nullable: true },
        statut: { type: "string", nullable: true },
      },
      required: [],
      nullable: true,
    },
    parent: { type: "string", nullable: true },
    copiéDe: { type: "string", nullable: true },
  },
  required: [],
};

type structureBdAuthorisation = {
  philosophie: "CJPI" | "IJPC";
  membres: string;
};

const schémaStructureBdAuthorisation: JSONSchemaType<
  Partial<structureBdAuthorisation>
> = {
  type: "object",
  properties: {
    philosophie: { type: "string", nullable: true },
    membres: { type: "string", nullable: true },
  },
  required: [],
};

const schémaBdMotsClefsNuée: JSONSchemaType<string> = {
  type: "string",
};

export default class Nuée extends ComposanteClientListe<string> {
  constructor({ client }: { client: ClientConstellation }) {
    super({ client, clef: "nuées", schémaBdPrincipale: { type: "string" } });
  }

  async épingler() {
    await this.client.épingles?.épinglerBd({
      id: await this.obtIdBd(),
      récursif: false,
      fichiers: false,
    });
  }

  async créerNuée({
    nuéeParent,
    autorisation = "IJPC",
    ajouter = true,
  }: {
    nuéeParent?: string;
    autorisation?: string | "IJPC" | "CJPI";
    ajouter?: boolean;
  }): Promise<string> {
    const idBdNuée = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès: {
        address: undefined,
        write: this.client.bdCompte!.address,
      },
    });
    if (ajouter) await this.ajouterÀMesNuées({ idNuée: idBdNuée });

    const { bd: bdNuée, fOublier: fOublierNuée } =
      await this.client.orbite!.ouvrirBdTypée({
        id: idBdNuée,
        type: "keyvalue",
        schéma: schémaStructureBdNuée,
      });

    const accès = bdNuée.access as ContrôleurConstellation;
    const optionsAccès = { address: accès.address };

    await bdNuée.set("type", "nuée");

    let autorisationFinale: string;
    if (isValidAddress(autorisation)) {
      autorisationFinale = autorisation;
    } else if (autorisation === "CJPI" || autorisation === "IJPC") {
      autorisationFinale = await this.générerGestionnaireAutorisations({
        philosophie: autorisation,
      });
    } else {
      throw new Error(`Autorisation non valide : ${autorisation}`);
    }
    await bdNuée.set("autorisation", autorisationFinale);
    if (autorisation === "CJPI") {
      await this.accepterMembreNuée({
        idNuée: idBdNuée,
        idCompte: await this.client.obtIdCompte(),
      });
    }

    const idBdNoms = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès,
    });
    await bdNuée.set("noms", idBdNoms);

    const idBdDescr = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès,
    });
    await bdNuée.set("descriptions", idBdDescr);

    const idBdTableaux = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès,
    });
    await bdNuée.set("tableaux", idBdTableaux);

    const idBdMétadonnées = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès,
    });
    await bdNuée.set("métadonnées", idBdMétadonnées);

    const idBdMotsClefs = await this.client.créerBdIndépendante({
      type: "feed",
      optionsAccès,
    });
    await bdNuée.set("motsClefs", idBdMotsClefs);

    await bdNuée.set("statut", { statut: TYPES_STATUT.ACTIVE });
    if (nuéeParent) {
      await bdNuée.set("parent", nuéeParent);
    }

    fOublierNuée();
    return idBdNuée;
  }

  async ajouterÀMesNuées({ idNuée }: { idNuée: string }): Promise<void> {
    const { bd, fOublier } = await this.obtBd();
    await bd.add(idNuée);
    await fOublier();
  }

  async enleverDeMesNuées({ idNuée }: { idNuée: string }): Promise<void> {
    const { bd: bdRacine, fOublier } = await this.obtBd();
    await this.client.effacerÉlémentDeBdListe({
      bd: bdRacine,
      élément: idNuée,
    });
    await fOublier();
  }

  async copierNuée({
    idNuée,
    ajouterÀMesNuées = true,
  }: {
    idNuée: string;
    ajouterÀMesNuées?: boolean;
  }): Promise<string> {
    const { bd: bdBase, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idNuée,
      type: "keyvalue",
      schéma: schémaStructureBdNuée,
    });
    const nuéeParent = await bdBase.get("parent");
    const idNouvelleNuée = await this.créerNuée({
      nuéeParent,
      ajouter: ajouterÀMesNuées,
    });
    const { bd: nouvelleBd, fOublier: fOublierNouvelle } =
      await this.client.orbite!.ouvrirBdTypée({
        id: idNouvelleNuée,
        type: "keyvalue",
        schéma: schémaStructureBdNuée,
      });

    const idBdMétadonnées = await bdBase.get("métadonnées");
    if (idBdMétadonnées) {
      const { bd: bdMétadonnées, fOublier: fOublierBdMétadonnées } =
        await this.client.orbite!.ouvrirBdTypée({
          id: idBdMétadonnées,
          type: "keyvalue",
          schéma: schémaStructureBdNoms,
        });
      const métadonnées = await bdMétadonnées.all();
      await fOublierBdMétadonnées();
      await this.sauvegarderMétadonnéesNuée({
        idNuée: idNouvelleNuée,
        métadonnées,
      });
    }

    const idBdNoms = await bdBase.get("noms");
    if (idBdNoms) {
      const { bd: bdNoms, fOublier: fOublierBdNoms } =
        await this.client.orbite!.ouvrirBdTypée({
          id: idBdNoms,
          type: "keyvalue",
          schéma: schémaStructureBdNoms,
        });
      const noms = await bdNoms.all();
      await fOublierBdNoms();
      await this.sauvegarderNomsNuée({ idNuée: idNouvelleNuée, noms });
    }

    const idBdDescr = await bdBase.get("descriptions");
    if (idBdDescr) {
      const { bd: bdDescr, fOublier: fOublierBdDescr } =
        await this.client.orbite!.ouvrirBdTypée({
          id: idBdDescr,
          type: "keyvalue",
          schéma: schémaStructureBdNoms,
        });
      const descriptions = await bdDescr.all();
      await fOublierBdDescr();
      await this.sauvegarderDescriptionsNuée({
        idNuée: idNouvelleNuée,
        descriptions,
      });
    }

    const idBdMotsClefs = await bdBase.get("motsClefs");
    if (idBdMotsClefs) {
      const { bd: bdMotsClefs, fOublier: fOublierBdMotsClefs } =
        await this.client.orbite!.ouvrirBdTypée({
          id: idBdMotsClefs,
          type: "feed",
          schéma: schémaBdMotsClefsNuée,
        });
      const motsClefs = (await bdMotsClefs.all()).map((x) => x.value);
      await fOublierBdMotsClefs();
      await this.ajouterMotsClefsNuée({
        idNuée: idNouvelleNuée,
        idsMotsClefs: motsClefs,
      });
    }

    const idBdTableaux = await bdBase.get("tableaux");
    const idNouvelleBdTableaux = await nouvelleBd.get("tableaux");
    if (!idNouvelleBdTableaux) throw new Error("Erreur initialisation.");

    if (idBdTableaux) {
      const { bd: nouvelleBdTableaux, fOublier: fOublierNouvelleTableaux } =
        await this.client.orbite!.ouvrirBdTypée({
          id: idNouvelleBdTableaux,
          type: "keyvalue",
          schéma: schémaBdTableauxDeBd,
        });
      const { bd: bdTableaux, fOublier: fOublierBdTableaux } =
        await this.client.orbite!.ouvrirBdTypée({
          id: idBdTableaux,
          type: "keyvalue",
          schéma: schémaBdTableauxDeBd,
        });
      const tableaux = await bdTableaux.all();
      await fOublierBdTableaux();
      for (const idTableau of Object.keys(tableaux)) {
        const idNouveauTableau = await this.client.tableaux!.copierTableau({
          id: idTableau,
          idBd: idNouvelleNuée,
          copierDonnées: false,
        });
        await nouvelleBdTableaux.set(idNouveauTableau, tableaux[idTableau]);
      }
      await fOublierNouvelleTableaux();
    }

    const statut = (await bdBase.get("statut")) || {
      statut: TYPES_STATUT.ACTIVE,
    };
    await nouvelleBd.set("statut", statut);

    const image = await bdBase.get("image");
    if (image) await nouvelleBd.set("image", image);

    await nouvelleBd.set("copiéDe", idNuée);

    await Promise.all([fOublier(), fOublierNouvelle()]);
    return idNouvelleNuée;
  }

  async suivreNuées({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({
      f,
      idCompte,
    });
  }

  async suivreDeParents<T>({
    idNuée,
    f,
    fParents,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<T[]>;
    fParents: (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<T>,
    ) => Promise<schémaFonctionOublier>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdsDeFonctionListe({
      fListe: async (
        fSuivreRacine: (parents: string[]) => Promise<void>,
      ): Promise<schémaFonctionOublier> => {
        return await this.suivreNuéesParents({
          idNuée,
          f: (parents) => fSuivreRacine([idNuée, ...parents].reverse()),
        });
      },
      f,
      fBranche: fParents,
      fRéduction: (x) => x,
    });
  }

  async sauvegarderMétadonnéeNuée({
    idNuée,
    clef,
    valeur,
  }: {
    idNuée: string;
    clef: string;
    valeur: élémentsBd;
  }): Promise<void> {
    const idBdMétadonnées = await this.client.obtIdBd({
      nom: "métadonnées",
      racine: idNuée,
      type: "keyvalue",
    });
    if (!idBdMétadonnées)
      throw new Error(
        `Permission de modification refusée pour Nuée ${idNuée}.`,
      );

    const { bd: bdMétadonnées, fOublier } =
      await this.client.orbite!.ouvrirBdTypée({
        id: idBdMétadonnées,
        type: "keyvalue",
        schéma: schémaStructureBdMétadonnées,
      });
    await bdMétadonnées.set(clef, valeur);
    await fOublier();
  }

  async sauvegarderMétadonnéesNuée({
    idNuée,
    métadonnées,
  }: {
    idNuée: string;
    métadonnées: { [key: string]: string };
  }): Promise<void> {
    const idBdMétadonnées = await this.client.obtIdBd({
      nom: "métadonnées",
      racine: idNuée,
      type: "keyvalue",
    });
    if (!idBdMétadonnées)
      throw new Error(
        `Permission de modification refusée pour Nuée ${idNuée}.`,
      );

    const { bd: bdMétadonnées, fOublier } =
      await this.client.orbite!.ouvrirBdTypée({
        id: idBdMétadonnées,
        type: "keyvalue",
        schéma: schémaStructureBdMétadonnées,
      });

    for (const clef in métadonnées) {
      await bdMétadonnées.set(clef, métadonnées[clef]);
    }
    await fOublier();
  }

  async effacerMétadonnéeNuée({
    idNuée,
    clef,
  }: {
    idNuée: string;
    clef: string;
  }): Promise<void> {
    const idBdMétadonnées = await this.client.obtIdBd({
      nom: "métadonnées",
      racine: idNuée,
      type: "keyvalue",
    });
    if (!idBdMétadonnées)
      throw new Error(
        `Permission de modification refusée pour Nuée ${idNuée}.`,
      );

    const { bd: bdMétadonnées, fOublier } =
      await this.client.orbite!.ouvrirBdTypée({
        id: idBdMétadonnées,
        type: "keyvalue",
        schéma: schémaStructureBdMétadonnées,
      });
    await bdMétadonnées.del(clef);
    await fOublier();
  }

  async suivreMétadonnéesNuée({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<{ [clef: string]: élémentsBd }>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (noms: { [key: string]: string }[]) => {
      await f(Object.assign({}, ...noms));
    };

    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents: async (
        id: string,
        fSuivreBranche: schémaFonctionSuivi<{ [key: string]: string }>,
      ): Promise<schémaFonctionOublier> => {
        return await this.client.suivreBdDicDeClef({
          id,
          clef: "métadonnées",
          schéma: schémaStructureBdMétadonnées,
          f: fSuivreBranche,
        });
      },
    });
  }

  async sauvegarderNomNuée({
    idNuée,
    langue,
    nom,
  }: {
    idNuée: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idNuée,
      type: "keyvalue",
    });
    if (!idBdNoms)
      throw new Error(
        `Permission de modification refusée pour Nuée ${idNuée}.`,
      );

    const { bd: bdNoms, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idBdNoms,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    await bdNoms.set(langue, nom);
    await fOublier();
  }

  async sauvegarderNomsNuée({
    idNuée,
    noms,
  }: {
    idNuée: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idNuée,
      type: "keyvalue",
    });
    if (!idBdNoms)
      throw new Error(
        `Permission de modification refusée pour Nuée ${idNuée}.`,
      );

    const { bd: bdNoms, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idBdNoms,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });

    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
    await fOublier();
  }

  async effacerNomNuée({
    idNuée,
    langue,
  }: {
    idNuée: string;
    langue: string;
  }): Promise<void> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idNuée,
      type: "keyvalue",
    });
    if (!idBdNoms)
      throw new Error(
        `Permission de modification refusée pour Nuée ${idNuée}.`,
      );

    const { bd: bdNoms, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idBdNoms,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    await bdNoms.del(langue);
    await fOublier();
  }

  async suivreNomsNuée({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (noms: { [key: string]: string }[]) => {
      await f(Object.assign({}, ...noms));
    };

    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents: async (
        id: string,
        fSuivreBranche: schémaFonctionSuivi<{ [key: string]: string }>,
      ): Promise<schémaFonctionOublier> => {
        return await this.client.suivreBdDicDeClef({
          id,
          clef: "noms",
          schéma: schémaStructureBdNoms,
          f: fSuivreBranche,
        });
      },
    });
  }

  async sauvegarderDescriptionNuée({
    idNuée,
    langue,
    description,
  }: {
    idNuée: string;
    langue: string;
    description: string;
  }): Promise<void> {
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: idNuée,
      type: "keyvalue",
    });
    if (!idBdDescr)
      throw new Error(
        `Permission de modification refusée pour Nuée ${idNuée}.`,
      );

    const { bd: bdDescr, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idBdDescr,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    await bdDescr.set(langue, description);
    await fOublier();
  }

  async sauvegarderDescriptionsNuée({
    idNuée,
    descriptions,
  }: {
    idNuée: string;
    descriptions: { [langue: string]: string };
  }): Promise<void> {
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: idNuée,
      type: "keyvalue",
    });
    if (!idBdDescr)
      throw new Error(`Permission de modification refusée pour BD ${idNuée}.`);

    const { bd: bdDescr, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idBdDescr,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    for (const lng in descriptions) {
      await bdDescr.set(lng, descriptions[lng]);
    }
    await fOublier();
  }

  async effacerDescriptionNuée({
    idNuée,
    langue,
  }: {
    idNuée: string;
    langue: string;
  }): Promise<void> {
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: idNuée,
      type: "keyvalue",
    });
    if (!idBdDescr)
      throw new Error(`Permission de modification refusée pour BD ${idNuée}.`);

    const { bd: bdDescr, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idBdDescr,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    await bdDescr.del(langue);
    await fOublier();
  }

  @cacheSuivi
  async suivreDescriptionsNuée({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (noms: { [key: string]: string }[]) => {
      await f(Object.assign({}, ...noms));
    };

    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents: async (
        id: string,
        fSuivreBranche: schémaFonctionSuivi<{ [key: string]: string }>,
      ): Promise<schémaFonctionOublier> => {
        return await this.client.suivreBdDicDeClef({
          id,
          clef: "descriptions",
          schéma: schémaStructureBdNoms,
          f: fSuivreBranche,
        });
      },
    });
  }

  async sauvegarderImage({
    idNuée,
    image,
  }: {
    idNuée: string;
    image: ImportCandidate;
  }): Promise<void> {
    let contenu: ImportCandidate;

    if ((image as File).size !== undefined) {
      if ((image as File).size > MAX_TAILLE_IMAGE) {
        throw new Error("Taille maximale excédée");
      }
      contenu = await (image as File).arrayBuffer();
    } else {
      contenu = image;
    }
    const idImage = await this.client.ajouterÀSFIP({ fichier: contenu });
    const { bd, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idNuée,
      type: "keyvalue",
      schéma: schémaStructureBdNuée,
    });
    await bd.set("image", idImage);
    await fOublier();
  }

  async effacerImage({ idNuée }: { idNuée: string }): Promise<void> {
    const { bd, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idNuée,
      type: "keyvalue",
      schéma: schémaStructureBdMétadonnées,
    });
    await bd.del("image");
    await fOublier();
  }

  @cacheSuivi
  async suivreImage({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<Uint8Array | null>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idNuée,
      type: "keyvalue",
      schéma: schémaStructureBdNuée,
      f: async (bd) => {
        const idImage = await bd.get("image");
        if (!idImage) {
          await f(null);
        } else {
          const image = await this.client.obtFichierSFIP({
            id: idImage,
            max: MAX_TAILLE_IMAGE_VIS,
          });
          await f(image);
        }
      },
    });
  }

  async ajouterMotsClefsNuée({
    idNuée,
    idsMotsClefs,
  }: {
    idNuée: string;
    idsMotsClefs: string | string[];
  }): Promise<void> {
    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];
    const idBdMotsClefs = await this.client.obtIdBd({
      nom: "motsClefs",
      racine: idNuée,
      type: "feed",
    });
    if (!idBdMotsClefs) {
      throw new Error(`Permission de modification refusée pour BD ${idNuée}.`);
    }

    const { bd: bdMotsClefs, fOublier } =
      await this.client.orbite!.ouvrirBdTypée({
        id: idBdMotsClefs,
        type: "feed",
        schéma: schémaBdMotsClefsNuée,
      });
    for (const id of idsMotsClefs) {
      const motsClefsExistants = (await bdMotsClefs.all()).map((x) => x.value);
      if (!motsClefsExistants.includes(id)) await bdMotsClefs.add(id);
    }
    await fOublier();
  }

  async effacerMotClefNuée({
    idNuée,
    idMotClef,
  }: {
    idNuée: string;
    idMotClef: string;
  }): Promise<void> {
    const idBdMotsClefs = await this.client.obtIdBd({
      nom: "motsClefs",
      racine: idNuée,
      type: "feed",
    });
    if (!idBdMotsClefs) {
      throw new Error(`Permission de modification refusée pour BD ${idNuée}.`);
    }

    const { bd: bdMotsClefs, fOublier } =
      await this.client.orbite!.ouvrirBdTypée({
        id: idBdMotsClefs,
        type: "feed",
        schéma: schémaBdMotsClefsNuée,
      });

    await this.client.effacerÉlémentDeBdListe({
      bd: bdMotsClefs,
      élément: idMotClef,
    });

    await fOublier();
  }

  @cacheSuivi
  async suivreMotsClefsNuée({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (motsClefs: string[][]) => {
      await f([...new Set(motsClefs.flat())]);
    };

    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents: async (
        id: string,
        fSuivreBranche: schémaFonctionSuivi<string[]>,
      ): Promise<schémaFonctionOublier> => {
        return await this.client.suivreBdListeDeClef({
          id,
          clef: "motsClefs",
          schéma: { type: "string" },
          f: fSuivreBranche,
        });
      },
    });
  }

  async changerStatutNuée({
    idNuée,
    statut,
  }: {
    idNuée: string;
    statut: schémaStatut;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idNuée,
      type: "keyvalue",
      schéma: schémaStructureBdNuée,
    });
    bd.set("statut", statut);
    await fOublier();
  }

  async suivreStatutNuée({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<schémaStatut>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDic({
      id: idNuée,
      f: async (x) => {
        if (x["statut"]) return await f(x["statut"] as schémaStatut);
      },
      schéma: schémaStructureBdNuée
    });
  }

  async marquerObsolète({
    idNuée,
    idNouvelle,
  }: {
    idNuée: string;
    idNouvelle?: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idNuée,
      type: "keyvalue",
      schéma: schémaStructureBdNuée,
    });
    bd.set("statut", { statut: TYPES_STATUT.OBSOLÈTE, idNouvelle });
    await fOublier();
  }

  async marquerActive({ idNuée }: { idNuée: string }): Promise<void> {
    const { bd, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idNuée,
      type: "keyvalue",
      schéma: schémaStructureBdNuée,
    });
    bd.set("statut", { statut: TYPES_STATUT.ACTIVE });
    await fOublier();
  }

  async marquerBêta({ idNuée }: { idNuée: string }): Promise<void> {
    const { bd, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idNuée,
      type: "keyvalue",
      schéma: schémaStructureBdNuée,
    });
    bd.set("statut", { statut: TYPES_STATUT.BÊTA });
    await fOublier();
  }

  async marquerInterne({ idNuée }: { idNuée: string }): Promise<void> {
    const { bd, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idNuée,
      type: "keyvalue",
      schéma: schémaStructureBdNuée,
    });
    bd.set("statut", { statut: TYPES_STATUT.INTERNE });
    await fOublier();
  }

  async inviterAuteur({
    idNuée,
    idCompteAuteur,
    rôle,
  }: {
    idNuée: string;
    idCompteAuteur: string;
    rôle: keyof objRôles;
  }): Promise<void> {
    await this.client.donnerAccès({
      idBd: idNuée,
      identité: idCompteAuteur,
      rôle,
    });
  }

  async générerGestionnaireAutorisations({
    philosophie = "IJPC",
  }: {
    philosophie?: "IJPC" | "CJPI";
  }): Promise<string> {
    const idBdAutorisation = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès: {
        address: undefined,
        write: this.client.bdCompte!.address,
      },
    });

    const { bd, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idBdAutorisation,
      type: "keyvalue",
      schéma: schémaStructureBdAuthorisation,
    });

    await bd.set("philosophie", philosophie);

    const accès = bd.access as ContrôleurConstellation;
    const optionsAccès = { address: accès.address };
    const idBdMembres = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès,
    });
    await bd.set("membres", idBdMembres);

    fOublier();
    return idBdAutorisation;
  }

  async changerPhisolophieAutorisation({
    idAutorisation,
    philosophie,
  }: {
    idAutorisation: string;
    philosophie: "IJPC" | "CJPI";
  }): Promise<void> {
    const { bd, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idAutorisation,
      type: "keyvalue",
      schéma: schémaStructureBdAuthorisation,
    });
    await bd.set("philosophie", philosophie);
    fOublier();
  }

  async suivrePhilosophieAutorisation({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<"IJPC" | "CJPI">;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (
      bd?: KeyValueStoreTypé<structureBdAuthorisation>,
    ) => {
      if (!bd) return;
      const philosophie = await bd.get("philosophie");
      if (philosophie && ["IJPC", "CJPI"].includes(philosophie)) {
        await f(philosophie as "IJPC" | "CJPI");
      }
    };

    const fRacine = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (nouvelIdBdCible?: string | undefined) => Promise<void>;
    }) => {
      return await this.suivreGestionnaireAutorisations({
        idNuée,
        f: fSuivreRacine,
      });
    };

    const fSuivre = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<
        KeyValueStoreTypé<structureBdAuthorisation> | undefined
      >;
    }) => {
      return await this.client.suivreBd({
        id,
        type: "keyvalue",
        schéma: schémaStructureBdAuthorisation,
        f: fSuivreBd,
      });
    };
    return await suivreBdDeFonction({
      fRacine,
      f: fFinale,
      fSuivre,
    });
  }

  async accepterMembreAutorisation({
    idAutorisation,
    idCompte,
  }: {
    idAutorisation: string;
    idCompte: string;
  }): Promise<void> {
    const idBdMembres = await this.client.obtIdBd({
      nom: "membres",
      racine: idAutorisation,
      type: "keyvalue",
    });
    if (!idBdMembres) {
      throw new Error(
        `Permission de modification refusée pour groupe d'autorisation ${idAutorisation}.`,
      );
    }

    const { bd, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idBdMembres,
      type: "keyvalue",
      schéma: schémaBdAutorisations,
    });
    await bd.set(idCompte, "accepté");
    fOublier();
  }

  async accepterMembreNuée({
    idNuée,
    idCompte,
  }: {
    idNuée: string;
    idCompte: string;
  }): Promise<void> {
    const idAutorisation = await this.obtGestionnaireAutorisationsDeNuée({
      idNuée,
    });
    return await this.accepterMembreAutorisation({
      idAutorisation,
      idCompte,
    });
  }

  async exclureMembreAutorisation({
    idAutorisation,
    idCompte,
  }: {
    idAutorisation: string;
    idCompte: string;
  }): Promise<void> {
    const idBdMembres = await this.client.obtIdBd({
      nom: "membres",
      racine: idAutorisation,
      type: "keyvalue",
    });
    if (!idBdMembres) {
      throw new Error(
        `Permission de modification refusée pour groupe d'autorisation ${idAutorisation}.`,
      );
    }

    const { bd, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idBdMembres,
      type: "keyvalue",
      schéma: schémaBdAutorisations,
    });
    await bd.set(idCompte, "exclus");
    fOublier();
  }

  async exclureMembreDeNuée({
    idNuée,
    idCompte,
  }: {
    idNuée: string;
    idCompte: string;
  }): Promise<void> {
    const idAutorisation = await this.obtGestionnaireAutorisationsDeNuée({
      idNuée,
    });
    return await this.exclureMembreAutorisation({
      idAutorisation,
      idCompte,
    });
  }

  async suivreGestionnaireAutorisations({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idNuée,
      type: "keyvalue",
      schéma: schémaStructureBdNuée,
      f: async (bd) => {
        const idAutorisation = await bd.get("autorisation");
        await f(idAutorisation);
      },
    });
  }

  async changerGestionnaireAutorisations({
    idNuée,
    idAutorisation,
  }: {
    idNuée: string;
    idAutorisation: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.orbite!.ouvrirBdTypée({
      id: idNuée,
      type: "keyvalue",
      schéma: schémaStructureBdNuée,
    });

    await bd.set("autorisation", idAutorisation);

    fOublier();
  }

  async obtGestionnaireAutorisationsDeNuée({
    idNuée,
  }: {
    idNuée: string;
  }): Promise<string> {
    return await uneFois(async (fSuivi: schémaFonctionSuivi<string>) => {
      return await this.suivreGestionnaireAutorisations({
        idNuée,
        f: ignorerNonDéfinis(fSuivi),
      });
    });
  }

  async suivreAutorisationsMembresDeGestionnaire({
    idAutorisation,
    f,
  }: {
    idAutorisation: string;
    f: schémaFonctionSuivi<statutMembreNuée[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (dicMembres: {
      [clef: string]: "exclus" | "accepté";
    }) => {
      const membres = Object.entries(dicMembres).map(([idCompte, statut]) => {
        return {
          idCompte,
          statut,
        };
      });
      await f(membres);
    };
    return await this.client.suivreBdDicDeClef({
      id: idAutorisation,
      clef: "membres",
      schéma: schémaBdAutorisations,
      f: fFinale,
    });
  }

  async suivreAutorisationsMembresDeNuée({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<statutMembreNuée[]>;
  }): Promise<schémaFonctionOublier> {
    const fRacine = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (nouvelIdBdCible?: string) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreGestionnaireAutorisations({
        idNuée,
        f: fSuivreRacine,
      });
    };
    const fSuivre = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<statutMembreNuée[]>;
    }) => {
      return await this.suivreAutorisationsMembresDeGestionnaire({
        idAutorisation: id,
        f: fSuivreBd,
      });
    };
    return await suivreBdDeFonction({
      fRacine,
      f: ignorerNonDéfinis(f),
      fSuivre,
    });
  }

  async ajouterTableauNuée({
    idNuée,
    clefTableau,
  }: {
    idNuée: string;
    clefTableau?: string;
  }): Promise<string> {
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: idNuée,
      type: "keyvalue",
    });
    if (!idBdTableaux) {
      throw new Error(
        `Permission de modification refusée pour Nuée ${idNuée}.`,
      );
    }

    const { bd: bdTableaux, fOublier } =
      await this.client.orbite!.ouvrirBdTypée<{
        [tbl: string]: infoTableau;
      }>({ id: idBdTableaux, type: "keyvalue", schéma: schémaBdTableauxDeBd });

    clefTableau = clefTableau || uuidv4();
    const idTableau = await this.client.tableaux!.créerTableau({
      idBd: idNuée,
    });
    await bdTableaux.set(idTableau, {
      position: Object.keys(bdTableaux.all).length,
      clef: clefTableau,
    });

    await fOublier();
    return idTableau;
  }

  async effacerTableauNuée({
    idNuée,
    idTableau,
  }: {
    idNuée: string;
    idTableau: string;
  }): Promise<void> {
    // D'abord effacer l'entrée dans notre liste de tableaux
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: idNuée,
      type: "keyvalue",
    });
    if (!idBdTableaux) {
      throw new Error(
        `Permission de modification refusée pour Nuée ${idNuée}.`,
      );
    }

    const { bd: bdTableaux, fOublier } =
      await this.client.orbite!.ouvrirBdTypée({
        id: idBdTableaux,
        type: "keyvalue",
        schéma: schémaBdTableauxDeBd,
      });
    await bdTableaux.del(idTableau);
    await fOublier();

    // Enfin, effacer les données et le tableau lui-même
    await this.client.tableaux!.effacerTableau({ idTableau });
  }

  async suivreTableauxNuée({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<infoTableauAvecId[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (tableaux: infoTableauAvecId[][]) => {
      await f(tableaux.flat());
    };

    const fParents = async (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<infoTableauAvecId[]>,
    ) => {
      const fFinaleTableaux = (infos: { [clef: string]: infoTableau }) => {
        const tableaux: infoTableauAvecId[] = Object.entries(infos).map(
          ([idTableau, info]) => {
            return {
              id: idTableau,
              ...info,
            };
          },
        );
        fSuivreBranche(tableaux);
      };
      return await this.client.suivreBdDicDeClef({
        id,
        clef: "tableaux",
        schéma: schémaBdTableauxDeBd,
        f: fFinaleTableaux,
      });
    };
    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents,
    });
  }

  async ajouterNomsTableauNuée({
    idTableau,
    noms,
  }: {
    idTableau: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    return await this.client.tableaux!.sauvegarderNomsTableau({
      idTableau,
      noms,
    });
  }

  async effacerNomsTableauNuée({
    idTableau,
    langue,
  }: {
    idTableau: string;
    langue: string;
  }): Promise<void> {
    return await this.client.tableaux!.effacerNomTableau({ idTableau, langue });
  }

  @cacheSuivi
  async suivreNomsTableauNuée({
    idNuée,
    clefTableau,
    f,
  }: {
    idNuée: string;
    clefTableau: string;
    f: schémaFonctionSuivi<{ [langue: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (lNoms: { [key: string]: string }[]) => {
      await f(Object.assign({}, ...lNoms));
    };

    const fParents = async (
      idNuéeParent: string,
      fSuivreBranche: schémaFonctionSuivi<{
        [key: string]: string;
      }>,
    ): Promise<schémaFonctionOublier> => {
      return await suivreBdDeFonction({
        fRacine: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (nouvelIdBdCible?: string) => Promise<void>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.bds!.suivreIdTableauParClef({
            idBd: idNuéeParent,
            clef: clefTableau,
            f: fSuivreRacine,
          });
        },
        f: ignorerNonDéfinis(fSuivreBranche),
        fSuivre: async ({
          id: idTableau,
          fSuivreBd,
        }: {
          id: string;
          fSuivreBd: schémaFonctionSuivi<{ [key: string]: string }>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.tableaux!.suivreNomsTableau({
            idTableau,
            f: fSuivreBd,
          });
        },
      });
    };
    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents,
    });
  }

  async ajouterColonneTableauNuée({
    idTableau,
    idVariable,
    idColonne,
    index,
  }: {
    idTableau: string;
    idVariable: string;
    idColonne?: string;
    index?: boolean;
  }): Promise<string> {
    const idColonneFinale = await this.client.tableaux!.ajouterColonneTableau({
      idTableau,
      idVariable,
      idColonne,
    });
    if (index) {
      await this.changerColIndexTableauNuée({
        idTableau,
        idColonne: idColonneFinale,
        val: true,
      });
    }
    return idColonneFinale;
  }

  async effacerColonneTableauNuée({
    idTableau,
    idColonne,
  }: {
    idTableau: string;
    idColonne: string;
  }): Promise<void> {
    return await this.client.tableaux!.effacerColonneTableau({
      idTableau,
      idColonne,
    });
  }

  async changerColIndexTableauNuée({
    idTableau,
    idColonne,
    val,
  }: {
    idTableau: string;
    idColonne: string;
    val: boolean;
  }): Promise<void> {
    return await this.client.tableaux!.changerColIndex({
      idTableau,
      idColonne,
      val,
    });
  }

  suivreColonnesTableauNuée<T = InfoColAvecCatégorie>({
    idNuée,
    clefTableau,
    f,
    catégories,
  }: {
    idNuée: string;
    clefTableau: string;
    f: schémaFonctionSuivi<T[]>;
    catégories?: true;
  }): Promise<schémaFonctionOublier>;

  suivreColonnesTableauNuée<T = InfoCol>({
    idNuée,
    clefTableau,
    f,
    catégories,
  }: {
    idNuée: string;
    clefTableau: string;
    f: schémaFonctionSuivi<T[]>;
    catégories: false;
  }): Promise<schémaFonctionOublier>;

  suivreColonnesTableauNuée<T = InfoCol | InfoColAvecCatégorie>({
    idNuée,
    clefTableau,
    f,
    catégories,
  }: {
    idNuée: string;
    clefTableau: string;
    f: schémaFonctionSuivi<T[]>;
    catégories?: boolean;
  }): Promise<schémaFonctionOublier>;

  @cacheSuivi
  async suivreColonnesTableauNuée<T = InfoColAvecCatégorie>({
    idNuée,
    clefTableau,
    f,
    catégories = true,
  }: {
    idNuée: string;
    clefTableau: string;
    f: schémaFonctionSuivi<T[]>;
    catégories?: boolean;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (colonnes: T[][]) => {
      await f(colonnes.flat());
    };

    const fParents = async (
      idNuéeParent: string,
      fSuivreBranche: schémaFonctionSuivi<T[]>,
    ): Promise<schémaFonctionOublier> => {
      return await suivreBdDeFonction({
        fRacine: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (nouvelIdBdCible?: string) => Promise<void>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.bds!.suivreIdTableauParClef({
            idBd: idNuéeParent,
            clef: clefTableau,
            f: fSuivreRacine,
          });
        },
        f: ignorerNonDéfinis(fSuivreBranche),
        fSuivre: async ({
          id: idTableau,
          fSuivreBd,
        }: {
          id: string;
          fSuivreBd: schémaFonctionSuivi<T[]>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.tableaux!.suivreColonnesTableau<T>({
            idTableau,
            f: fSuivreBd,
            catégories,
          });
        },
      });
    };

    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents,
    });
  }

  async ajouterRègleTableauNuée<R extends règleVariable = règleVariable>({
    idTableau,
    idColonne,
    règle,
  }: {
    idTableau: string;
    idColonne: string;
    règle: R;
  }): Promise<string> {
    return await this.client.tableaux!.ajouterRègleTableau({
      idTableau,
      idColonne,
      règle,
    });
  }

  async effacerRègleTableauNuée({
    idTableau,
    idRègle,
  }: {
    idTableau: string;
    idRègle: string;
  }): Promise<void> {
    return await this.client.tableaux!.effacerRègleTableau({
      idTableau,
      idRègle,
    });
  }

  @cacheSuivi
  async suivreRèglesTableauNuée({
    idNuée,
    clefTableau,
    f,
  }: {
    idNuée: string;
    clefTableau: string;
    f: schémaFonctionSuivi<règleColonne[]>;
    catégories?: boolean;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (règles: règleColonne[][]) => {
      await f(règles.flat());
    };

    const fParents = async (
      idNuéeParent: string,
      fSuivreBranche: schémaFonctionSuivi<règleColonne[]>,
    ): Promise<schémaFonctionOublier> => {
      return await suivreBdDeFonction({
        fRacine: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (nouvelIdBdCible?: string) => Promise<void>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.bds!.suivreIdTableauParClef({
            idBd: idNuéeParent,
            clef: clefTableau,
            f: fSuivreRacine,
          });
        },
        f: ignorerNonDéfinis(fSuivreBranche),
        fSuivre: async ({
          id: idTableau,
          fSuivreBd,
        }: {
          id: string;
          fSuivreBd: schémaFonctionSuivi<règleColonne[]>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.tableaux!.suivreRègles({
            idTableau,
            f: fSuivreBd,
          });
        },
      });
    };
    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents,
    });
  }

  async suivreVariablesNuée({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (variables?: string[]) => {
      return await f(variables || []);
    };

    const fBranche = async (
      id: string,
      f: schémaFonctionSuivi<string[]>,
    ): Promise<schémaFonctionOublier> => {
      return await this.client.tableaux!.suivreVariables({ idTableau: id, f });
    };

    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>,
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxNuée({
        idNuée,
        f: (x) => fSuivreRacine(x.map((x) => x.id)),
      });
    };

    return await this.client.suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  @cacheSuivi
  async suivreQualitéNuée({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<number>;
  }): Promise<schémaFonctionOublier> {
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

  @cacheSuivi
  async suivreDifférencesNuéeEtTableau({
    idNuée,
    clefTableau,
    idTableau,
    f,
    stricte = true,
  }: {
    idNuée: string;
    clefTableau: string;
    idTableau: string;
    f: schémaFonctionSuivi<différenceTableaux[]>;
    stricte?: boolean;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (différences: différenceTableaux[]) => {
      const différencesFinales = différences.filter((d) => stricte || d.sévère);
      await f(différencesFinales);
    };
    const fRacine = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (nouvelIdBdCible?: string) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      // On peut traiter la nuée comme une BD
      return await this.client.bds!.suivreIdTableauParClef({
        idBd: idNuée,
        clef: clefTableau,
        f: fSuivreRacine,
      });
    };

    const fSuivre = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<différenceTableaux[]>;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.tableaux!.suivreDifférencesAvecTableau({
        idTableau,
        idTableauRéf: id,
        f: fSuivreBd,
      });
    };
    return await suivreBdDeFonction({
      fRacine,
      f: ignorerNonDéfinis(fFinale),
      fSuivre,
    });
  }

  @cacheSuivi
  async suivreDifférencesNuéeEtBd({
    idNuée,
    idBd,
    f,
  }: {
    idNuée: string;
    idBd: string;
    f: schémaFonctionSuivi<différenceBds[]>;
  }): Promise<schémaFonctionOublier> {
    const info: {
      tableauxBd?: infoTableauAvecId[];
      tableauxNuée?: infoTableauAvecId[];
    } = {};

    const fFinale = async () => {
      const différences: différenceBds[] = [];

      if (info.tableauxNuée && info.tableauxBd) {
        for (const tableauNuée of info.tableauxNuée) {
          const tableau = info.tableauxNuée.find(
            (t) => t.clef === tableauNuée.clef,
          );
          if (!tableau) {
            const dif: différenceBDTableauManquant = {
              type: "tableauManquant",
              sévère: true,
              clefManquante: tableauNuée.clef,
            };
            différences.push(dif);
          }
        }
        for (const tableau of info.tableauxBd) {
          const tableauLié = info.tableauxNuée.find(
            (t) => t.clef === tableau.clef,
          );
          if (!tableauLié) {
            const dif: différenceBDTableauSupplémentaire = {
              type: "tableauSupplémentaire",
              sévère: false,
              clefExtra: tableau.clef,
            };
            différences.push(dif);
          }
        }
      }

      await f(différences);
    };

    const fOublierTableauxBd = await this.client.bds!.suivreTableauxBd({
      idBd,
      f: (tableaux) => {
        info.tableauxBd = tableaux;
        fFinale();
      },
    });

    const fOublierTableauxNuée = await this.suivreTableauxNuée({
      idNuée,
      f: (tableaux) => {
        info.tableauxNuée = tableaux;
        fFinale();
      },
    });

    return async () => {
      await fOublierTableauxBd();
      await fOublierTableauxNuée();
    };
  }

  @cacheSuivi
  async suivreCorrespondanceBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<correspondanceBdEtNuée[]>;
  }): Promise<schémaFonctionOublier> {
    const fSuivreNuéesDeBd = async (
      fSuivreRacine: (idsNuées: string[]) => Promise<void>,
    ): Promise<schémaFonctionOublier> => {
      return await this.client.bds!.suivreNuéesBd({
        idBd,
        f: fSuivreRacine,
      });
    };
    const fSuivreNuée = async (
      idNuée: string,
      fSuivreBd: schémaFonctionSuivi<différenceBds[]>,
    ): Promise<schémaFonctionOublier> => {
      const info: {
        différencesBds: différenceBds[];
        différencesTableaux: différenceTableauxBds[];
      } = {
        différencesBds: [],
        différencesTableaux: [],
      };

      const fFinaleNuée = async () => {
        fSuivreBd([...info.différencesBds, ...info.différencesTableaux]);
      };

      const fOublierDifférencesBd = await this.suivreDifférencesNuéeEtBd({
        idNuée,
        idBd,
        f: async (différences) => {
          info.différencesBds = différences;
          await fFinaleNuée();
        },
      });

      const fBranche = async (
        id: string,
        fSuivreBranche: schémaFonctionSuivi<différenceTableauxBds[]>,
        branche: infoTableauAvecId,
      ): Promise<schémaFonctionOublier> => {
        return await this.suivreDifférencesNuéeEtTableau({
          idNuée,
          clefTableau: branche.clef,
          idTableau: id,
          f: async (diffs) => {
            await fSuivreBranche(
              diffs.map((d) => {
                return {
                  type: "tableau",
                  sévère: d.sévère,
                  idTableau: id,
                  différence: d,
                };
              }),
            );
          },
        });
      };

      const fOublierDifférencesTableaux =
        await this.client.suivreBdsDeFonctionListe({
          fListe: async (
            fSuivreRacine: (idsTableaux: infoTableauAvecId[]) => Promise<void>,
          ): Promise<schémaFonctionOublier> => {
            return await this.client.bds!.suivreTableauxBd({
              idBd,
              f: fSuivreRacine,
            });
          },
          f: async (diffs: différenceTableauxBds[]) => {
            info.différencesTableaux = diffs;
            await fFinaleNuée();
          },
          fBranche,
          fCode: (t) => t.id,
          fIdBdDeBranche: (t) => t.id,
        });

      return async () => {
        await Promise.all([fOublierDifférencesBd, fOublierDifférencesTableaux]);
      };
    };

    return await this.client.suivreBdsDeFonctionListe({
      fListe: fSuivreNuéesDeBd,
      f,
      fBranche: fSuivreNuée,
    });
  }

  @cacheRechercheParNRésultats
  async rechercherNuéesDéscendantes({
    idNuée,
    f,
    nRésultatsDésirés,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fFinale = async (
      résultats: résultatRecherche<infoRésultatVide>[],
    ) => {
      f(résultats.map((r) => r.id));
    };
    return await this.client.réseau!.rechercherNuées({
      f: fFinale,
      fObjectif: async (
        client: ClientConstellation,
        id: string,
        f: schémaFonctionSuiviRecherche<infoRésultatVide>,
      ): Promise<schémaFonctionOublier> => {
        return await client.nuées!.suivreNuéesParents({
          idNuée: id,
          f: (parents) => {
            f({
              type: "résultat",
              score: parents.includes(idNuée) ? 1 : 0,
              de: "*",
              info: {
                type: "vide",
              },
            });
          },
        });
      },
      nRésultatsDésirés,
    });
  }

  @cacheSuivi
  async suivreNuéesParents({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const suivreParent = async ({
      id,
      ancêtres = [],
    }: {
      id: string;
      ancêtres?: string[];
    }): Promise<schémaFonctionOublier> => {
      let fOublierParent: schémaFonctionOublier | undefined;
      let ancienParent: string;

      const fOublier = await this.client.suivreBd({
        id,
        type: "keyvalue",
        schéma: schémaStructureBdNuée,
        f: async (bd) => {
          const parent = await bd.get("parent");
          ancêtres = [...ancêtres];
          if (parent) ancêtres.push(parent);
          await f(ancêtres);
          if (parent) {
            if (parent !== ancienParent) {
              if (fOublierParent) await fOublierParent();
              if (!ancêtres.includes(parent)) {
                // Éviter récursion infinie
                fOublierParent = await suivreParent({ id: parent, ancêtres });
              }
              ancienParent = parent;
            }
          } else {
            if (fOublierParent) await fOublierParent();
            fOublierParent = undefined;
          }
        },
      });
      return async () => {
        await fOublier();
        if (fOublierParent) await fOublierParent();
      };
    };

    return await suivreParent({ id: idNuée });
  }

  @cacheRechercheParNRésultats
  async suivreBdsCorrespondantes({
    idNuée,
    f,
    vérifierAutorisation = true,
    nRésultatsDésirés,
    toujoursInclureLesMiennes = true,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string[]>;
    vérifierAutorisation?: boolean;
    nRésultatsDésirés: number;
    toujoursInclureLesMiennes?: boolean;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    if (vérifierAutorisation) {
      const info: {
        philoAutorisation?: "CJPI" | "IJPC";
        membres?: statutMembreNuée[];
        bds?: { idBd: string; auteurs: string[] }[];
      } = {};

      const fFinale = async (): Promise<void> => {
        const { philoAutorisation, membres, bds } = info;

        if (!bds) return;

        if (!philoAutorisation) {
          if (toujoursInclureLesMiennes) {
            return await f(
              bds
                .filter((bd) =>
                  bd.auteurs.some((c) => c === this.client.idCompte),
                )
                .map((x) => x.idBd),
            );
          }
          return;
        }

        if (!membres) return;
        const idMonCompte = await this.client.obtIdCompte();

        const filtrerAutorisation = (
          bds_: { idBd: string; auteurs: string[] }[],
        ): string[] => {
          if (philoAutorisation === "CJPI") {
            const invités = membres
              .filter((m) => m.statut === "accepté")
              .map((m) => m.idCompte);

            return bds_
              .filter(
                (x) =>
                  x.auteurs.some((c) => invités.includes(c)) ||
                  (toujoursInclureLesMiennes &&
                    x.auteurs.includes(idMonCompte)),
              )
              .map((x) => x.idBd);
          } else if (philoAutorisation === "IJPC") {
            const exclus = membres
              .filter((m) => m.statut === "exclus")
              .map((m) => m.idCompte);
            return bds_
              .filter((x) => !x.auteurs.some((c) => exclus.includes(c)))
              .map((x) => x.idBd);
          } else {
            throw new Error(philoAutorisation);
          }
        };
        return await f(filtrerAutorisation(bds));
      };

      const fOublierSuivrePhilo = await this.suivrePhilosophieAutorisation({
        idNuée,
        f: async (philo) => {
          info.philoAutorisation = philo;
          await fFinale();
        },
      });

      const fOublierSuivreMembres = await this.suivreAutorisationsMembresDeNuée(
        {
          idNuée,
          f: async (membres) => {
            info.membres = membres;
            await fFinale();
          },
        },
      );

      const fSuivreBds = async (bds: { idBd: string; auteurs: string[] }[]) => {
        info.bds = bds;
        await fFinale();
      };

      const fListe = async (
        fSuivreRacine: (éléments: string[]) => Promise<void>,
      ): Promise<schémaRetourFonctionRechercheParProfondeur> => {
        return await this.client.réseau!.suivreBdsDeNuée({
          idNuée,
          f: fSuivreRacine,
          nRésultatsDésirés,
        });
      };

      const fBranche = async (
        idBd: string,
        fSuivreBranche: schémaFonctionSuivi<{
          idBd: string;
          auteurs: string[];
        }>,
      ): Promise<schémaFonctionOublier> => {
        const fFinaleSuivreBranche = async (
          auteurs: infoAuteur[],
        ): Promise<void> => {
          return await fSuivreBranche({
            idBd,
            auteurs: auteurs
              .filter((x) => x.accepté) // Uniquement considérer les auteurs qui ont accepté l'invitation.
              .map((x) => x.idCompte),
          });
        };
        return await this.client.réseau!.suivreAuteursBd({
          idBd,
          f: fFinaleSuivreBranche,
        });
      };

      const { fOublier: fOublierBds, fChangerProfondeur } =
        await this.client.suivreBdsDeFonctionListe({
          fListe,
          f: fSuivreBds,
          fBranche,
        });

      const fOublier = async () => {
        await Promise.all(
          [fOublierBds, fOublierSuivreMembres, fOublierSuivrePhilo].map((f) =>
            f(),
          ),
        );
      };

      return {
        fOublier,
        fChangerProfondeur,
      };
    } else {
      return await this.client.réseau!.suivreBdsDeNuée({
        idNuée,
        f,
        nRésultatsDésirés,
      });
    }
  }

  @cacheSuivi
  async suivreEmpreinteTêtesBdsNuée({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdsDeFonctionListe({
      fListe: async (fSuivreRacine: (éléments: string[]) => void) => {
        const { fOublier } = await this.suivreBdsCorrespondantes({
          idNuée,
          f: fSuivreRacine,
          nRésultatsDésirés: 1000,
        });
        return fOublier;
      },
      f: async (empreintes: string[]) => {
        const empreinte = Base64.stringify(md5(empreintes.join(":")));
        return await f(empreinte);
      },
      fBranche: async (
        id: string,
        fSuivreBranche: schémaFonctionSuivi<string>,
      ) => {
        return await this.client.suivreEmpreinteTêtesBdRécursive({
          idBd: id,
          f: fSuivreBranche,
        });
      },
    });
  }

  @cacheRechercheParNRésultats
  async suivreDonnéesTableauNuée<T extends élémentBdListeDonnées>({
    idNuée,
    clefTableau,
    f,
    nRésultatsDésirés,
    ignorerErreursFormatBd = true,
    ignorerErreursFormatTableau = false,
    ignorerErreursDonnéesTableau = true,
    licencesPermises = undefined,
    toujoursInclureLesMiennes = true,
    clefsSelonVariables = false,
  }: {
    idNuée: string;
    clefTableau: string;
    f: schémaFonctionSuivi<élémentDeMembreAvecValid<T>[]>;
    nRésultatsDésirés: number;
    ignorerErreursFormatBd?: boolean;
    ignorerErreursFormatTableau?: boolean;
    ignorerErreursDonnéesTableau?: boolean;
    licencesPermises?: string[];
    toujoursInclureLesMiennes?: boolean;
    clefsSelonVariables?: boolean;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    const fFinale = async (
      donnéesTableaux: élémentDeMembreAvecValid<T>[][],
    ) => {
      const éléments = donnéesTableaux.flat();
      await f(éléments);
    };

    const fListe = async (
      fSuivreRacine: (bds: string[]) => Promise<void>,
    ): Promise<schémaRetourFonctionRechercheParProfondeur> => {
      return await this.suivreBdsCorrespondantes({
        idNuée,
        f: fSuivreRacine,
        nRésultatsDésirés,
        toujoursInclureLesMiennes,
      });
    };

    const fSuivreBdsConformes = async (
      fSuivreRacine: (bds: string[]) => Promise<void>,
    ): Promise<schémaRetourFonctionRechercheParProfondeur> => {
      const fCondition = async (
        idBd: string,
        fSuivreCondition: schémaFonctionSuivi<boolean>,
      ): Promise<schémaFonctionOublier> => {
        const conformes: { licence: boolean; formatBd: boolean } = {
          licence: false,
          formatBd: true, // Ça doit être vrai par défaut, en attendant de rejoindre la nuée distante
        };
        const fsOublier: schémaFonctionOublier[] = [];

        const fFinaleBdConforme = async () => {
          const conforme = Object.values(conformes).every((x) => x);
          await fSuivreCondition(conforme);
        };

        if (licencesPermises) {
          const fOublierLicence = await this.client.bds!.suivreLicenceBd({
            idBd,
            f: async (licence) => {
              conformes.licence = licencesPermises.includes(licence);
              return await fFinaleBdConforme();
            },
          });
          fsOublier.push(fOublierLicence);
        } else {
          conformes.licence = true;
        }

        if (ignorerErreursFormatBd) {
          conformes.formatBd = true;
        } else {
          const fOublierErreursFormatBd = await this.suivreDifférencesNuéeEtBd({
            idBd,
            idNuée,
            f: async (différences) => {
              conformes.formatBd = !différences.length;
              return await fFinaleBdConforme();
            },
          });
          fsOublier.push(fOublierErreursFormatBd);
        }
        await fFinaleBdConforme();

        return async () => {
          await Promise.all(fsOublier.map((f) => f()));
        };
      };
      return await this.client.suivreBdsSelonCondition({
        fListe,
        fCondition,
        f: fSuivreRacine,
      });
    };

    const fBranche = async (
      idBd: string,
      fSuivreBranche: schémaFonctionSuivi<élémentDeMembreAvecValid<T>[]>,
    ): Promise<schémaFonctionOublier> => {
      const info: {
        auteurs?: infoAuteur[];
        données?: élémentDonnées<T>[];
        erreursÉléments?: erreurValidation[];
        erreursTableau?: différenceTableaux[];
      } = {};

      const fFinaleBranche = async () => {
        const { données, erreursÉléments, auteurs } = info;
        if (données && erreursÉléments && auteurs && auteurs.length) {
          const auteur = auteurs.find((a) => a.accepté)?.idCompte;
          if (!auteur) return;

          const donnéesMembres: élémentDeMembreAvecValid<T>[] = données
            .map((d) => {
              return {
                idCompte: auteur,
                élément: d,
                valid: erreursÉléments.filter(
                  (e) => e.empreinte == d.empreinte,
                ),
              };
            })
            .filter((d) => ignorerErreursDonnéesTableau || !d.valid.length);
          await fSuivreBranche(donnéesMembres);
        }
      };

      const fSuivreTableau = async ({
        id,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: schémaFonctionSuivi<{
          données?: élémentDonnées<T>[];
          erreurs?: erreurValidation<règleVariable>[];
        }>;
      }): Promise<schémaFonctionOublier> => {
        const infoTableau: {
          données?: élémentDonnées<T>[];
          erreurs?: erreurValidation<règleVariable>[];
        } = {};
        const fsOublier: schémaFonctionOublier[] = [];

        const fFinaleTableau = async () => {
          const { données, erreurs } = infoTableau;
          if (données && erreurs) {
            await fSuivreBd({ données, erreurs });
          }
        };
        const fOublierDonnnées = await this.client.tableaux!.suivreDonnées<T>({
          idTableau: id,
          f: async (données) => {
            infoTableau.données = données;
            await fFinaleTableau();
          },
          clefsSelonVariables,
        });
        fsOublier.push(fOublierDonnnées);

        const fOublierErreurs = await this.client.tableaux!.suivreValidDonnées({
          idTableau: id,
          f: async (erreurs) => {
            infoTableau.erreurs = erreurs;
            await fFinaleTableau();
          },
        });
        fsOublier.push(fOublierErreurs);

        return async () => {
          await Promise.all(fsOublier.map((f) => f()));
        };
      };

      const fOublierSuivreTableau = await suivreBdDeFonction<{
        données?: élémentDonnées<T>[];
        erreurs?: erreurValidation<règleVariable>[];
      }>({
        fRacine: async ({ fSuivreRacine }) => {
          return await this.client.suivreBdSelonCondition({
            fRacine: async (
              fSuivreRacineListe: (id: string) => Promise<void>,
            ) => {
              return await this.client.bds!.suivreIdTableauParClef({
                idBd,
                clef: clefTableau,
                f: ignorerNonDéfinis(fSuivreRacineListe),
              });
            },
            fCondition: async (
              idTableau: string,
              fSuivreCondition: schémaFonctionSuivi<boolean>,
            ) => {
              if (ignorerErreursFormatTableau) {
                await fSuivreCondition(true);
                return faisRien;
              } else {
                // Il faut envoyer une condition vraie par défaut au début au cas où la nuée ne serait pas rejoignable
                await fSuivreCondition(true);

                return await this.suivreDifférencesNuéeEtTableau({
                  idNuée,
                  clefTableau,
                  idTableau,
                  f: async (différences) =>
                    await fSuivreCondition(!différences.length),
                  stricte: false,
                });
              }
            },
            f: fSuivreRacine,
          });
        },
        f: async (x) => {
          info.données = x?.données;
          info.erreursÉléments = x?.erreurs;
          await fFinaleBranche();
        },
        fSuivre: fSuivreTableau,
      });

      const fOublierAuteursBd = await this.client.réseau!.suivreAuteursBd({
        idBd,
        f: async (auteurs) => {
          info.auteurs = auteurs;
          await fFinaleBranche();
        },
      });

      return async () => {
        await Promise.all([fOublierSuivreTableau, fOublierAuteursBd]);
      };
    };

    return await this.client.suivreBdsDeFonctionListe({
      fListe: fSuivreBdsConformes,
      f: fFinale,
      fBranche,
    });
  }

  async exporterDonnéesNuée({
    idNuée,
    langues,
    nomFichier,
    nRésultatsDésirés,
  }: {
    idNuée: string;
    langues?: string[];
    nomFichier?: string;
    nRésultatsDésirés: number;
  }): Promise<donnéesBdExportées> {
    const doc = utils.book_new();
    const fichiersSFIP: Set<{ cid: string; ext: string }> = new Set();

    const infosTableaux = await uneFois(
      (f: schémaFonctionSuivi<infoTableauAvecId[]>) =>
        this.suivreTableauxNuée({ idNuée, f }),
    );

    for (const tableau of infosTableaux) {
      const { clef: clefTableau, id: idTableau } = tableau;

      let nomTableau: string;
      const idCourtTableau = idTableau.split("/").pop()!;
      if (langues) {
        const noms = await uneFois(
          (f: schémaFonctionSuivi<{ [key: string]: string }>) =>
            this.suivreNomsTableauNuée({ idNuée, clefTableau, f }),
        );

        nomTableau = traduire(noms, langues) || idCourtTableau;
      } else {
        nomTableau = idCourtTableau;
      }

      const donnéesTableau = await uneFois(
        async (
          fSuivi: schémaFonctionSuivi<
            élémentDeMembreAvecValid<élémentBdListeDonnées>[]
          >,
        ) => {
          const { fOublier } = await this.suivreDonnéesTableauNuée({
            idNuée,
            clefTableau,
            f: fSuivi,
            nRésultatsDésirés,
            clefsSelonVariables: false,
          });
          return fOublier;
        },
      );
      const colonnes = await uneFois(
        async (f: schémaFonctionSuivi<InfoColAvecCatégorie[]>) =>
          await this.suivreColonnesTableauNuée({ idNuée, clefTableau, f }),
      );
      let donnéesPourXLSX: élémentBdListeDonnées[] = await Promise.all(
        donnéesTableau.map(async (d) => {
          const élémentFormatté = await this.client.tableaux!.formaterÉlément({
            é: d.élément.données,
            colonnes,
            fichiersSFIP,
            langues,
          });
          return { ...élémentFormatté, auteur: d.idCompte };
        }),
      );
      if (langues) {
        const variables = await uneFois((f: schémaFonctionSuivi<string[]>) =>
          this.suivreVariablesNuée({ idNuée, f }),
        );
        const nomsVariables: { [key: string]: string } = { auteur: "auteur" };
        for (const idVar of variables) {
          const nomsDisponibles = await uneFois(
            (f: schémaFonctionSuivi<{ [key: string]: string }>) =>
              this.client.variables!.suivreNomsVariable({
                idVariable: idVar,
                f,
              }),
          );

          const idCol = colonnes.find((c) => c.variable === idVar)?.id;
          nomsVariables[idVar] =
            traduire(nomsDisponibles, langues) || idCol || idVar;
        }
        donnéesPourXLSX = donnéesPourXLSX.map((d) =>
          Object.keys(d).reduce((acc: élémentBdListeDonnées, elem: string) => {
            const nomVar = nomsVariables[elem];
            acc[nomVar] = d[elem];
            return acc;
          }, {}),
        );
      }

      /* Créer le tableau */
      const tableauXLSX = utils.json_to_sheet(donnéesPourXLSX);

      /* Ajouter la feuille au document. XLSX n'accepte pas les noms de colonne > 31 caractères */
      utils.book_append_sheet(doc, tableauXLSX, nomTableau.slice(0, 30));
    }

    if (!nomFichier) {
      const nomsNuée = await uneFois(
        (f: schémaFonctionSuivi<{ [key: string]: string }>) =>
          this.suivreNomsNuée({ idNuée, f }),
      );
      const idCourt = idNuée.split("/").pop()!;

      nomFichier = langues ? traduire(nomsNuée, langues) || idCourt : idCourt;
    }

    return { doc, fichiersSFIP, nomFichier };
  }

  async générerDeBd({ idBd }: { idBd: string }): Promise<string> {
    const idNuée = await this.créerNuée({});

    // Noms
    const noms = await uneFois(
      async (
        fSuivi: schémaFonctionSuivi<{ [key: string]: string }>,
      ): Promise<schémaFonctionOublier> => {
        return await this.client.bds!.suivreNomsBd({ idBd, f: fSuivi });
      },
    );
    await this.sauvegarderNomsNuée({
      idNuée,
      noms,
    });

    // Descriptions
    const descriptions = await uneFois(
      async (
        fSuivi: schémaFonctionSuivi<{ [key: string]: string }>,
      ): Promise<schémaFonctionOublier> => {
        return await this.client.bds!.suivreDescriptionsBd({ idBd, f: fSuivi });
      },
    );
    await this.sauvegarderDescriptionsNuée({
      idNuée,
      descriptions,
    });

    // Mots-clefs
    const idsMotsClefs = await uneFois(
      async (
        fSuivi: schémaFonctionSuivi<string[]>,
      ): Promise<schémaFonctionOublier> => {
        return await this.client.bds!.suivreMotsClefsBd({
          idBd,
          f: fSuivi,
        });
      },
    );
    await this.ajouterMotsClefsNuée({
      idNuée,
      idsMotsClefs,
    });

    // Tableaux
    const tableaux = await uneFois(
      async (
        fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>,
      ): Promise<schémaFonctionOublier> => {
        return await this.client.bds!.suivreTableauxBd({ idBd, f: fSuivi });
      },
    );

    for (const tableau of tableaux) {
      const idTableau = tableau.id;
      const idTableauNuée = await this.ajouterTableauNuée({
        idNuée,
        clefTableau: tableau.clef,
      });

      // Colonnes
      const colonnes = await uneFois(
        async (
          fSuivi: schémaFonctionSuivi<InfoCol[]>,
        ): Promise<schémaFonctionOublier> => {
          return await this.client.tableaux!.suivreColonnesTableau({
            idTableau,
            f: fSuivi,
            catégories: false,
          });
        },
      );
      for (const col of colonnes) {
        await this.ajouterColonneTableauNuée({
          idTableau: idTableauNuée,
          idVariable: col.variable,
          idColonne: col.id,
          index: col.index,
        });

        // Indexes
        await this.changerColIndexTableauNuée({
          idTableau: idTableauNuée,
          idColonne: col.id,
          val: !!col.index,
        });

        // Règles
        const règles = await uneFois(
          async (
            fSuivi: schémaFonctionSuivi<règleColonne<règleVariable>[]>,
          ): Promise<schémaFonctionOublier> => {
            return await this.client.tableaux!.suivreRègles({
              idTableau,
              f: fSuivi,
            });
          },
        );
        for (const règle of règles) {
          if (règle.source.type === "tableau") {
            await this.ajouterRègleTableauNuée({
              idTableau: idTableauNuée,
              idColonne: col.id,
              règle: règle.règle.règle,
            });
          }
        }
      }
    }

    return idNuée;
  }

  async générerSchémaBdNuée({
    idNuée,
    licence,
  }: {
    idNuée: string;
    licence: string;
  }): Promise<schémaSpécificationBd> {
    const tableaux = await uneFois(
      async (fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>) => {
        return await this.suivreTableauxNuée({
          idNuée,
          f: fSuivi,
        });
      },
    );
    const règles: { [clef: string]: règleColonne[] } = {};
    for (const t of tableaux) {
      règles[t.clef] = await uneFois(
        async (fSuivi: schémaFonctionSuivi<règleColonne[]>) => {
          return await this.suivreRèglesTableauNuée({
            idNuée,
            clefTableau: t.clef,
            f: fSuivi,
          });
        },
      );
    }
    const générerCols = async (tableau: infoTableauAvecId) => {
      return await uneFois(
        async (fSuivi: schémaFonctionSuivi<InfoColAvecCatégorie[]>) => {
          return await this.suivreColonnesTableauNuée({
            idNuée,
            clefTableau: tableau.clef,
            f: fSuivi,
          });
        },
        (x) => !!x && !!x.length,
      );
    };

    const schéma: schémaSpécificationBd = {
      licence,
      nuées: [idNuée],
      tableaux: await Promise.all(
        tableaux.map(async (t) => {
          const cols = await générerCols(t);
          return {
            cols: cols.map((c) => {
              const obligatoire = règles[t.clef]?.some(
                (r) =>
                  r.colonne === c.id && r.règle.règle.typeRègle === "existe",
              );
              return {
                idColonne: c.id,
                idVariable: c.variable,
                index: c.index,
                optionnel: !obligatoire,
              };
            }),
            clef: t.clef,
          };
        }),
      ),
    };

    return schéma;
  }

  async effacerNuée({ idNuée }: { idNuée: string }): Promise<void> {
    // D'abord effacer l'entrée dans notre liste de BDs
    const { bd: bdRacine, fOublier } = await this.obtBd();
    await this.client.effacerÉlémentDeBdListe({
      bd: bdRacine,
      élément: idNuée,
    });
    await fOublier();

    // Et puis maintenant aussi effacer les tableaux et la Nuée elle-même
    for (const clef in ["noms", "descriptions", "motsClefs"]) {
      const idBd = await this.client.obtIdBd({
        nom: clef,
        racine: idNuée,
      });
      if (idBd) await this.client.effacerBd({ id: idBd });
    }
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: idNuée,
      type: "keyvalue",
    });
    if (idBdTableaux) {
      const { bd: bdTableaux, fOublier: fOublierTableaux } =
        await this.client.orbite!.ouvrirBdTypée({
          id: idBdTableaux,
          type: "keyvalue",
          schéma: schémaBdTableauxDeBd,
        });
      const tableaux: string[] = Object.keys(bdTableaux.all);
      for (const t of tableaux) {
        await this.client.tableaux!.effacerTableau({ idTableau: t });
      }
      fOublierTableaux();
      await this.client.effacerBd({ id: idBdTableaux });
    }

    await this.enleverDeMesNuées({ idNuée });
    await this.client.effacerBd({ id: idNuée });
  }
}
