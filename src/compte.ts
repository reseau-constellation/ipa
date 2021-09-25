import { KeyValueStore } from "orbit-db";
import { ImportCandidate } from "ipfs-core-types/src/utils";

import ClientConstellation, {
  schémaFonctionSuivi,
  schémaFonctionOublier,
} from "./client";

export const MAX_TAILLE_IMAGE = 500 * 1000; // 500 kilooctets
export const MAX_TAILLE_IMAGE_VIS = 1500 * 1000; // 1,5 megaoctets

export default class Compte {
  client: ClientConstellation;
  idBd: string;
  MAX_TAILLE_IMAGE = MAX_TAILLE_IMAGE;
  MAX_TAILLE_IMAGE_VIS = MAX_TAILLE_IMAGE_VIS;

  constructor(client: ClientConstellation, id: string) {
    this.client = client;
    this.idBd = id;
  }

  async suivreCourriel(
    f: schémaFonctionSuivi<string | null>,
    idBdCompte?: string
  ): Promise<schémaFonctionOublier> {
    idBdCompte = idBdCompte || this.idBd;
    return await this.client.suivreBd(idBdCompte, async (bd) => {
      const courriel = await (bd as KeyValueStore).get("courriel");
      f(courriel || null);
    });
  }

  async sauvegarderCourriel(courriel: string): Promise<void> {
    const bd = (await this.client.ouvrirBd(this.idBd)) as KeyValueStore;
    await bd.set("courriel", courriel);
  }

  async effacerCourriel(): Promise<void> {
    const bd = (await this.client.ouvrirBd(this.idBd)) as KeyValueStore;
    await bd.del("courriel");
  }

  async suivreNoms(
    f: schémaFonctionSuivi<{ [key: string]: string }>,
    idBdCompte?: string
  ): Promise<schémaFonctionOublier> {
    idBdCompte = idBdCompte || this.idBd;
    return await this.client.suivreBdDicDeClef<string>(idBdCompte, "noms", f);
  }

  async sauvegarderNom(langue: string, nom: string): Promise<void> {
    const idBdNoms = await this.client.obtIdBd("noms", this.idBd, "kvstore");
    if (!idBdNoms)
      throw `Permission de modification refusée pour BD ${this.idBd}.`;

    const bd = (await this.client.ouvrirBd(idBdNoms)) as KeyValueStore;
    await bd.set(langue, nom);
  }

  async effacerNom(langue: string): Promise<void> {
    const idBdNoms = await this.client.obtIdBd("noms", this.idBd);
    if (!idBdNoms)
      throw `Permission de modification refusée pour BD ${this.idBd}.`;

    const bd = (await this.client.ouvrirBd(idBdNoms)) as KeyValueStore;
    await bd.del(langue);
  }

  async sauvegarderImage(image: ImportCandidate | File): Promise<void> {
    let contenu: ImportCandidate;

    if (image instanceof File) {
      if (image.size > MAX_TAILLE_IMAGE)
        throw new Error("Taille maximale excédée");
      contenu = await image.arrayBuffer();
    } else {
      contenu = image;
    }
    const idImage = await this.client.ajouterÀSFIP(contenu);
    const bd = (await this.client.ouvrirBd(this.idBd)) as KeyValueStore;
    await bd.set("image", idImage);
  }

  async effacerImage(): Promise<void> {
    const bd = (await this.client.ouvrirBd(this.idBd)) as KeyValueStore;
    await bd.del("image");
  }

  async suivreImage(
    f: schémaFonctionSuivi<Uint8Array | null>,
    idBdCompte?: string
  ): Promise<schémaFonctionOublier> {
    idBdCompte = idBdCompte || this.idBd;
    return await this.client.suivreBd(idBdCompte, async (bd) => {
      const idImage = await (bd as KeyValueStore).get("image");
      if (!idImage) return f(null);
      const image = await this.client.obtFichierSFIP(
        idImage,
        MAX_TAILLE_IMAGE_VIS
      );
      return f(image);
    });
  }
}
