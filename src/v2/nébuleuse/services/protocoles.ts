import { ServiceDonnéesAppli } from "./services.js";
import type { Oublier } from "../types.js";
import type { JSONSchemaType } from "ajv";
import type { PartielRécursif } from "@/v2/types.js";
import type { OptionsAppli } from "../appli/appli.js";
import type {
  ServicesNécessairesCompte,
  ServiceCompte,
} from "./compte/compte.js";
import type { ServiceDispositifs } from "./dispositifs.js";
import type { ServiceFavoris } from "./favoris.js";
import type { ServiceRéseau } from "./réseau.js";

export type StructureProtocole = {
  string: null;
};

export const schémaProtocole: JSONSchemaType<
  PartielRécursif<StructureProtocole>
> & {
  nullable: true;
} = {
  type: "object",
  additionalProperties: {
    type: "null",
    nullable: true,
  },
  nullable: true,
};

export type ServicesNécessairesProtocole = ServicesNécessairesCompte & {
  dispositifs: ServiceDispositifs;
  compte: ServiceCompte<{ protocole: StructureProtocole }>;
  favoris: ServiceFavoris;
  réseau: ServiceRéseau;
};

export class Protocole extends ServiceDonnéesAppli<
  "protocole",
  StructureProtocole,
  ServicesNécessairesProtocole
> {
  constructor({
    services,
    options,
  }: {
    services: ServicesNécessairesProtocole;
    options: OptionsAppli;
  }) {
    super({
      clef: "protocole",
      services,
      dépendances: [],
      options,
    });
  }

  async établirProtocoles({
    protocoles,
    idDispositif,
  }: {
    protocoles?: string[];
    idDispositif?: string;
  }): Promise<void> {
    idDispositif = idDispositif || (await this.client.obtIdDispositif());

    const { bd, fOublier } = await this.obtBd();

    const existants = (await bd.allAsJSON())[idDispositif] || [];
    if (protocoles) {
      if (
        protocoles.some((p) => !existants.includes(p)) ||
        existants.some((p) => !protocoles.includes(p))
      ) {
        await bd.put(idDispositif, protocoles);
      }
    } else if (existants.length) {
      await bd.del(idDispositif);
    }

    await fOublier();
  }

  @cacheSuivi
  async suivreProtocoles({
    f,
    idCompte,
  }: {
    f: Suivi<{ [idDispositif: string]: string[] }>;
    idCompte?: string;
  }): Promise<Oublier> {
    return await this.suivreBdPrincipale({
      idCompte,
      f,
    });
  }
}
