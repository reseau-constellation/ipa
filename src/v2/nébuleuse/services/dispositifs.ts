import { isBrowser, isElectronMain, isNode } from "wherearewe";
import plateforme from "platform";
import { cacheSuivi } from "../cache.js";
import { ServiceDonnéesAppli } from "./services.js";
import type { ServicesNécessairesDonnées } from "./services.js";
import type { JSONSchemaType } from "ajv";
import type { OptionsCommunes } from "@/v2/nébuleuse/appli/appli.js";
import type { PartielRécursif } from "@/v2/types.js";
import type { Suivi } from "../types.js";
import type { ServicesLibp2pNébuleuse } from "./libp2p/libp2p.js";

export type StructureDispositifs = {
  dispositifs: {
    [idDispositif: string]: { nom?: string; type?: string };
  };
};
export const schémaDispositifs: JSONSchemaType<
  PartielRécursif<StructureDispositifs>
> & { nullable: true } = {
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
  nullable: true,
};

export type ServicesNécessairesDispositifs = ServicesNécessairesDonnées<{
  dispositifs: StructureDispositifs;
}>;

export class ServiceDispositifs extends ServiceDonnéesAppli<
  "dispositifs",
  StructureDispositifs
> {
  constructor({
    services,
    options,
  }: {
    services: ServicesNécessairesDispositifs;
    options: OptionsCommunes;
  }) {
    super({
      clef: "dispositifs",
      services,
      dépendances: ["compte"],
      options: Object.assign(
        {},
        {
          schéma: schémaDispositifs,
        },
        options,
      ),
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
