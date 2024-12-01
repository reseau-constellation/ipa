import { ignorerNonDéfinis, suivreBdDeFonction } from "@constl/utils-ipa";
import { JSONSchemaType } from "ajv";
import {
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaStructureBdNoms,
} from "@/types.js";

import { ComposanteClientDic } from "@/composanteClient.js";
import { cacheSuivi } from "@/décorateursCache.js";
import type { Constellation } from "@/client.js";
import type { ÉpingleFavorisAvecId, ÉpingleProfil } from "./favoris";

export const MAX_TAILLE_IMAGE = 500 * 1000; // 500 kilooctets
export const MAX_TAILLE_IMAGE_VIS = 1500 * 1000; // 1,5 megaoctets

type structureBdProfil = {
  contacts?: string;
  noms?: string;
  image?: string;
  initialisé?: boolean;
};
const schémaStructureBdProfil: JSONSchemaType<structureBdProfil> = {
  type: "object",
  properties: {
    initialisé: {
      type: "boolean",
      nullable: true,
    },
    image: {
      type: "string",
      nullable: true,
    },
    contacts: {
      type: "string",
      nullable: true,
    },
    noms: {
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

export class Profil extends ComposanteClientDic<structureBdProfil> {
  constructor({ client }: { client: Constellation }) {
    super({
      client,
      clef: "profil",
      schémaBdPrincipale: schémaStructureBdProfil,
    });
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisAvecId<ÉpingleProfil>;
    f: schémaFonctionSuivi<Set<string>>;
  }): Promise<schémaFonctionOublier> {
    const épinglerBase = await this.client.favoris.estÉpingléSurDispositif({
      dispositifs: épingle.épingle.base || "TOUS",
    });
    const épinglerFichiers = await this.client.favoris.estÉpingléSurDispositif({
      dispositifs: épingle.épingle.base || "TOUS",
    });

    const fsOublier: schémaFonctionOublier[] = [];
    if (épinglerBase || épinglerFichiers) {
      const fOublierBase = await this.client.suivreBd({
        id: épingle.idObjet,
        type: "keyvalue",
        schéma: schémaStructureBdProfil,
        f: async (bd) => {
          try {
            const contenuBd = await bd.allAsJSON();
            const idcs: string[] = [];
            if (épinglerBase)
              idcs.push(
                ...([
                  épingle.idObjet,
                  contenuBd.contacts,
                  contenuBd.noms,
                ].filter((x) => !!x) as string[]),
              );
            if (épinglerFichiers && contenuBd.image) idcs.push(contenuBd.image);
            await f(new Set(idcs));
          } catch {
            return; // Si la structure n'est pas valide.
          }
        },
      });
      fsOublier.push(fOublierBase);
    }

    return async () => {
      await Promise.all(fsOublier.map((f) => f()));
    };
  }

  async initialiser(): Promise<void> {
    const idBdProfil = await this.obtIdBd();
    const { bd: bdProfil, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdProfil,
      type: "keyvalue",
      schéma: schémaStructureBdProfil,
    });
    await bdProfil.set("initialisé", true);
    await fOublier();
  }

  async suivreInitialisé({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<boolean>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({
      idCompte,
      f: async (profil) => await f(!!profil.initialisé),
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
      type: "set",
    });
    if (!idBdContacts) {
      throw new Error(
        `Permission de modification refusée pour BD ${idBdProfil}.`,
      );
    }

    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdContacts,
      type: "set",
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
      type: "set",
    });
    if (!idBdContacts) {
      throw new Error(
        `Permission de modification refusée pour BD ${idBdProfil}.`,
      );
    }

    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdContacts,
      type: "set",
      schéma: schémaContactProfil,
    });
    const tous = await bd.all();
    const àEffacer = tous.filter(
      (x) =>
        x.value.type === type &&
        (contact === undefined || x.value.contact === contact),
    );
    await Promise.all(àEffacer.map(async (c) => await bd.del(c.value)));

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
      type: "keyvalue",
    });
    if (!idBdNoms) {
      throw new Error(
        `Permission de modification refusée pour BD ${idBdProfil}.`,
      );
    }

    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdNoms,
      type: "keyvalue",
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
      type: "keyvalue",
    });
    if (!idBdNoms) {
      throw new Error(
        `Permission de modification refusée pour BD ${idBdProfil}.`,
      );
    }

    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdNoms,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    await bd.del(langue);
    await fOublier();
  }

  async sauvegarderImage({
    image,
  }: {
    image: { contenu: Uint8Array; nomFichier: string };
  }): Promise<void> {
    if (image.contenu.byteLength > MAX_TAILLE_IMAGE) {
      throw new Error("Taille maximale excédée");
    }

    const idImage = await this.client.ajouterÀSFIP(image);
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
    return await suivreBdDeFonction({
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
            const idImage = await bd.get("image");
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
