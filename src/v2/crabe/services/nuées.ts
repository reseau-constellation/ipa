import { ajouterProtocoleOrbite } from "@/v2/utils.js";
import { Tableaux } from "@/v2/tableaux.js";
import { cacheSuivi } from "../cache.js";
import { ServiceDonnéesNébuleuse } from "./services.js";
import type { Suivi, Oublier } from "../types.js";
import type { ServicesLibp2pCrabe } from "./libp2p/libp2p.js";
import type { ServicesConstellation, Constellation } from "@/client.js";

export class Nuées<
  L extends ServicesLibp2pCrabe,
> extends ServiceDonnéesNébuleuse<
  "bds",
  StructureServiceNuées,
  L,
  ServicesConstellation<L>
> {
  tableaux: Tableaux<L>;

  constructor({ nébuleuse }: { nébuleuse: Constellation }) {
    super({
      clef: "bds",
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

  // Création et gestion

  @cacheSuivi
  async suivreNuées({
    f,
    idCompte,
  }: {
    f: Suivi<string[] | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    return await this.suivreBd({
      idCompte,
      f: (bds) => f(bds ? Object.keys(bds).map(ajouterProtocoleOrbite) : []),
    });
  }
}
