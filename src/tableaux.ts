import { uneFois } from "@constl/utils-ipa";
import { isValidAddress } from "@orbitdb/core";

import axios from "axios";
import { isElectronMain, isNode } from "wherearewe";
import { schémaStructureBdNoms, élémentsBd } from "@/types.js";

import { cholqij } from "@/dates.js";
import { ServiceConstellation } from "./v2/nébuleuse/services.js";
import { DonnéesRangéeTableau } from "./v2/bds/tableaux.js";
import { idcEtFichierValide } from "./v2/crabe/services/epingles.js";
import type {
  ConversionDonnées,
  OpérationConversionNumérique,
} from "./v2/bds/tableaux.js";
import type { CatégorieBaseVariables } from "./v2/variables.js";
import type { schémaFonctionSuivi } from "@/types.js";
import type { DagCborEncodable } from "@orbitdb/core";
import type { catégorieBaseVariables } from "@/variables.js";
import { cidEtFichierValide } from "@/epingles.js";

// Fichier ODS / URL -> JSON -> résoudre sfip -> formats traducs chaîne/dates/chiffres -> conversions */+- -> importer

const résoudreFichiers = async () => {};

export class Tableaux extends ServiceConstellation {
  async convertirDonnées<T extends DonnéesRangéeTableauÀImporter[]>({
    idTableau,
    données,
    conversions = {},
    importerFichiers,
    cheminBaseFichiers,
    donnéesExistantes,
  }: {
    idTableau: string;
    données: T;
    conversions?: { [col: string]: ConversionDonnées };
    importerFichiers: boolean;
    cheminBaseFichiers?: string;
    donnéesExistantes?: élémentBdListeDonnées[];
  }): Promise<T> {
    const colonnes = await uneFois(
      async (fSuivi: schémaFonctionSuivi<InfoColAvecCatégorie[]>) => {
        return await this.suivreColonnesEtCatégoriesTableau({
          idTableau,
          f: fSuivi,
        });
      },
    );

    const idsOrbiteColsChaîne: Set<string> = new Set(
      donnéesExistantes
        ?.map((d) => {
          return colonnes
            .filter((c) => c.catégorie?.catégorie === "chaîne")
            .map((c) => (c.catégorie?.type === "simple" ? [d[c.id]] : d[c.id]))
            .flat()
            .filter((x) => typeof x === "string") as string[];
        })
        .flat() || [],
    );

    const fichiersDéjàAjoutés: {
      [chemin: string]: string;
    } = {};

    const ajouterFichierÀSFIP = async ({
      chemin,
    }: {
      chemin: string;
    }): Promise<string | undefined> => {
      try {
        new URL(chemin);
        if (fichiersDéjàAjoutés[chemin]) return fichiersDéjàAjoutés[chemin];
        const contenuFichier = (await axios.get(chemin)).data;
        const composantesUrl = chemin.split("/");
        const nomFichier = composantesUrl.pop() || composantesUrl.pop();
        if (!nomFichier) throw new Error("Nom de fichier manquant.");
        const cid = await this.client.ajouterÀSFIP({
          nomFichier,
          contenu: contenuFichier,
        });
        fichiersDéjàAjoutés[chemin] = cid;
      } catch {
        // Rien à faire;
      }

      if (isNode || isElectronMain) {
        const fs = await import("fs");
        const path = await import("path");

        const cheminAbsolut = cheminBaseFichiers
          ? path.resolve(cheminBaseFichiers, chemin)
          : chemin;

        if (!fs.existsSync(cheminAbsolut)) return;
        if (fichiersDéjàAjoutés[cheminAbsolut])
          return fichiersDéjàAjoutés[cheminAbsolut];

        const contenuFichier = fs.readFileSync(cheminAbsolut);
        const cid = await this.client.ajouterÀSFIP({
          nomFichier: path.basename(cheminAbsolut),
          contenu: contenuFichier,
        });
        fichiersDéjàAjoutés[chemin] = cid;

        return cid;
      }
      return undefined;
    };

    const cacheRechercheIdOrbite: {
      [langue: string]: { [val: string]: string };
    } = {};
    const rechercherIdOrbiteChaîne = async ({
      val,
      langue,
    }: {
      val: string;
      langue: string;
    }): Promise<string | undefined> => {
      if (cacheRechercheIdOrbite[langue]?.[val])
        return cacheRechercheIdOrbite[langue][val];
      for (const id of idsOrbiteColsChaîne) {
        const { bd, fOublier } = await this.client.ouvrirBdTypée({
          id,
          type: "keyvalue",
          schéma: schémaStructureBdNoms,
        });
        const valLangue = await bd.get(langue);
        await fOublier();
        if (valLangue === val) {
          if (!cacheRechercheIdOrbite[langue])
            cacheRechercheIdOrbite[langue] = {};
          cacheRechercheIdOrbite[langue][val] = id;
          return id;
        }
      }
      return undefined;
    };

    const créerIdOrbiteChaîne = async ({
      val,
      langue,
    }: {
      val: string;
      langue: string;
    }): Promise<string> => {
      const { bd: bdNuée, fOublier: fOublierBdTableau } =
        await this.client.ouvrirBdTypée({
          id: idTableau,
          type: "keyvalue",
          schéma: schémaStructureBdNoms,
        });

      const accès = bdNuée.access as ContrôleurConstellation;
      const optionsAccès = { write: accès.address };
      await fOublierBdTableau();
      const idOrbite = await this.client.créerBdIndépendante({
        type: "keyvalue",
        optionsAccès,
      });

      const { bd, fOublier } = await this.client.ouvrirBdTypée({
        id: idOrbite,
        type: "keyvalue",
        schéma: schémaStructureBdNoms,
      });
      await bd.set(langue, val);
      await fOublier();
      idsOrbiteColsChaîne.add(idOrbite);
      return idOrbite;
    };

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
        case "audio":
        case "image":
        case "vidéo":
        case "fichier": {
          if (typeof val === "string" && importerFichiers) {
            if (idcEtFichierValide(val)) return val;

            const infoFichier = await ajouterFichierÀSFIP({ chemin: val });
            return infoFichier || val;
          }
          return val;
        }

        case "booléen":
          return typeof val === "string" ? val.toLowerCase() === "true" : val;

        case "numérique": {
          let opération:
            | OpérationConversionNumérique
            | OpérationConversionNumérique[]
            | undefined = undefined;

          let systèmeNumération: string | undefined = undefined;
          if (conversion?.type === "numérique") {
            ({ opération, systèmeNumération } = conversion);
          }
          const convertirValNumérique = ({
            val,
            ops,
          }: {
            val: number;
            ops?: OpérationConversionNumérique[];
          }): number => {
            if (!ops) return val;

            let valFinale = val;
            for (const op of ops) {
              switch (op.op) {
                case "+":
                  valFinale = val + op.val;
                  break;
                case "-":
                  valFinale = val - op.val;
                  break;
                case "*":
                  valFinale = val * op.val;
                  break;
                case "/":
                  valFinale = val / op.val;
                  break;
                case "^":
                  valFinale = val ** op.val;
                  break;
                default:
                  throw new Error(op.op);
              }
            }
            return valFinale;
          };

          let valNumérique: number | undefined = undefined;
          if (typeof val === "string") {
            try {
              valNumérique = this.client.ennikkai.எண்ணுக்கு({
                உரை: val,
                மொழி: systèmeNumération,
              });
            } catch {
              // Rien à faire...
            }
          } else if (typeof val === "number") {
            valNumérique = val;
          }

          return valNumérique !== undefined
            ? convertirValNumérique({
                val: valNumérique,
                ops:
                  Array.isArray(opération) || typeof opération === "undefined"
                    ? opération
                    : [opération],
              })
            : val;
        }

        case "horoDatage": {
          if (conversion?.type === "horoDatage" && typeof val === "string") {
            const { système, format } = conversion;
            const date = cholqij.lireDate({ système, val, format });
            return {
              système: "dateJS",
              val: date.valueOf(),
            };
          } else {
            if (["number", "string"].includes(typeof val)) {
              const date = new Date(val as string | number);
              return isNaN(date.valueOf())
                ? val
                : {
                    système: "dateJS",
                    val: date.valueOf(),
                  };
            }
            return val;
          }
        }
        case "intervaleTemps": {
          const valObjet = typeof val === "string" ? JSON.parse(val) : val;
          if (Array.isArray(valObjet)) {
            return await Promise.all(
              valObjet.map(
                async (v) =>
                  await convertir({
                    val: v,
                    catégorie: "horoDatage",
                    conversion,
                  }),
              ),
            );
          }
          return valObjet;
        }

        case "chaîneNonTraductible":
          return val;

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

        case "géojson":
          return typeof val === "string" ? JSON.parse(val) : val;
        default:
          return val;
      }
    };

    for (const élément of données) {
      for (const c of colonnes) {
        if (c.catégorie) {
          const { type, catégorie } = c.catégorie;
          const val = élément[c.id];
          if (val === undefined) continue;

          const conversion = conversions[c.id];

          if (type === "simple") {
            élément[c.id] = await convertir({ val, catégorie, conversion });
          } else {
            const valListe = typeof val === "string" ? JSON.parse(val) : val;
            élément[c.id] = Array.isArray(valListe)
              ? await Promise.all(
                  valListe.map(
                    async (v) =>
                      await convertir({ val: v, catégorie, conversion }),
                  ),
                )
              : [await convertir({ val: valListe, catégorie, conversion })];
          }
        }
      }
    }
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
