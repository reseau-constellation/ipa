import { isNode, isElectronMain } from "wherearewe";

import type { Constellation } from "@/client.js";
import type { schémaFonctionSuivi, schémaFonctionOublier } from "@/types.js";
import { cacheSuivi } from "@/décorateursCache.js";
import { ComposanteClientDic } from "./composanteClient.js";
import { JSONSchemaType } from "ajv";
import { AbortError } from "@libp2p/interface";

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

type structureBdFavoris = { [idObjet: string]: ÉlémentFavoris };
const schémaBdPrincipale: JSONSchemaType<structureBdFavoris> = {
  type: "object",
  additionalProperties: {
    type: "object",
    properties: {
      dispositifs: {
        anyOf: [
          {
            type: "array",
            items: { type: "string" },
          },
          { type: "string" },
        ],
      },
      dispositifsFichiers: {
        type: ["array", "string"],
        anyOf: [
          {
            type: "array",
            items: { type: "string" },
            nullable: true,
          },
          {
            type: "string",
            nullable: true,
          },
        ],
        nullable: true,
      },
      récursif: { type: "boolean" },
    },
    required: ["dispositifs", "récursif"],
  },
  required: [],
};

export class Favoris extends ComposanteClientDic<structureBdFavoris> {
  _promesseInit: Promise<void>;
  oublierÉpingler?: schémaFonctionOublier;

  constructor({ client }: { client: Constellation }) {
    super({ client, clef: "favoris", schémaBdPrincipale });

    this._promesseInit = this._épinglerFavoris();
  }

  async épingler() {
    await this.client.épingles.épinglerBd({
      id: await this.obtIdBd(),
      récursif: false,
      fichiers: false,
    });
  }

  async _épinglerFavoris() {
    let précédentes: string[] = [];
    
    const fFinale = async (favoris: { [clef: string]: ÉlémentFavoris }) => {
      const nouvelles: string[] = [];

      try {
        await Promise.all(
          Object.entries(favoris).map(async ([id, fav]) => {
            const épinglerBd = await this.estÉpingléSurDispositif({
              dispositifs: fav.dispositifs,
            });
            if (épinglerBd) {
              const épinglerFichiers = await this.estÉpingléSurDispositif({
                dispositifs: fav.dispositifsFichiers,
              });
              try {
                await this.client.épingles.épinglerBd({
                  id,
                  récursif: fav.récursif,
                  fichiers: épinglerFichiers,
                });
              } catch (e) {
                if (e.toString().includes("AbortError:") || (e instanceof AggregateError && e.errors.every(x=> x.toString().includes("AbortError:")))) {
                  console.error(e)
                } else {
                  throw e
                }
              }
            }
            nouvelles.push(id);
          }),
        );
      } catch (e) {
        console.error(e)
      }
      const àOublier = précédentes.filter((id) => !nouvelles.includes(id));

      await Promise.all(
        àOublier.map(
          async (id) => await this.client.épingles.désépinglerBd({ id }),
        ),
      );

      précédentes = nouvelles;
    };

    const fOublier = await this.suivreBdPrincipale({
      f: fFinale,
    });

    this.oublierÉpingler = fOublier;
  }

  @cacheSuivi
  async suivreFavoris({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<ÉlémentFavorisAvecObjet[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (favoris: { [key: string]: ÉlémentFavoris }) => {
      const favorisFinaux = Object.entries(favoris).map(
        ([idObjet, élément]) => {
          return {
            idObjet,
            ...élément,
          };
        },
      );
      await f(favorisFinaux);
    };

    return await this.suivreBdPrincipale({
      idCompte,
      f: fFinale,
    });
  }

  async épinglerFavori({
    idObjet,
    dispositifs = "TOUS",
    dispositifsFichiers = "INSTALLÉ",
    récursif = true,
  }: {
    idObjet: string;
    dispositifs?: typeDispositifs;
    dispositifsFichiers?: typeDispositifs | undefined;
    récursif?: boolean;
  }): Promise<void> {
    const { bd, fOublier } = await this.obtBd();

    const élément: ÉlémentFavoris = {
      récursif,
      dispositifs,
    };
    if (dispositifsFichiers) élément.dispositifsFichiers = dispositifsFichiers;
    await bd.put(idObjet, élément);

    await fOublier();
  }

  async désépinglerFavori({ idObjet }: { idObjet: string }): Promise<void> {
    const { bd, fOublier } = await this.obtBd();
    await bd.del(idObjet);
    await fOublier();
  }

  @cacheSuivi
  async suivreÉtatFavori({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<ÉlémentFavoris | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({
      f: (favoris) => f(favoris[idObjet]),
    });
  }

  @cacheSuivi
  async suivreEstÉpingléSurDispositif({
    idObjet,
    f,
    idDispositif,
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<épingleDispositif>;
    idDispositif?: string;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (élément?: ÉlémentFavoris): Promise<void> => {
      const bdEstÉpinglée = await this.estÉpingléSurDispositif({
        dispositifs: élément?.dispositifs,
        idDispositif,
      });
      const fichiersSontÉpinglés = await this.estÉpingléSurDispositif({
        dispositifs: élément?.dispositifsFichiers,
        idDispositif,
      });

      return await f({
        idObjet,
        bd: bdEstÉpinglée,
        fichiers: fichiersSontÉpinglés,
        récursif: élément?.récursif || false,
      });
    };
    return await this.suivreÉtatFavori({ idObjet, f: fFinale });
  }

  async estÉpingléSurDispositif({
    dispositifs,
    idDispositif,
  }: {
    dispositifs: ÉlémentFavoris["dispositifs"] | undefined;
    idDispositif?: string;
  }): Promise<boolean> {
    idDispositif = idDispositif || (await this.client.obtIdDispositif());
    if (dispositifs === undefined) {
      return false;
    } else if (dispositifs === "TOUS") {
      return true;
    } else if (dispositifs === "INSTALLÉ") {
      if (idDispositif === (await this.client.obtIdDispositif())) {
        return isNode || isElectronMain;
      } else {
        return false; // En réalité, inconnu. Mais on ne peut pas magiquement deviner la plateforme d'un autre paire.
      }
    } else if (typeof dispositifs === "string") {
      return dispositifs === idDispositif;
    } else {
      return dispositifs.includes(idDispositif);
    }
  }

  async fermer(): Promise<void> {
    await this._promesseInit;
    if (this.oublierÉpingler) await this.oublierÉpingler();
  }
}
