import { v4 as uuidv4 } from "uuid";
import {
  idcValide,
  ignorerNonDéfinis,
  suivreDeFonctionListe,
} from "@constl/utils-ipa";
import { RechercheProfils } from "@/v2/recherche/profils.js";
import {
  AUCUN_DISPOSITIF,
  TOUS_DISPOSITIFS,
  résoudreDéfauts,
} from "@/v2/nébuleuse/services/favoris.js";
import { ajouterPréfixes, définis, enleverPréfixes } from "@/v2/utils.js";
import { cacheSuivi } from "../cache.js";
import { ServiceDonnéesAppli } from "./services.js";
import type { ServiceRéseau } from "./réseau.js";
import type { AccesseurService } from "@/v2/recherche/types.js";
import type { ServicesNécessairesRechercheProfils } from "@/v2/recherche/fonctions/profils.js";
import type {
  BaseÉpingleFavoris,
  DispositifsÉpingle,
  ÉpingleFavorisBooléenniséeAvecId,
  ÉpingleFavorisAvecId,
  ServiceFavoris,
} from "@/v2/nébuleuse/services/favoris.js";
import type { JSONSchemaType } from "ajv";
import type { OptionsAppli } from "@/v2/nébuleuse/appli/appli.js";
import type { Suivi, Oublier } from "../types.js";
import type { PartielRécursif, TraducsTexte } from "../../types.js";
import type {
  ServiceCompte,
  ServicesNécessairesCompte,
} from "./compte/compte.js";
import type { ServiceDispositifs } from "./dispositifs.js";

// Types épingle

export type ÉpingleProfil = {
  type: "profil";
  épingle: ContenuÉpingleProfil;
};

export type ContenuÉpingleProfil = BaseÉpingleFavoris & {
  favoris: DispositifsÉpingle;
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

export type ServicesNécessairesProfil = ServicesNécessairesCompte & {
  dispositifs: ServiceDispositifs;
  compte: ServiceCompte<{ profil: StructureProfil }>;
  favoris: ServiceFavoris;
  réseau: ServiceRéseau;
};

export class Profil extends ServiceDonnéesAppli<
  "profil",
  StructureProfil,
  ServicesNécessairesProfil
> {
  recherche: RechercheProfils;

  constructor({
    services,
    options,
  }: {
    services: ServicesNécessairesProfil;
    options: OptionsAppli;
  }) {
    super({
      clef: "profil",
      services,
      dépendances: ["favoris", "dispositifs", "orbite", "hélia"],
      options,
    });

    this.recherche = new RechercheProfils({
      service: ((clef) =>
        clef === "profil"
          ? this
          : this.service(
              clef,
            )) as AccesseurService<ServicesNécessairesRechercheProfils>,
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
    f: Suivi<TraducsTexte>;
    idCompte?: string;
  }): Promise<Oublier> {
    return await this.suivreBd({
      idCompte,
      clef: "noms",
      f: (noms) => f(définis(noms || {})),
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
    await bd.insert(`noms`, noms);
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
    f: Suivi<TraducsTexte>;
    idCompte?: string;
  }): Promise<Oublier> {
    return await this.suivreBd({
      idCompte,
      clef: "bios",
      f: (bios) => f(définis(bios || {})),
    });
  }

  // Image
  async sauvegarderImage({
    image,
  }: {
    image: { contenu: Uint8Array; nomFichier: string };
  }): Promise<string> {
    const compte = this.service("compte");

    const { sauvegarder: maxTailleImage } = await compte.maxTailleImages();

    if (image.contenu.byteLength > maxTailleImage) {
      throw new Error("Taille maximale excédée");
    }

    const idImage = await this.service("hélia").ajouterFichierÀSFIP(image);

    const bd = await this.bd();
    await bd.set("image", idImage);

    return idImage;
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
    const { visualiser: maxTailleImage } = await this.service("compte").maxTailleImages();

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
    const tous = await bd.get("contacts");

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

  async épingler({
    idCompte,
    options = {},
  }: {
    idCompte: string;
    options?: PartielRécursif<ContenuÉpingleProfil>;
  }) {
    const favoris = this.service("favoris");

    const épingle: ContenuÉpingleProfil = résoudreDéfauts(options, {
      base: TOUS_DISPOSITIFS,
      favoris: AUCUN_DISPOSITIF,
    });

    await favoris.épinglerFavori({
      idObjet: idCompte,
      épingle: { type: "profil", épingle },
    });
  }

  async désépingler({ idCompte }: { idCompte: string }): Promise<void> {
    const favoris = this.service("favoris");

    await favoris.désépinglerFavori({
      idObjet: ajouterPréfixes(idCompte, "/appli/compte"),
    });
  }

  async suivreÉpingle({
    idCompte,
    f,
    idCompteQuiÉpingle,
  }: {
    idCompte: string;
    f: Suivi<ÉpingleProfil | undefined>;
    idCompteQuiÉpingle?: string;
  }): Promise<Oublier> {
    const favoris = this.service("favoris");
    return await favoris.suivreFavoris({
      idCompte: idCompteQuiÉpingle,
      f: async (épingles) => {
        const épingleBd = épingles?.find(({ idObjet, épingle }) => {
          return idObjet === enleverPréfixes(idCompte) &&
            épingle.type === "profil"
            ? épingle
            : undefined;
        }) as ÉpingleProfil | undefined;
        await f(épingleBd);
      },
    });
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisBooléenniséeAvecId<ÉpingleProfil>;
    f: Suivi<Set<string>>;
  }): Promise<Oublier> {
    const info: {
      base?: (string | undefined)[];
      favoris?: (string | undefined)[];
    } = {};

    const fFinale = async () => {
      return await f(
        new Set(
          Object.values(info)
            .flat()
            .filter((x): x is string => !!x),
        ),
      );
    };

    const fsOublier: Oublier[] = [];

    if (épingle.épingle.épingle.base) {
      const oublierBase = await this.suivreBd({
        idCompte: épingle.idObjet,
        f: async (profil) => {
          const idImage = profil?.image;
          info.base = idcValide(idImage)
            ? [épingle.idObjet, idImage]
            : [épingle.idObjet];
          await fFinale();
        },
      });
      fsOublier.push(oublierBase);
    }

    if (épingle.épingle.épingle.favoris) {
      const serviceFavoris = this.service("favoris");
      const oublierFavoris = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: Suivi<ÉpingleFavorisAvecId[]>;
        }) =>
          await serviceFavoris.suivreFavoris({
            idCompte: épingle.idObjet,
            f: ignorerNonDéfinis(fSuivreRacine),
          }),
        fBranche: async ({
          fSuivreBranche,
          branche: épingle,
        }: {
          fSuivreBranche: Suivi<Set<string>>;
          branche: ÉpingleFavorisAvecId;
        }) => {
          return await serviceFavoris.suivreRésolutionÉpingle({
            épingle,
            f: fSuivreBranche,
          });
        },
        fIdDeBranche: (épingle) => épingle.idObjet,
        f: async (épinglées: Set<string>[]) => {
          info.favoris = épinglées.map((ensemble) => [...ensemble]).flat();
          await fFinale();
        },
      });
      fsOublier.push(oublierFavoris);
    }

    await fFinale();

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
  }
}

export const serviceProfil =
  () =>
  ({
    options,
    services,
  }: {
    options: OptionsAppli;
    services: ServicesNécessairesProfil;
  }) =>
    new Profil({ options, services });
