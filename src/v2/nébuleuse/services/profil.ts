import { v4 as uuidv4 } from "uuid";
import { idcValide } from "@constl/utils-ipa";
import { RechercheProfils } from "@/v2/recherche/profils.js";
import { cacheSuivi } from "../cache.js";
import { mapÀObjet } from "../utils.js";
import { ServiceDonnéesAppli } from "./services.js";
import { nulÀObjetVide } from "./utils.js";
import type { JSONSchemaType } from "ajv";
import type { Appli } from "@/v2/appli/appli.js";
import type {
  BaseÉpingleFavoris,
  DispositifsÉpingle,
  ÉpingleFavorisBooléenniséeAvecId,
} from "@/v2/nébuleuse/services/favoris.js";
import type { Suivi, Oublier } from "../types.js";
import type { PartielRécursif, TraducsTexte } from "../../types.js";
import type { ServicesLibp2pNébuleuse } from "./libp2p/libp2p.js";
import type { ServicesNécessairesCompte } from "./compte/compte.js";
import type { ServiceDispositifs } from "./dispositifs.js";

// Types épingle

export type ÉpingleProfil = BaseÉpingleFavoris & {
  type: "profil";
  fichiers: DispositifsÉpingle;
};

// Types structure

export type StructureProfil = {
  initialisé: boolean;
  noms: TraducsTexte;
  bios: TraducsTexte;
  image: string;
  contacts: {
    [id: string]: { type: string; contact: string };
  };
};

export const schémaProfil: JSONSchemaType<PartielRécursif<StructureProfil>> & {
  nullable: true;
} = {
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
    noms: {
      type: "object",
      additionalProperties: {
        type: "string",
        nullable: true,
      },
      nullable: true,
    },
    bios: {
      type: "object",
      additionalProperties: {
        type: "string",
        nullable: true,
      },
      nullable: true,
      required: [],
    },
    contacts: {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: {
          type: {
            type: "string",
            nullable: true,
          },
          contact: {
            type: "string",
            nullable: true,
          },
        },
        nullable: true,
      },
      nullable: true,
      required: [],
    },
  },
  nullable: true,
};

export type ServicesNécessairesProfil<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> = ServicesNécessairesCompte<L> & {
  dispositifs: ServiceDispositifs<L>;
  profil: Profil<L>;
};

export class Profil<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> extends ServiceDonnéesAppli<
  "profil",
  StructureProfil,
  L,
  ServicesNécessairesProfil<L>
