import { Constellation, ServicesConstellation } from "./constellation.js";
import { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import { ServiceDonnéesNébuleuse } from "./crabe/services/services.js";
import { Tableaux } from "./tableaux.js";
import { PartielRécursif } from "./types.js";
import type { JSONSchemaType } from "ajv";


export type StructureServiceNuées = {
    [motClef: string]: null;
  };
  
  export const SchémaServiceNuées: JSONSchemaType<
    PartielRécursif<StructureServiceNuées>
  > = {
    type: "object",
    additionalProperties: true,
    required: [],
  };

  
export class Nuées<L extends ServicesLibp2pCrabe> extends ServiceDonnéesNébuleuse<
  "nuées",
  StructureServiceNuées,
  L,
  ServicesConstellation<L>
> {
  tableaux: Tableaux<L>;

  constructor({ nébuleuse }: { nébuleuse: Constellation }) {
    super({
      clef: "nuées",
      nébuleuse,
      dépendances: ["compte", "orbite", "hélia"],
      options: {
        schéma: SchémaServiceNuées,
      },
    });
    this.tableaux = new Tableaux({
      service: (clef) => this.service(clef),
    });
  }

  async créerNuée({
    nuéeParent,
    autorisation = "IJPC",
    épingler = true,
  }: {
    nuéeParent?: string;
    autorisation?: string | "IJPC" | "CJPI";
    épingler?: boolean;
  } = {}): Promise<string> {
    const idNuée = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès: {
        address: undefined,
        write: await this.client.obtIdCompte(),
      },
    });
    await this.ajouterÀMesNuées({ idNuée });
    if (épingler) {
      await this.épinglerNuée({ idNuée });
    }

    const { bd: bdNuée, fOublier: fOublierNuée } =
      await this.client.ouvrirBdTypée({
        id: idNuée,
        type: "keyvalue",
        schéma: schémaStructureBdNuée,
      });

    const accès = bdNuée.access as ContrôleurConstellation;
    const optionsAccès = { write: accès.address };

    await bdNuée.set("type", "nuée");

    let autorisationFinale: string;
    if (isValidAddress(autorisation)) {
      autorisationFinale = autorisation;
    } else if (autorisation === "CJPI" || autorisation === "IJPC") {
      autorisationFinale = await this.générerGestionnaireAutorisations({
        philosophie: autorisation,
      });
    } else {
      throw new Error(`Autorisation non valide : ${autorisation}`);
    }
    await bdNuée.set("autorisation", autorisationFinale);
    if (autorisation === "CJPI") {
      await this.accepterMembreNuée({
        idNuée: idNuée,
        idCompte: await this.client.obtIdCompte(),
      });
    }

    const idBdNoms = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès,
    });
    await bdNuée.set("noms", idBdNoms);

    const idBdDescr = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès,
    });
    await bdNuée.set("descriptions", idBdDescr);

    const idBdTableaux = await this.client.créerBdIndépendante({
      type: "ordered-keyvalue",
      optionsAccès,
    });
    await bdNuée.set("tableaux", idBdTableaux);

    const idBdMétadonnées = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès,
    });
    await bdNuée.set("métadonnées", idBdMétadonnées);

    const idBdMotsClefs = await this.client.créerBdIndépendante({
      type: "set",
      optionsAccès,
    });
    await bdNuée.set("motsClefs", idBdMotsClefs);

    await bdNuée.set("statut", { statut: "active" });
    if (nuéeParent) {
      await bdNuée.set("parent", nuéeParent);
    }

    fOublierNuée();
    return idNuée;
  }
}