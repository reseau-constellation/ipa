import { v4 as uuidv4 } from "uuid";
import { WorkBook, utils, BookType } from "xlsx";

import {
  attendreStabilité,
  faisRien,
  suivreDeFonctionListe,
  traduire,
  uneFois,
} from "@constl/utils-ipa";
import { isValidAddress } from "@orbitdb/core";
import { JSONSchemaType } from "ajv";
import axios from "axios";
import Base64 from "crypto-js/enc-base64.js";
import md5 from "crypto-js/md5.js";
import { isElectronMain, isNode } from "wherearewe";
import { Constellation } from "@/client.js";
import {
  TraducsTexte,
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaStructureBdNoms,
  élémentsBd,
} from "@/types.js";

import { type donnéesBdExportées } from "@/bds.js";
import { cholqij } from "@/dates.js";
import { ServiceConstellation } from "./v2/nébuleuse/services.js";
import type {
  catégorieBaseVariables,
  catégorieVariables,
} from "@/variables.js";
import { cacheSuivi } from "@/décorateursCache.js";
import { cidEtFichierValide } from "@/epingles.js";
import { ContrôleurConstellation as générerContrôleurConstellation } from "@/accès/cntrlConstellation.js";

export function élémentsÉgaux(
  élément1: { [key: string]: élémentsBd },
  élément2: { [key: string]: élémentsBd },
): boolean {
  const clefs1 = Object.keys(élément1).filter((x) => x !== "id");
  const clefs2 = Object.keys(élément2).filter((x) => x !== "id");
  if (!clefs1.every((x) => élément1[x] === élément2[x])) return false;
  if (!clefs2.every((x) => élément1[x] === élément2[x])) return false;
  return true;
}

export class Tableaux extends ServiceConstellation {
  client: Constellation;

  constructor({ client }: { client: Constellation }) {
    super({ client, clef: "tableaux" });
    this.client = client;
  }

  async réordonnerColonneTableau({
    idTableau,
    idColonne,
    position,
  }: {
    idTableau: string;
    idColonne: string;
    position: number;
  }): Promise<void> {
    await this._confirmerPermission({ idTableau });
    const idBdColonnes = await this.client.obtIdBd({
      nom: "colonnes",
      racine: idTableau,
      type: "ordered-keyvalue",
    });

    const { bd: bdColonnes, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdColonnes,
      type: "ordered-keyvalue",
      schéma: schémaBdInfoCol,
    });

    const colonnesExistantes = await bdColonnes.all();
    const positionExistante = colonnesExistantes.findIndex(
      (c) => c.key === idColonne,
    );
    if (position !== positionExistante)
      await bdColonnes.move(idColonne, position);

    await fOublier();
  }

  async vérifierClefsÉlément<T extends élémentBdListeDonnées>({
    idTableau,
    élément,
  }: {
    idTableau: string;
    élément: élémentBdListeDonnées;
  }): Promise<T> {
    await this._confirmerPermission({ idTableau });
    const idBdColonnes = await this.client.obtIdBd({
      nom: "colonnes",
      racine: idTableau,
      type: "ordered-keyvalue",
    });

    const { bd: bdColonnes, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdColonnes,
      type: "ordered-keyvalue",
      schéma: schémaBdInfoCol,
    });
    const idsColonnes: string[] = (await bdColonnes.all()).map(
      (e) => e.value.id,
    );
    const clefsPermises = [...idsColonnes, "id"];
    const clefsFinales = Object.keys(élément).filter((x: string) =>
      clefsPermises.includes(x),
    );

    await fOublier();
    return Object.fromEntries(
      clefsFinales.map((x: string) => [x, élément[x]]),
    ) as T;
  }

  async convertirDonnées<T extends élémentBdListeDonnées[]>({
    idTableau,
    données,
    conversions = {},
    importerFichiers,
    cheminBaseFichiers,
    donnéesExistantes,
  }: {
    idTableau: string;
    données: T;
    conversions?: { [col: string]: conversionDonnées };
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
      val: élémentsBd;
      catégorie: catégorieBaseVariables;
      conversion: conversionDonnées;
    }): Promise<élémentsBd> => {
      switch (catégorie) {
        case "audio":
        case "image":
        case "vidéo":
        case "fichier": {
          if (typeof val === "string" && importerFichiers) {
            if (cidEtFichierValide(val)) return val;

            const infoFichier = await ajouterFichierÀSFIP({ chemin: val });
            return infoFichier || val;
          }
          return val;
        }

        case "booléen":
          return typeof val === "string" ? val.toLowerCase() === "true" : val;

        case "numérique": {
          let opération:
            | opérationConversionNumérique
            | opérationConversionNumérique[]
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
            ops?: opérationConversionNumérique[];
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
    const donnéesTableau = await uneFois(
      async (
        fSuivi: schémaFonctionSuivi<élémentDonnées<élémentBdListeDonnées>[]>,
      ) => {
        return await this.suivreDonnées({ idTableau, f: fSuivi });
      },
    );

    const donnéesConverties = await this.convertirDonnées({
      idTableau,
      données,
      conversions,
      importerFichiers: true,
      cheminBaseFichiers,
      donnéesExistantes: donnéesTableau.map((x) => x.données),
    });

    const nouveaux: élémentBdListeDonnées[] = [];
    for (const élément of donnéesConverties) {
      if (!donnéesTableau.some((x) => élémentsÉgaux(x.données, élément))) {
        nouveaux.push(élément);
      }
    }

    const àEffacer: string[] = [];
    for (const élément of donnéesTableau) {
      if (!donnéesConverties.some((x) => élémentsÉgaux(x, élément.données))) {
        àEffacer.push(élément.id);
      }
    }

    for (const id of àEffacer) {
      await this.effacerÉlément({ idTableau, idÉlément: id });
    }

    for (const n of nouveaux) {
      await this.ajouterÉlément({ idTableau, vals: n });
    }
  }
}
