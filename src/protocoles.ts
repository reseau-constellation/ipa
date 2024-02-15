import { JSONSchemaType } from "ajv";
import { ComposanteClientDic } from "./composanteClient.js";
import { ClientConstellation } from "./client.js";
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
  constructor({ client }: { client: ClientConstellation }) {
    super({
      client,
      clef: "protocoles",
      schémaBdPrincipale: schémaStructureBdProtocoles,
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
    f: schémaFonctionSuivi<{ [idDispositif: string]: string[] }>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({
      idCompte,
      f,
    });
  }
}
