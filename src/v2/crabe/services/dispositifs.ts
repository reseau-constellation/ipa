import { JSONSchemaType } from "ajv";
import { isBrowser, isElectronMain, isNode } from "wherearewe";
import plateforme from "platform";
import { Nébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import { PartielRécursif } from "@/v2/types.js";
import { cacheSuivi } from "@/décorateursCache.js";
import { Suivi } from "../types.js";
import { ServiceDonnéesNébuleuse } from "./services.js";
import { ServicesNécessairesCompte } from "./compte/compte.js";
import { ServicesLibp2pCrabe } from "./libp2p/libp2p.js";

export type StructureDispositifs = {
  dispositifs: {
    [idDispositif: string]: { nom?: string; type?: string };
  };
};
export const schémaDispositifs: JSONSchemaType<
  PartielRécursif<StructureDispositifs>
> = {
  type: "object",
  properties: {
    dispositifs: {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: {
          nom: { type: "string", nullable: true },
          type: { type: "string", nullable: true },
        },
      },
      nullable: true,
      required: [],
    },
  },
  required: [],
};

export type ServicesNécessairesDispositifs<
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> = ServicesNécessairesCompte<L> & {
  dispositifs: ServiceDispositifs<L>;
};

export class ServiceDispositifs<
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> extends ServiceDonnéesNébuleuse<"dispositifs", StructureDispositifs, L> {
  constructor({
    nébuleuse,
  }: {
    nébuleuse: Nébuleuse<ServicesNécessairesDispositifs<L>>;
  }) {
    super({
      clef: "dispositifs",
      nébuleuse,
      dépendances: ["compte"],
      options: {
        schéma: schémaDispositifs,
      },
    });
  }

  // Actions dispositifs

  async sauvegarderNomDispositif({
    idDispositif,
    nom,
  }: {
    idDispositif?: string;
    nom: string;
  }) {
    idDispositif =
      idDispositif ?? (await this.service("compte").obtIdDispositif());
    const bd = await this.bd();
    await bd.set(`dispositifs/${idDispositif}/nom`, nom);
  }

  async sauvegarderTypeDispositif({
    idDispositif,
    type,
  }: {
    idDispositif?: string;
    type?: string;
  } = {}) {
    const ceDispositif = await this.service("compte").obtIdDispositif();
    idDispositif = idDispositif ?? ceDispositif;

    // Si il s'agit de ce dispositif-ci, on peut deviner le type de dispositif
    if (idDispositif === ceDispositif) type = type ?? détecterTypeDispositif();

    const bd = await this.bd();
    await bd.set(`dispositifs/${idDispositif}/type`, type);
  }

  @cacheSuivi
  async suivreInfoDispositif({
    f,
    idDispositif,
    idCompte,
  }: {
    f: Suivi<{ nom?: string; type?: string } | undefined>;
    idDispositif?: string;
    idCompte?: string;
  }) {
    idDispositif =
      idDispositif ?? (await this.service("compte").obtIdDispositif());

    return await this.suivreBd({
      f: (x) => f(x?.dispositifs?.[idDispositif]),
      idCompte,
    });
  }
}

export const détecterTypeDispositif = (): string | undefined => {
  if (isElectronMain) {
    return "ordinateur";
  } else if (isNode) {
    return "serveur";
  } else if (isBrowser) {
    if (
      ["Pad", "Kindle", "Nexus", "Nook", "PlayBook"].find((x) =>
        plateforme.product?.includes(x),
      )
    ) {
      return "tablette";
    } else if (
      plateforme.name?.includes("Mobile") ||
      ["Phone", "Android", "iOS"].find((x) =>
        plateforme.os?.family?.includes(x),
      )
    ) {
      return "téléphone";
    }
    return "navigateur";
  }
  return undefined;
};
