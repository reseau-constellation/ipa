import { isNode, isElectron } from "wherearewe";

import type { default as ClientConstellation } from "@/client.js";
import type {
  schémaFonctionSuivi,
  schémaFonctionOublier,
} from "@/utils/index.js";
import { cacheSuivi } from "@/décorateursCache.js";
import { ComposanteClientDic } from "./composanteClient.js";
import { JSONSchemaType } from "ajv";

export type typeDispositifs = string | string[] | "TOUS" | "INSTALLÉ";

export interface épingleDispositif {
  idObjet: string;
  bd: boolean;
  fichiers: boolean;
  récursif: boolean;
}

export type ÉlémentFavoris = {
  récursif: boolean;
  dispositifs: typeDispositifs;
  dispositifsFichiers?: typeDispositifs;
};

export type ÉlémentFavorisAvecObjet = ÉlémentFavoris & { idObjet: string };

type structureBdFavoris = { [idObjet: string]: ÉlémentFavoris }
const schémaBdPrincipale: JSONSchemaType<structureBdFavoris> = {
  type: "object",
  additionalProperties: {
    type: "object",
    properties: {
      dispositifs: {
        anyOf: [
          {
            type: "array",
            items: {type: "string"}
          },
          {type: "string"}
        ]
      },
      dispositifsFichiers: {
        type: ["array", "string"],
        anyOf: [
          {
            type: "array",
            items: {type: "string"}
          },
          {type: "string"}
        ],
        nullable: true
      },
      récursif: {type: "boolean"}
    },
    required: ["dispositifs", "récursif"]
  },
  required: [],
}

export default class Favoris extends ComposanteClientDic<structureBdFavoris> {
  _promesseInit: Promise<void>;
  oublierÉpingler?: schémaFonctionOublier;

  constructor({ client }: { client: ClientConstellation }) {
    super({client, clef: "favoris", schémaBdPrincipale})

    this._promesseInit = this._épinglerFavoris();
  }

  async épingler() {
    await this.client.épingles?.épinglerBd({
      id: await this.obtIdBd(),
      récursif: false,
      fichiers: false,
    });
  }

  async _épinglerFavoris() {
    let précédentes: string[] = [];

    const fFinale = async (favoris: {
      [clef: string]: ÉlémentFavoris;
    }) => {
      const nouvelles: string[] = [];

      await Promise.all(
        Object.entries(favoris).map(async ([id, fav]) => {
          const épinglerBd = await this.estÉpingléSurDispositif({
            dispositifs: fav.dispositifs,
          });
          const épinglerFichiers = await this.estÉpingléSurDispositif({
            dispositifs: fav.dispositifsFichiers,
          });
          if (épinglerBd)
            await this.client.épingles!.épinglerBd({
              id,
              récursif: fav.récursif,
              fichiers: épinglerFichiers,
            });
          nouvelles.push(id);
        })
      );

      const àOublier = précédentes.filter((id) => !nouvelles.includes(id));

      await Promise.all(
        àOublier.map(
          async (id) => await this.client.épingles!.désépinglerBd({ id })
        )
      );

      précédentes = nouvelles;
    };

    const fOublier = await this.suivreBdPrincipale({
      f: fFinale
    })

    this.oublierÉpingler = fOublier;
  }

  @cacheSuivi
  async suivreFavoris({
    f,
    idBdFavoris,
  }: {
    f: schémaFonctionSuivi<ÉlémentFavorisAvecObjet[]>;
    idBdFavoris?: string;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (favoris: { [key: string]: ÉlémentFavoris }) => {
      const favorisFinaux = Object.entries(favoris).map(
        ([idObjet, élément]) => {
          return {
            idObjet,
            ...élément,
          };
        }
      );
      await f(favorisFinaux);
    };

    return await this.suivreBdPrincipale({
      idBd: idBdFavoris,
      f: fFinale,
    })
  }

  async épinglerFavori({
    id,
    dispositifs,
    dispositifsFichiers = "INSTALLÉ",
    récursif = true,
  }: {
    id: string;
    dispositifs: typeDispositifs;
    dispositifsFichiers?: typeDispositifs | undefined;
    récursif?: boolean;
  }): Promise<void> {
    const { bd, fOublier } = await this.obtBd();

    const élément: ÉlémentFavoris = {
      récursif,
      dispositifs,
    };
    if (dispositifsFichiers) élément.dispositifsFichiers = dispositifsFichiers;
    await bd.put(id, élément);

    await fOublier();
  }

  async désépinglerFavori({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.obtBd();
    await bd.del(id);
    await fOublier();
  }

  @cacheSuivi
  async suivreÉtatFavori({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<ÉlémentFavoris | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({
      f: (favoris) => f(favoris[id]),
    })
  }

  @cacheSuivi
  async suivreEstÉpingléSurDispositif({
    idObjet,
    f,
    idOrbite,
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<épingleDispositif>;
    idOrbite?: string;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (élément?: ÉlémentFavoris): Promise<void> => {
      const bdEstÉpinglée = await this.estÉpingléSurDispositif({
        dispositifs: élément?.dispositifs,
        idOrbite,
      });
      const fichiersSontÉpinglés = await this.estÉpingléSurDispositif({
        dispositifs: élément?.dispositifsFichiers,
        idOrbite,
      });

      f({
        idObjet,
        bd: bdEstÉpinglée,
        fichiers: fichiersSontÉpinglés,
        récursif: élément?.récursif || false,
      });
    };
    return await this.suivreÉtatFavori({ id: idObjet, f: fFinale });
  }

  async estÉpingléSurDispositif({
    dispositifs,
    idOrbite,
  }: {
    dispositifs: ÉlémentFavoris["dispositifs"] | undefined;
    idOrbite?: string;
  }): Promise<boolean> {
    idOrbite = idOrbite || (await this.client.obtIdOrbite());
    if (dispositifs === undefined) {
      return false;
    } else if (dispositifs === "TOUS") {
      return true;
    } else if (dispositifs === "INSTALLÉ") {
      if (idOrbite === (await this.client.obtIdOrbite())) {
        return isNode || isElectron;
      } else {
        return false; // En réalité, inconnu. Mais on ne peut pas magiquement deviner la plateforme d'un autre paire.
      }
    } else if (typeof dispositifs === "string") {
      return dispositifs === idOrbite;
    } else {
      return dispositifs.includes(idOrbite);
    }
  }

  async fermer(): Promise<void> {
    await this._promesseInit;
    if (this.oublierÉpingler) await this.oublierÉpingler();
  }
}
