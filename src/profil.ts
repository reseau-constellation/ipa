import KeyValueStore from "orbit-db-kvstore";
import type { ImportCandidate } from "ipfs-core-types/src/utils";

import type { default as ClientConstellation } from "@/client.js";
import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  faisRien,
  ignorerNonDéfinis,
  élémentsBd,
} from "@/utils/index.js";
import { cacheSuivi } from "@/décorateursCache.js";

export const MAX_TAILLE_IMAGE = 500 * 1000; // 500 kilooctets
export const MAX_TAILLE_IMAGE_VIS = 1500 * 1000; // 1,5 megaoctets

export type typeÉlémentsBdProfil = string;

export default class Profil {
  client: ClientConstellation;

  constructor({ client }: { client: ClientConstellation }) {
    this.client = client;
  }

  async obtIdBdProfil(): Promise<string | undefined> {
    return await this.client.obtIdBd({
      nom: "compte",
      racine: this.client.bdCompte!,
      type: "kvstore",
    });
  }

  async obtBdProfil(): Promise<{
    bd: KeyValueStore<typeÉlémentsBdProfil>;
    fOublier: schémaFonctionOublier;
  }> {
    const id = (await this.obtIdBdProfil())!;
    return await this.client.ouvrirBd<KeyValueStore<typeÉlémentsBdProfil>>({
      id,
    });
  }

  @cacheSuivi
  async suivreBdProfil({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<string>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        if (idCompte) {
          await fSuivreRacine(idCompte);
          return faisRien;
        } else {
          return await this.client.suivreIdBdCompte({ f: fSuivreRacine });
        }
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBd<KeyValueStore<typeÉlémentsBdProfil>>({
          id,
          f: async () => {
            const idBdProfil = await this.client.obtIdBd({
              nom: "compte",
              racine: id,
              type: "kvstore",
            });
            return await fSuivreBd(idBdProfil);
          },
        });
      },
    });
  }

  @cacheSuivi
  async suivreSousBdDicProfil<T extends élémentsBd>({
    idCompte,
    clef,
    f,
  }: {
    idCompte?: string;
    clef: string;
    f: schémaFonctionSuivi<{
      [key: string]: T;
    }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => {
        return await this.suivreBdProfil({ f: fSuivreRacine, idCompte });
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBdDicDeClef({
          id,
          clef: clef,
          f: fSuivreBd,
        });
      },
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
      f: async (contacts) => await f(contacts["courriel"] || null),
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
    f: schémaFonctionSuivi<{ [type: string]: string }>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreSousBdDicProfil<string>({
      idCompte,
      clef: "contacts",
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
    const idBdProfil = (await this.obtIdBdProfil())!;
    const idBdContacts = await this.client.obtIdBd({
      nom: "contacts",
      racine: idBdProfil,
      type: "kvstore",
    });
    if (!idBdContacts) {
      throw new Error(
        `Permission de modification refusée pour BD ${idBdProfil}.`
      );
    }

    const { bd, fOublier } = await this.client.ouvrirBd<KeyValueStore<string>>({
      id: idBdContacts,
    });
    await bd.set(type, contact);
    await fOublier();
  }

  async effacerContact({ type }: { type: string }): Promise<void> {
    const idBdProfil = (await this.obtIdBdProfil())!;
    const idBdContacts = await this.client.obtIdBd({
      nom: "contacts",
      racine: idBdProfil,
      type: "kvstore",
    });
    if (!idBdContacts) {
      throw new Error(
        `Permission de modification refusée pour BD ${idBdProfil}.`
      );
    }

    const { bd, fOublier } = await this.client.ouvrirBd<KeyValueStore<string>>({
      id: idBdContacts,
    });
    await bd.del(type);
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
    return await this.suivreSousBdDicProfil<string>({
      idCompte,
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
    const idBdProfil = (await this.obtIdBdProfil())!;
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

    const { bd, fOublier } = await this.client.ouvrirBd<KeyValueStore<string>>({
      id: idBdNoms,
    });
    await bd.set(langue, nom);
    await fOublier();
  }

  async effacerNom({ langue }: { langue: string }): Promise<void> {
    const idBdProfil = (await this.obtIdBdProfil())!;
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

    const { bd, fOublier } = await this.client.ouvrirBd<KeyValueStore<string>>({
      id: idBdNoms,
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
    const { bd, fOublier } = await this.obtBdProfil();
    await bd.set("image", idImage);
    await fOublier();
  }

  async effacerImage(): Promise<void> {
    const { bd, fOublier } = await this.obtBdProfil();
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
        return await this.suivreBdProfil({ f: fSuivreRacine, idCompte });
      },
      f: ignorerNonDéfinis(f),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.client.suivreBd({
          id,
          f: async (bd: KeyValueStore<typeÉlémentsBdProfil>) => {
            const idImage = bd.get("image");
            if (!idImage) {
              await fSuivreBd(null);
            } else {
              const image = await this.client.obtFichierSFIP({
                id: idImage,
                max: MAX_TAILLE_IMAGE_VIS,
              });
              await fSuivreBd(image);
            }
          },
        });
      },
    });
  }
}
