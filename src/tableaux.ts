import { isValidAddress } from "@orbitdb/core";


import { cholqij } from "@/dates.js";
import { ServiceConstellation } from "./v2/nébuleuse/services.js";
import type {
  ConversionDonnées,
} from "./v2/bds/tableaux.js";
import type { CatégorieBaseVariables } from "./v2/variables.js";
import type { DagCborEncodable } from "@orbitdb/core";

// Fichier ODS / URL -> JSON -> résoudre sfip -> formats traducs chaîne/dates/chiffres -> conversions */+- -> importer

const résoudreFichiers = async () => {};

export class Tableaux extends ServiceConstellation {
  async convertirDonnées<T extends DonnéesRangéeTableauÀImporter[]>({
    idTableau,
    données,
    conversions = {},
    cheminBaseFichiers,
    donnéesExistantes,
  }: {
    idTableau: string;
    données: T;
    conversions?: { [col: string]: ConversionDonnées };
    cheminBaseFichiers?: string;
    donnéesExistantes?: élémentBdListeDonnées[];
  }): Promise<T> {
    const convertir = async ({
      val,
      catégorie,
      conversion,
    }: {
      val: DagCborEncodable;
      catégorie: CatégorieBaseVariables;
      conversion: ConversionDonnées;
    }): Promise<DagCborEncodable> => {

      switch (catégorie) {
        case "chaîne": {
          if (typeof val !== "string") return val;
          if (isValidAddress(val)) return val;
          else {
            if (conversion?.type === "chaîne") {
              const { langue } = conversion;
              const idOrbiteExistante = await rechercherIdOrbiteChaîne({
                val,
                langue,
              });
              return (
                idOrbiteExistante ||
                (await créerIdOrbiteChaîne({ val, langue }))
              );
            }
            return val;
          }
        }
      }
    };

    return données;
  }

  async importerDonnées({
    idTableau,
    données,
    conversions = {},
    cheminBaseFichiers,
  }: {
    idTableau: string;
    données: élémentBdListeDonnées[];
    conversions?: { [col: string]: conversionDonnées };
    cheminBaseFichiers?: string;
  }): Promise<void> {
    const donnéesConverties = await this.convertirDonnées({
      idTableau,
      données,
      conversions,
      importerFichiers: true,
      cheminBaseFichiers,
      donnéesExistantes: donnéesTableau.map((x) => x.données),
    });
  }
}
