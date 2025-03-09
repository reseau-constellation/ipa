import { JSONSchemaType } from "ajv";
import { Constellation } from "./client.js";
import { ComposanteClientDic } from "./composanteClient.js";
import { cacheSuivi } from "./décorateursCache.js";
import { schémaFonctionOublier, schémaFonctionSuivi } from "./types.js";

export type structureBdProtocoles = {
  [idDispositif: string]: string[];
};
export const schémaStructureBdProtocoles: JSONSchemaType<structureBdProtocoles> =
  {
    type: "object",
    additionalProperties: {
      type: "array",
      items: {
        type: "string",
      },
    },
    required: [],
  };

export class Protocoles extends ComposanteClientDic<structureBdProtocoles> {
  protocoles_init: string[];

  constructor({
    client,
    protocoles = [],
  }: {
    client: Constellation;
    protocoles?: string[];
  }) {
    super({
      client,
      clef: "protocoles",
      schémaBdPrincipale: schémaStructureBdProtocoles,
    });
    this.protocoles_init = protocoles;
  }

  async initialiser(): Promise<void> {
    await this.établirProtocoles({ protocoles: this.protocoles_init });
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
    f: schémaFonctionSuivi<{ [idDispositif: string]: string[] }>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({
      idCompte,
      f,
    });
  }
}
