import KeyValueStore from "orbit-db-kvstore";
import { ImportCandidate } from "ipfs-core-types/src/utils";

import ClientConstellation from "@/client";
import { schémaFonctionSuivi, schémaFonctionOublier } from "@/utils";

export const MAX_TAILLE_IMAGE = 500 * 1000; // 500 kilooctets
export const MAX_TAILLE_IMAGE_VIS = 1500 * 1000; // 1,5 megaoctets

export type typeÉlémentsBdProfil = string;

export default class Profil {
  client: ClientConstellation;
  idBd: string;

  constructor({ client, id }: { client: ClientConstellation; id: string }) {
    this.client = client;
    this.idBd = id;
  }

  async suivreCourriel({
    f,
    idBdProfil,
  }: {
    f: schémaFonctionSuivi<string | null>;
    idBdProfil?: string;
  }): Promise<schémaFonctionOublier> {
    idBdProfil = idBdProfil || this.idBd;
    return await this.client.suivreBd({
      id: idBdProfil,
      f: async (bd: KeyValueStore<typeÉlémentsBdProfil>) => {
        const courriel = bd.get("courriel");
        f(courriel || null);
      },
    });
  }

  async sauvegarderCourriel({ courriel }: { courriel: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdProfil>
    >({ id: this.idBd });
    await bd.set("courriel", courriel);
    fOublier();
  }

  async effacerCourriel(): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdProfil>
    >({ id: this.idBd });
    await bd.del("courriel");
    fOublier();
  }

  async suivreNoms({
    f,
    idBdProfil,
  }: {
    f: schémaFonctionSuivi<{ [key: string]: string }>;
    idBdProfil?: string;
  }): Promise<schémaFonctionOublier> {
    idBdProfil = idBdProfil || this.idBd;
    return await this.client.suivreBdDicDeClef<string>({
      id: idBdProfil,
      clef: "noms",
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
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: this.idBd,
      type: "kvstore",
    });
    if (!idBdNoms) {
      throw `Permission de modification refusée pour BD ${this.idBd}.`;
    }

    const { bd, fOublier } = await this.client.ouvrirBd<KeyValueStore<string>>({
      id: idBdNoms,
    });
    await bd.set(langue, nom);
    fOublier();
  }

  async effacerNom({ langue }: { langue: string }): Promise<void> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: this.idBd,
      type: "kvstore",
    });
    if (!idBdNoms) {
      throw `Permission de modification refusée pour BD ${this.idBd}.`;
    }

    const { bd, fOublier } = await this.client.ouvrirBd<KeyValueStore<string>>({
      id: idBdNoms,
    });
    await bd.del(langue);
    fOublier();
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
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdProfil>
    >({ id: this.idBd });
    await bd.set("image", idImage);
    fOublier();
  }

  async effacerImage(): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdProfil>
    >({ id: this.idBd });
    await bd.del("image");
    fOublier();
  }

  async suivreImage({
    f,
    idBdProfil,
  }: {
    f: schémaFonctionSuivi<Uint8Array | null>;
    idBdProfil?: string;
  }): Promise<schémaFonctionOublier> {
    idBdProfil = idBdProfil || this.idBd;
    return await this.client.suivreBd({
      id: idBdProfil,
      f: async (bd: KeyValueStore<typeÉlémentsBdProfil>) => {
        const idImage = bd.get("image");
        if (!idImage) return f(null);
        const image = await this.client.obtFichierSFIP({
          id: idImage,
          max: MAX_TAILLE_IMAGE_VIS,
        });
        return f(image);
      },
    });
  }
}