> {
  recherche: RechercheProfils<L>;

  constructor({ appli }: { appli: Appli<ServicesNécessairesProfil<L>> }) {
    super({
      appli,
      clef: "profil",
      dépendances: ["dispositifs", "orbite", "hélia"],
      options: {
        schéma: schémaProfil,
      },
    });
    this.recherche = new RechercheProfils<L>({
      profils: this,
      constl: this.appli,
      service: (clef) => this.service(clef),
    });
  }

  async initialiser(): Promise<void> {
    const bd = await this.bd();
    await bd.set("initialisé", true);

    const dispositifs = this.service("dispositifs");
    await dispositifs.sauvegarderTypeDispositif();
  }

  async suivreInitialisé({
    f,
    idCompte,
  }: {
    f: Suivi<boolean | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    return await this.suivreBd({
      idCompte,
      f: async (profil) => await f(!!profil?.initialisé),
    });
  }

  // Nom
  @cacheSuivi
  async suivreNoms({
    f,
    idCompte,
  }: {
    f: Suivi<TraducsTexte | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    return await this.suivreBd({
      idCompte,
      clef: "noms",
      f: nulÀObjetVide(f),
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

  async sauvegarderNoms({ noms }: { noms: TraducsTexte }): Promise<void> {
    const bd = await this.bd();
    for (const [langue, nom] of Object.entries(noms)) {
      await bd.set(`noms/${langue}`, nom);
    }
  }

  async effacerNom({ langue }: { langue: string }): Promise<void> {
    const bd = await this.bd();
    await bd.del(`noms/${langue}`);
  }

  // Bio
  async sauvegarderBio({
    langue,
    bio,
  }: {
    langue: string;
    bio: string;
  }): Promise<void> {
    return await this.sauvegarderBios({ bios: { [langue]: bio } });
  }

  async sauvegarderBios({ bios }: { bios: TraducsTexte }): Promise<void> {
    const bd = await this.bd();
    for (const [langue, bio] of Object.entries(bios)) {
      await bd.set(`bios/${langue}`, bio);
    }
  }

  async effacerBio({ langue }: { langue: string }): Promise<void> {
    const bd = await this.bd();
    await bd.del(`bios/${langue}`);
  }

  @cacheSuivi
  async suivreBios({
    f,
    idCompte,
  }: {
    f: Suivi<TraducsTexte | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    return await this.suivreBd({
      idCompte,
      clef: "bios",
      f: nulÀObjetVide(f),
    });
  }

  // Image
  async sauvegarderImage({
    image,
  }: {
    image: { contenu: Uint8Array; nomFichier: string };
  }): Promise<void> {
    const maxTailleImage =
      this.service("compte").options.consts.maxTailleImageSauvegarder;

    if (image.contenu.byteLength > maxTailleImage) {
      throw new Error("Taille maximale excédée");
    }

    const idImage = await this.service("hélia").ajouterFichierÀSFIP(image);

    const bd = await this.bd();
    await bd.set("image", idImage);
  }

  async effacerImage(): Promise<void> {
    const bd = await this.bd();
    await bd.del("image");
  }

  @cacheSuivi
  async suivreImage({
    f,
    idCompte,
  }: {
    f: Suivi<{ image: Uint8Array; idImage: string } | null>;
    idCompte?: string;
  }): Promise<Oublier> {
    const maxTailleImage =
      this.service("compte").options.consts.maxTailleImageVisualiser;

    return await this.suivreBd({
      clef: "image",
      idCompte,
      f: async (idImage) => {
        if (!idImage) {
          return await f(null);
        } else {
          const image = await this.service("hélia").obtFichierDeSFIP({
            id: idImage,
            max: maxTailleImage,
          });
          return await f(image ? { image, idImage: idImage } : null);
        }
      },
    });
  }

  // Contacts

  async sauvegarderContact({
    type,
    contact,
  }: {
    type: string;
    contact: string;
  }): Promise<void> {
    const bd = await this.bd();
    await bd.put(`contacts/${uuidv4()}`, { type, contact });
  }

  async effacerContact({
    type,
    contact,
  }: {
    type: string;
    contact?: string;
  }): Promise<void> {
    const bd = await this.bd();
    const tous = mapÀObjet(await bd.get("contacts"));

    const àEffacer = Object.entries(tous || {}).filter(
      ([_id, { contact: c, type: t }]) =>
        t === type && (contact === undefined || c === contact),
    );
    await Promise.allSettled(
      àEffacer.map(async (c) => await bd.del(`contacts/${c[0]}`)),
    );
  }

  @cacheSuivi
  async suivreContacts({
    f,
    idCompte,
  }: {
    f: Suivi<{ type: string; contact: string }[] | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    return await this.suivreBd({
      clef: "contacts",
      idCompte,
      f: async (contacts) =>
        await f(
          contacts
            ? Object.values(contacts).map(({ contact, type }) => ({
                contact,
                type,
              }))
            : [],
        ),
    });
  }

  @cacheSuivi
  async suivreCourriel({
    f,
    idCompte,
  }: {
    f: Suivi<string | null | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    return await this.suivreContacts({
      idCompte,
      f: async (contacts) =>
        await f(
          contacts
            ? contacts.find((c) => c.type == "courriel")?.contact || null
            : undefined,
        ),
    });
  }

  async sauvegarderCourriel({ courriel }: { courriel: string }): Promise<void> {
    await this.sauvegarderContact({ type: "courriel", contact: courriel });
  }

  async effacerCourriel(): Promise<void> {
    await this.effacerContact({ type: "courriel" });
  }

  // Épingle

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisAvecIdBooléennisée<ÉpingleProfil>;
    f: Suivi<Set<string>>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");

    const info: {
      base?: string;
      image?: string;
    } = {};

    const fFinale = async () => {
      return await f(
        new Set([info.base, info.image].filter((x): x is string => !!x)),
      );
    };

    let oublier: Oublier | undefined = undefined;

    if (épingle.épingle.base) info.base = épingle.idObjet;
    if (épingle.épingle.fichiers) {
      oublier = await orbite.suivreDonnéesBd({
        id: épingle.idObjet,
        type: "nested",
        schéma: schémaProfil,
        f: async (profil) => {
          const idImage = profil.get("image");
          if (idcValide(idImage)) {
            info.image = idImage;
          }
        },
      });
    }

    await fFinale();

    return async () => {
      await oublier?.();
    };
  }
}
