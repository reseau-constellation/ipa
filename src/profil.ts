import type { ImportCandidate } from "ipfs-core-types/src/utils";

import type { default as ClientConstellation } from "@/client.js";
import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  ignorerNonDéfinis,
  schémaStructureBdNoms,
} from "@/utils/index.js";
import { cacheSuivi } from "@/décorateursCache.js";
import { ComposanteClientDic } from "@/composanteClient.js";
import { JSONSchemaType } from "ajv";

export const MAX_TAILLE_IMAGE = 500 * 1000; // 500 kilooctets
export const MAX_TAILLE_IMAGE_VIS = 1500 * 1000; // 1,5 megaoctets

type structureBdProfil = {
  image?: string;
};
const schémaStructureBdProfil: JSONSchemaType<structureBdProfil> = {
  type: "object",
  properties: {
    image: {
      type: "string",
      nullable: true,
    },
  },
  required: [],
};

type structureContactProfil = {
  type: string;
  contact: string;
};
const schémaContactProfil: JSONSchemaType<structureContactProfil> = {
  type: "object",
  properties: {
    type: { type: "string" },
    contact: { type: "string" },
  },
  required: ["contact", "type"],
};

export default class Profil extends ComposanteClientDic<structureBdProfil> {
  constructor({ client }: { client: ClientConstellation }) {
    super({
      client,
      clef: "profil",
      schémaBdPrincipale: schémaStructureBdProfil,
    });
  }

  async épingler() {
    const idBdProfil = await this.obtIdBd();
    await this.client.épingles?.épinglerBd({
      id: idBdProfil,
      récursif: true,
      fichiers: true,
    });
  }

  @cacheSuivi
  async suivreCourriel({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<string | null>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreContacts({
      idCompte,
      f: async (contacts) =>
        await f(contacts.find((c) => c.type == "courriel")?.contact || null),
    });
  }

  async sauvegarderCourriel({ courriel }: { courriel: string }): Promise<void> {
    await this.sauvegarderContact({ type: "courriel", contact: courriel });
  }

  async effacerCourriel(): Promise<void> {
    await this.effacerContact({ type: "courriel" });
  }

  @cacheSuivi
  async suivreContacts({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<{ type: string; contact: string }[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreSousBdListe({
      idCompte,
      clef: "contacts",
      schéma: schémaContactProfil,
      f,
    });
  }

  async sauvegarderContact({
    type,
    contact,
  }: {
    type: string;
    contact: string;
  }): Promise<void> {
    const idBdProfil = await this.obtIdBd();
    const idBdContacts = await this.client.obtIdBd({
      nom: "contacts",
      racine: idBdProfil,
      type: "feed",
    });
    if (!idBdContacts) {
      throw new Error(
        `Permission de modification refusée pour BD ${idBdProfil}.`
      );
    }

    const { bd, fOublier } = await this.client.ouvrirBd({
      id: idBdContacts,
      type: "feed",
      schéma: schémaContactProfil,
    });
    await bd.add({ type, contact });
    await fOublier();
  }

  async effacerContact({
    type,
    contact,
  }: {
    type: string;
    contact?: string;
  }): Promise<void> {
    const idBdProfil = await this.obtIdBd();
    const idBdContacts = await this.client.obtIdBd({
      nom: "contacts",
      racine: idBdProfil,
      type: "feed",
    });
    if (!idBdContacts) {
      throw new Error(
        `Permission de modification refusée pour BD ${idBdProfil}.`
      );
    }

    const { bd, fOublier } = await this.client.ouvrirBd<{
      type: string;
      contact: string;
    }>({
      id: idBdContacts,
      type: "feed",
      schéma: schémaContactProfil,
    });
    this.client.effacerÉlémentsDeBdListe({
      bd,
      élément: (x) =>
        x.payload.value.type === type &&
        (contact === undefined || x.payload.value.contact === contact),
    });
    await fOublier();
  }

  @cacheSuivi
  async suivreNoms({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<{ [key: string]: string }>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreSousBdDic({
      idCompte,
      clef: "noms",
      schéma: schémaStructureBdNoms,
      f,
    });
  }

  async sauvegarderNom({
    langue,
    nom,
  }: {
    langue: string;
    nom: string;
  }): Promise<void> {
    return await this.sauvegarderNoms({ noms: { [langue]: nom } });
  }

  async sauvegarderNoms({
    noms,
  }: {
    noms: { [langue: string]: string };
  }): Promise<void> {
    const idBdProfil = await this.obtIdBd();
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idBdProfil,
      type: "kvstore",
    });
    if (!idBdNoms) {
      throw new Error(
        `Permission de modification refusée pour BD ${idBdProfil}.`
      );
    }

    const { bd, fOublier } = await this.client.ouvrirBd({
      id: idBdNoms,
      type: "kvstore",
      schéma: schémaStructureBdNoms,
    });
    for (const [langue, nom] of Object.entries(noms)) {
      await bd.set(langue, nom);
    }
    await fOublier();
  }

  async effacerNom({ langue }: { langue: string }): Promise<void> {
    const idBdProfil = await this.obtIdBd();
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idBdProfil,
      type: "kvstore",
    });
    if (!idBdNoms) {
      throw new Error(
        `Permission de modification refusée pour BD ${idBdProfil}.`
      );
    }

    const { bd, fOublier } = await this.client.ouvrirBd({
      id: idBdNoms,
      type: "kvstore",
      schéma: schémaStructureBdNoms,
    });
    await bd.del(langue);
    await fOublier();
  }

  async sauvegarderImage({ image }: { image: ImportCandidate }): Promise<void> {
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
    const { bd, fOublier } = await this.obtBd();
    await bd.set("image", idImage);
    await fOublier();
  }

  async effacerImage(): Promise<void> {
    const { bd, fOublier } = await this.obtBd();
    await bd.del("image");
    await fOublier();
  }

  @cacheSuivi
  async suivreImage({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<Uint8Array | null>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        return await this.suivreIdBd({ f: fSuivreRacine, idCompte });
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBd({
          id,
          type: "keyvalue",
          schéma: schémaStructureBdProfil,
          f: async (bd) => {
            const idImage = bd.get("image");
            if (!idImage) {
              return await fSuivreBd(null);
            } else {
              const image = await this.client.obtFichierSFIP({
                id: idImage,
                max: MAX_TAILLE_IMAGE_VIS,
              });
              return await fSuivreBd(image);
            }
          },
        });
      },
    });
  }
}
