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
  TraducsNom,
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaStructureBdNoms,
  élémentsBd,
} from "@/types.js";

import { ContrôleurConstellation as générerContrôleurConstellation } from "@/accès/cntrlConstellation.js";
import { type donnéesBdExportées } from "@/bds.js";
import { cholqij } from "@/dates.js";
import { cacheSuivi } from "@/décorateursCache.js";
import {
  détailsRègleBornesDynamiqueColonne,
  détailsRègleBornesDynamiqueVariable,
  détailsRègleValeurCatégoriqueDynamique,
  erreurRègle,
  erreurRègleBornesColonneInexistante,
  erreurRègleBornesVariableNonPrésente,
  erreurRègleCatégoriqueColonneInexistante,
  erreurValidation,
  générerFonctionRègle,
  règleBornes,
  règleColonne,
  règleValeurCatégorique,
  règleVariable,
  règleVariableAvecId,
  schémaFonctionValidation,
} from "@/valid.js";
import { cidEtFichierValide } from "@/epingles.js";
import { ServiceConstellation } from "./services.js";
import type {
  catégorieBaseVariables,
  catégorieVariables,
} from "@/variables.js";

type ContrôleurConstellation = Awaited<
  ReturnType<ReturnType<typeof générerContrôleurConstellation>>
>;

export interface élémentDonnées<
  T extends élémentBdListeDonnées = élémentBdListeDonnées,
> {
  données: T;
  id: string;
}

export type élémentBdListeDonnées = {
  [key: string]: élémentsBd;
};

export type donnéesTableauExportation = {
  nomTableau: string;
  données: élémentBdListeDonnées[];
  fichiersSFIP: Set<string>;
};

export type InfoCol = {
  id: string;
  variable?: string;
  index?: boolean;
};
export type InfoColAvecVariable = InfoCol & { variable: string };

export type InfoColAvecCatégorie = InfoColAvecVariable & {
  catégorie?: catégorieVariables;
};

export type conversionDonnées =
  | conversionDonnéesNumérique
  | conversionDonnéesDate
  | conversionDonnéesChaîne;

export type conversionDonnéesNumérique = {
  type: "numérique";
  opération?: opérationConversionNumérique | opérationConversionNumérique[];
  systèmeNumération?: string;
};
export type opérationConversionNumérique = {
  op: "+" | "-" | "/" | "*" | "^";
  val: number;
};
export type conversionDonnéesDate = {
  type: "horoDatage";
  système: string;
  format: string;
};
export type conversionDonnéesChaîne = {
  type: "chaîne";
  langue: string;
};

const schémaBdInfoCol: JSONSchemaType<{
  [id: string]: InfoCol;
}> = {
  type: "object",
  additionalProperties: {
    type: "object",
    properties: {
      id: { type: "string" },
      variable: {
        type: "string",
        nullable: true,
      },
      index: {
        type: "boolean",
        nullable: true,
      },
    },
    required: ["id"],
  },
  required: [],
};

const schémaBdDonnéesTableau: JSONSchemaType<{
  [id: string]: { [clef: string]: élémentsBd };
}> = {
  type: "object",
  additionalProperties: {
    type: "object",
    additionalProperties: true,
    required: [],
  },
  required: [],
};

export const schémaBdRègles: JSONSchemaType<{
  [idRègle: string]: règleColonne;
}> = {
  type: "object",
  additionalProperties: {
    type: "object",
    properties: {
      colonne: { type: "string" },
      source: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string" },
        },
        required: ["id", "type"],
      },
      règle: {
        type: "object",
        properties: {
          id: { type: "string" },
          règle: {
            type: "object",
            properties: {
              détails: {
                type: "object",
                required: [],
              },
              typeRègle: { type: "string" },
            },
            required: ["détails", "typeRègle"],
          },
        },
        required: ["id", "règle"],
      },
    },
    required: ["colonne", "règle", "source"],
  },
  required: [],
};

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

export function indexÉlémentsÉgaux(
  élément1: { [key: string]: élémentsBd },
  élément2: { [key: string]: élémentsBd },
  index: string[],
): boolean {
  if (!index.every((x) => élément1[x] === élément2[x])) return false;
  return true;
}

export type différenceTableaux =
  | différenceVariableColonne
  | différenceIndexColonne
  | différenceColonneManquante
  | différenceColonneSupplémentaire;

export type différenceVariableColonne = {
  type: "variableColonne";
  sévère: true;
  idCol: string;
  varColTableau?: string;
  varColTableauLiée?: string;
};
export type différenceIndexColonne = {
  type: "indexColonne";
  sévère: true;
  idCol: string;
  colTableauIndexée: boolean;
};
export type différenceColonneManquante = {
  type: "colonneManquante";
  sévère: true;
  idManquante: string;
};
export type différenceColonneSupplémentaire = {
  type: "colonneSupplémentaire";
  sévère: false;
  idExtra: string;
};

export type structureBdTableau = {
  type: "tableau";
  noms: string;
  données: string;
  colonnes: string;
  règles: string;
};
const schémaStructureBdTableau: JSONSchemaType<structureBdTableau> = {
  type: "object",
  properties: {
    type: { type: "string" },
    noms: { type: "string" },
    données: { type: "string" },
    colonnes: { type: "string" },
    règles: { type: "string" },
  },
  required: ["données", "colonnes", "noms", "règles", "type"],
};

export class Tableaux extends ServiceConstellation {
  client: Constellation;

  constructor({ client }: { client: Constellation }) {
    // @ts-ignore
    super({ client, clef: "tableaux" });
    this.client = client;
  }

  async créerTableau({ idBd }: { idBd: string }): Promise<string> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd });

    const idBdTableau = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès,
    });
    const { bd: bdTableau, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdTableau,
      type: "keyvalue",
      schéma: schémaStructureBdTableau,
    });

    const établirType = async () => bdTableau.set("type", "tableau");

    const établirNoms = async () => {
      const idBdNoms = await this.client.créerBdIndépendante({
        type: "keyvalue",
        optionsAccès,
      });
      await bdTableau.set("noms", idBdNoms);
    };

    const établirDonnées = async () => {
      const idBdDonnées = await this.client.créerBdIndépendante({
        type: "keyvalue",
        optionsAccès,
      });
      await bdTableau.set("données", idBdDonnées);
    };

    const établirColonnes = async () => {
      const idBdColonnes = await this.client.créerBdIndépendante({
        type: "ordered-keyvalue",
        optionsAccès,
      });
      await bdTableau.set("colonnes", idBdColonnes);
    };

    const établirRègles = async () => {
      const idBdRègles = await this.client.créerBdIndépendante({
        type: "keyvalue",
        optionsAccès,
      });
      await bdTableau.set("règles", idBdRègles);
    };

    await Promise.allSettled([
      établirType(),
      établirNoms(),
      établirDonnées(),
      établirColonnes(),
      établirRègles(),
    ]);

    await fOublier();

    return idBdTableau;
  }

  async copierTableau({
    id,
    idBd,
    copierDonnées = true,
  }: {
    id: string;
    idBd: string;
    copierDonnées?: boolean;
  }): Promise<string> {
    const { bd: bdBase, fOublier } = await this.client.ouvrirBdTypée({
      id,
      type: "keyvalue",
      schéma: schémaStructureBdTableau,
    });
    const idNouveauTableau = await this.créerTableau({ idBd });
    const { bd: nouvelleBd, fOublier: fOublierNouvelle } =
      await this.client.ouvrirBdTypée({
        id: idNouveauTableau,
        type: "keyvalue",
        schéma: schémaStructureBdTableau,
      });

    // Copier les noms
    const idBdNoms = await bdBase.get("noms");
    if (idBdNoms) {
      const { bd: bdNoms, fOublier: fOublierNoms } =
        await this.client.ouvrirBdTypée({
          id: idBdNoms,
          type: "keyvalue",
          schéma: schémaStructureBdNoms,
        });
      const noms = await bdNoms.allAsJSON();
      await fOublierNoms();
      await this.sauvegarderNomsTableau({ idTableau: idNouveauTableau, noms });
    }

    // Copier les colonnes
    await this.client.copierContenuBdDic({
      bdBase,
      nouvelleBd,
      clef: "colonnes",
      schéma: schémaBdInfoCol,
      ordonnée: true,
    });

    // Copier les règles
    await this.client.copierContenuBdDic({
      bdBase,
      nouvelleBd,
      clef: "règles",
      schéma: schémaBdRègles,
    });

    if (copierDonnées) {
      // Copier les données
      await this.client.copierContenuBdDic({
        bdBase,
        nouvelleBd,
        clef: "données",
        schéma: schémaBdDonnéesTableau,
      });
    }

    await Promise.allSettled([fOublier(), fOublierNouvelle()]);

    return idNouveauTableau;
  }

  async _confirmerPermission({
    idTableau,
  }: {
    idTableau: string;
  }): Promise<void> {
    if (!(await this.client.permission({ idObjet: idTableau })))
      throw new Error(
        `Permission de modification refusée pour le tableau ${idTableau}.`,
      );
  }

  @cacheSuivi
  async suivreDifférencesAvecTableau({
    idTableau,
    idTableauRéf,
    f,
  }: {
    idTableau: string;
    idTableauRéf: string;
    f: schémaFonctionSuivi<différenceTableaux[]>;
  }): Promise<schémaFonctionOublier> {
    const info: {
      colonnesTableau?: InfoCol[];
      colonnesTableauRéf?: InfoCol[];
    } = {};

    const fFinale = async () => {
      if (!info.colonnesTableau || !info.colonnesTableauRéf) return;

      const différences: différenceTableaux[] = [];

      for (const cRéf of info.colonnesTableauRéf) {
        const cCorresp = info.colonnesTableau.find((c) => c.id === cRéf.id);
        if (cCorresp) {
          if (cCorresp.variable !== cRéf.variable) {
            const dif: différenceVariableColonne = {
              type: "variableColonne",
              sévère: true,
              idCol: cCorresp.id,
              varColTableau: cCorresp.variable,
              varColTableauLiée: cRéf.variable,
            };
            différences.push(dif);
          }
          if (cCorresp.index !== cRéf.index) {
            const dif: différenceIndexColonne = {
              type: "indexColonne",
              sévère: true,
              idCol: cCorresp.id,
              colTableauIndexée: !!cCorresp.index,
            };
            différences.push(dif);
          }
        } else {
          const dif: différenceColonneManquante = {
            type: "colonneManquante",
            sévère: true,
            idManquante: cRéf.id,
          };
          différences.push(dif);
        }
      }

      for (const cTableau of info.colonnesTableau) {
        const cLiée = info.colonnesTableauRéf.find((c) => c.id === cTableau.id);
        if (!cLiée) {
          const dif: différenceColonneSupplémentaire = {
            type: "colonneSupplémentaire",
            sévère: false,
            idExtra: cTableau.id,
          };
          différences.push(dif);
        }
      }

      await f(différences);
    };

    const fOublierColonnesTableau = await this.suivreColonnesTableau({
      idTableau,
      f: async (x) => {
        info.colonnesTableau = x;
        await fFinale();
      },
    });

    const fOublierColonnesRéf = await this.suivreColonnesTableau({
      idTableau: idTableauRéf,
      f: async (x) => {
        info.colonnesTableauRéf = x;
        await fFinale();
      },
    });

    return async () => {
      await Promise.allSettled([fOublierColonnesTableau, fOublierColonnesRéf]);
    };
  }

  async changerColIndex({
    idTableau,
    idColonne,
    val,
  }: {
    idTableau: string;
    idColonne: string;
    val: boolean;
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
    const éléments = await bdColonnes.all();
    const élémentCol = éléments.find((x) => x.value.id === idColonne);

    // Changer uniquement si la colonne existe et n'était pas déjà sous le même statut que `val`
    if (élémentCol && Boolean(élémentCol.value.index) !== val) {
      const { value } = élémentCol;
      const nouvelÉlément: InfoCol = Object.assign(value, { index: val });
      await bdColonnes.put(idColonne, nouvelÉlément);
    }

    await fOublier();
  }

  async changerIdColonne({
    idTableau,
    idColonne,
    nouvelleIdColonne,
  }: {
    idTableau: string;
    idColonne: string;
    nouvelleIdColonne: string;
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
    const élémentCol = await bdColonnes.get(idColonne);

    if (élémentCol) {
      const { value } = élémentCol;
      // value || élémentCol nécessaire pour les anciennes bds qui n'avaient pas ordered-keyvalue
      const nouvelÉlément: InfoCol = Object.assign(value || élémentCol, {
        id: nouvelleIdColonne,
      });
      await bdColonnes.put(
        nouvelleIdColonne,
        nouvelÉlément,
        élémentCol.position,
      );
      await bdColonnes.del(idColonne);
    }

    await fOublier();
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

  @cacheSuivi
  async suivreIndex({
    idTableau,
    f,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (cols: InfoCol[]) => {
      const indexes = cols.filter((c) => c.index).map((c) => c.id);
      await f(indexes);
    };
    return await this.suivreColonnesTableau({
      idTableau,
      f: fFinale,
    });
  }

  @cacheSuivi
  async suivreDonnées<T extends élémentBdListeDonnées>({
    idTableau,
    f,
    clefsSelonVariables = false,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<élémentDonnées<T>[]>;
    clefsSelonVariables?: boolean;
  }): Promise<schémaFonctionOublier> {
    const info: {
      données?: { [id: string]: T };
      colonnes?: { [key: string]: string | undefined };
    } = {};

    const fFinale = async () => {
      const { données, colonnes } = info;

      if (données && colonnes) {
        const donnéesFinales: élémentDonnées<T>[] = Object.entries(données).map(
          ([id, élément]): élémentDonnées<T> => {
            const données: T = clefsSelonVariables
              ? Object.keys(élément).reduce((acc: T, elem: string) => {
                  // Convertir au nom de la variable si souhaité
                  const idVar = elem === "id" ? "id" : colonnes[elem];
                  (acc as élémentBdListeDonnées)[idVar || elem] = élément[elem];
                  return acc;
                }, {} as T)
              : élément;

            return { données, id };
          },
        );
        await f(donnéesFinales);
      }
    };

    const fSuivreColonnes = async (colonnes: InfoCol[]) => {
      info.colonnes = Object.fromEntries(
        colonnes.map((c) => [c.id, c.variable]),
      );
      await fFinale();
    };
    const oublierColonnes = await this.suivreColonnesTableau({
      idTableau,
      f: fSuivreColonnes,
    });

    const fSuivreDonnées = async (données: { [id: string]: T }) => {
      info.données = données;
      await fFinale();
    };
    const oublierDonnées = await this.client.suivreBdDicDeClef({
      id: idTableau,
      clef: "données",
      f: fSuivreDonnées,
      // @ts-expect-error Il faudrait implémenter un schéma dynamique selon T
      schéma: schémaBdDonnéesTableau,
    });

    return async () => {
      await oublierDonnées();
      await oublierColonnes();
    };
  }

  async formaterÉlément({
    é,
    colonnes,
    fichiersSFIP,
    langues,
  }: {
    é: élémentBdListeDonnées;
    colonnes: InfoColAvecCatégorie[];
    fichiersSFIP: Set<string>;
    langues?: string[];
  }): Promise<élémentBdListeDonnées> {
    const extraireTraduction = async ({
      adresseBdTrads,
      langues,
    }: {
      adresseBdTrads: string;
      langues?: string[];
    }): Promise<string> => {
      const trads = await uneFois(
        (f: schémaFonctionSuivi<{ [key: string]: string }>) =>
          this.client.suivreBdDic({ id: adresseBdTrads, f }),
      );

      return traduire(trads, langues || []) || adresseBdTrads;
    };

    const élémentFinal: élémentBdListeDonnées = {};

    const formaterValeur = async (
      v: élémentsBd,
      catégorie: catégorieBaseVariables,
    ): Promise<string | number | undefined> => {
      switch (typeof v) {
        case "object": {
          return JSON.stringify(v);
        }
        case "boolean":
          return v.toString();
        case "number":
          return v;
        case "string":
          if (["audio", "image", "vidéo", "fichier"].includes(catégorie)) {
            fichiersSFIP.add(v);

            return v;
          } else if (catégorie === "chaîne" && isValidAddress(v)) {
            return await extraireTraduction({ adresseBdTrads: v, langues });
          }
          return v;
        default:
          return;
      }
    };

    for (const col of Object.keys(é)) {
      const colonne = colonnes.find((c) => c.id === col);
      if (!colonne) continue;

      const { catégorie } = colonne;

      let val: string | number | undefined = undefined;
      const élément = é[col];
      if (catégorie?.type === "simple") {
        val = await formaterValeur(élément, catégorie.catégorie);
      } else if (catégorie?.type === "liste") {
        if (Array.isArray(élément)) {
          val = JSON.stringify(
            await Promise.allSettled(
              élément.map((x) => formaterValeur(x, catégorie.catégorie)),
            ),
          );
        }
      }
      if (val !== undefined) élémentFinal[col] = val;
    }

    return élémentFinal;
  }

  async suivreDonnéesExportation({
    idTableau,
    langues,
    f,
  }: {
    idTableau: string;
    langues?: string[];
    f: schémaFonctionSuivi<donnéesTableauExportation>;
  }): Promise<schémaFonctionOublier> {
    const info: {
      nomsTableau?: { [clef: string]: string };
      nomsVariables?: { [idVar: string]: TraducsNom };
      colonnes?: InfoColAvecCatégorie[];
      données?: élémentDonnées<élémentBdListeDonnées>[];
    } = {};
    const fsOublier: schémaFonctionOublier[] = [];

    const fFinale = async () => {
      const { colonnes, données, nomsTableau, nomsVariables } = info;

      if (colonnes && données && (!langues || (nomsTableau && nomsVariables))) {
        const fichiersSFIP: Set<string> = new Set();

        let donnéesFormattées = await Promise.all(
          données.map((d) =>
            this.formaterÉlément({
              é: d.données,
              fichiersSFIP,
              colonnes,
              langues,
            }),
          ),
        );

        donnéesFormattées = donnéesFormattées.map((d) =>
          Object.keys(d).reduce((acc: élémentBdListeDonnées, idCol: string) => {
            const idVar = colonnes.find((c) => c.id === idCol)?.variable;
            if (!idVar)
              throw new Error(
                `Colonnne avec id ${idCol} non trouvée parmis les colonnnes :\n${JSON.stringify(
                  colonnes,
                  undefined,
                  2,
                )}.`,
              );
            const nomVar =
              langues && nomsVariables?.[idVar]
                ? traduire(nomsVariables[idVar], langues) || idCol
                : idCol;
            acc[nomVar] = d[idCol];
            return acc;
          }, {}),
        );

        const idCourtTableau = idTableau.split("/").pop()!;
        const nomTableau =
          langues && nomsTableau
            ? traduire(nomsTableau, langues) || idCourtTableau
            : idCourtTableau;

        return await f({
          nomTableau,
          données: donnéesFormattées,
          fichiersSFIP,
        });
      }
    };
    if (langues) {
      const fOublierNomsTableaux = await this.suivreNomsTableau({
        idTableau,
        f: async (noms) => {
          info.nomsTableau = noms;
          await fFinale();
        },
      });
      fsOublier.push(fOublierNomsTableaux);

      const fOublierNomsVariables = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (éléments: string[]) => Promise<void>;
        }) => this.suivreVariables({ idTableau, f: fSuivreRacine }),
        f: async (noms: { idVar: string; noms: TraducsNom }[]) => {
          info.nomsVariables = Object.fromEntries(
            noms.map((n) => [n.idVar, n.noms]),
          );
          await fFinale();
        },
        fBranche: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: schémaFonctionSuivi<{
            idVar: string;
            noms: TraducsNom;
          }>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.variables.suivreNomsVariable({
            idVariable: id,
            f: async (noms) => await fSuivreBranche({ idVar: id, noms }),
          });
        },
      });
      fsOublier.push(fOublierNomsVariables);
    }

    const fOublierColonnes = await this.suivreColonnesEtCatégoriesTableau({
      idTableau,
      f: async (cols) => {
        info.colonnes = cols;
        await fFinale();
      },
    });
    fsOublier.push(fOublierColonnes);

    const fOublierDonnées = await this.suivreDonnées({
      idTableau,
      f: async (données) => {
        info.données = données;
        await fFinale();
      },
    });
    fsOublier.push(fOublierDonnées);

    return async () => {
      Promise.allSettled(fsOublier.map((f) => f()));
    };
  }

  async exporterDonnées({
    idTableau,
    langues,
    doc,
    nomFichier,
    patience = 500,
  }: {
    idTableau: string;
    langues?: string[];
    doc?: WorkBook;
    nomFichier?: string;
    patience?: number;
  }): Promise<donnéesBdExportées> {
    /* Créer le document si nécessaire */
    doc = doc || utils.book_new();

    const données = await uneFois(
      async (
        fSuivi: schémaFonctionSuivi<{
          nomTableau: string;
          données: élémentBdListeDonnées[];
          fichiersSFIP: Set<string>;
        }>,
      ): Promise<schémaFonctionOublier> => {
        return await this.suivreDonnéesExportation({
          idTableau,
          langues,
          f: fSuivi,
        });
      },
      attendreStabilité(patience),
    );

    /* Créer le tableau */
    const tableau = utils.json_to_sheet(données.données);

    /* Ajouter la feuille au document. XLSX n'accepte pas les noms de colonne > 31 caractères */
    utils.book_append_sheet(doc, tableau, données.nomTableau.slice(0, 30));

    nomFichier = nomFichier || données.nomTableau;
    return { doc, fichiersSFIP: données.fichiersSFIP, nomFichier };
  }

  async exporterTableauÀFichier({
    idTableau,
    langues,
    doc,
    nomFichier,
    patience = 500,
    formatDoc,
    dossier = "",
    inclureDocuments = true,
  }: {
    idTableau: string;
    langues?: string[];
    doc?: WorkBook;
    nomFichier?: string;
    patience?: number;
    formatDoc: BookType | "xls";
    dossier?: string;
    inclureDocuments?: boolean;
  }): Promise<string> {
    const donnéesExportées = await this.exporterDonnées({
      idTableau,
      langues,
      doc,
      nomFichier,
      patience,
    });
    return await this.client.bds.documentDonnéesÀFichier({
      données: donnéesExportées,
      formatDoc,
      dossier,
      inclureDocuments,
    });
  }

  async ajouterÉlément<T extends élémentBdListeDonnées>({
    idTableau,
    vals,
  }: {
    idTableau: string;
    vals: T | T[];
  }): Promise<string[]> {
    await this._confirmerPermission({ idTableau });

    if (!Array.isArray(vals)) {
      vals = [vals];
    }

    const idBdDonnées = await this.client.obtIdBd({
      nom: "données",
      racine: idTableau,
      type: "keyvalue",
    });

    const { bd: bdDonnées, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdDonnées,
      type: "keyvalue",
      schéma: schémaBdDonnéesTableau,
    });

    // Éviter, autant que possible, de dédoubler des colonnes indexes
    const colsIndexe = (
      await uneFois((f: schémaFonctionSuivi<InfoCol[]>) =>
        this.suivreColonnesTableau({ idTableau, f }),
      )
    )
      .filter((c) => c.index)
      .map((c) => c.id);
    const obtIdIndex = (v: T): string => {
      const valsIndex = Object.fromEntries(
        Object.entries(v).filter((x) => colsIndexe.includes(x[0])),
      );
      return Base64.stringify(md5(JSON.stringify(valsIndex)));
    };

    const ids: string[] = [];
    for (const val of vals) {
      const id = colsIndexe.length ? obtIdIndex(val) : uuidv4();
      await bdDonnées.put(id, val);
      ids.push(id);
    }

    await fOublier();

    return ids;
  }

  async modifierÉlément({
    idTableau,
    vals,
    idÉlément,
  }: {
    idTableau: string;
    vals: { [key: string]: élémentsBd | undefined };
    idÉlément: string;
  }): Promise<void> {
    await this._confirmerPermission({ idTableau });
    const idBdDonnées = await this.client.obtIdBd({
      nom: "données",
      racine: idTableau,
      type: "keyvalue",
    });

    const { bd: bdDonnées, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdDonnées,
      type: "keyvalue",
      schéma: schémaBdDonnéesTableau,
    });

    const précédent = await bdDonnées.get(idÉlément);
    if (!précédent) throw new Error(`Id élément ${idÉlément} n'existe pas.`);

    const élément = Object.assign({}, précédent, vals);

    Object.keys(vals).map((c: string) => {
      if (vals[c] === undefined) delete élément[c];
    });

    if (!élémentsÉgaux(élément, précédent)) {
      await bdDonnées.put(idÉlément, élément);
    }
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

  async effacerÉlément({
    idTableau,
    idÉlément,
  }: {
    idTableau: string;
    idÉlément: string;
  }): Promise<void> {
    await this._confirmerPermission({ idTableau });
    const idBdDonnées = await this.client.obtIdBd({
      nom: "données",
      racine: idTableau,
      type: "keyvalue",
    });

    const { bd: bdDonnées, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdDonnées,
      type: "keyvalue",
      schéma: schémaBdDonnéesTableau,
    });
    await bdDonnées.del(idÉlément);
    await fOublier();
  }

  async combinerDonnées({
    idTableauBase,
    idTableau2,
    patience = 100,
  }: {
    idTableauBase: string;
    idTableau2: string;
    patience?: number;
  }): Promise<void> {
    const [donnéesTableauBase, donnéesTableau2] = await Promise.all([
      uneFois(
        async (
          fSuivi: schémaFonctionSuivi<élémentDonnées<élémentBdListeDonnées>[]>,
        ) => {
          return await this.suivreDonnées({
            idTableau: idTableauBase,
            f: fSuivi,
          });
        },
        attendreStabilité(patience),
      ),
      uneFois(
        async (
          fSuivi: schémaFonctionSuivi<élémentDonnées<élémentBdListeDonnées>[]>,
        ) => {
          return await this.suivreDonnées({ idTableau: idTableau2, f: fSuivi });
        },
        attendreStabilité(patience),
      ),
    ]);

    const colsTableauBase = await uneFois(
      async (fSuivi: schémaFonctionSuivi<InfoCol[]>) => {
        return await this.suivreColonnesTableau({
          idTableau: idTableauBase,
          f: fSuivi,
        });
      },
      // Il faut attendre que toutes les colonnes soient présentes
      (colonnes) =>
        colonnes !== undefined &&
        [
          ...new Set(
            donnéesTableauBase
              .map((d) => Object.keys(d.données).filter((c) => c !== "id"))
              .flat(),
          ),
        ].length <= colonnes.length,
    );

    const indexes = colsTableauBase.filter((c) => c.index).map((c) => c.id);
    for (const nouvelÉlément of donnéesTableau2) {
      const existant = donnéesTableauBase.find((d) =>
        indexÉlémentsÉgaux(d.données, nouvelÉlément.données, indexes),
      );

      if (existant) {
        const àAjouter: { [key: string]: élémentsBd } = {};
        for (const col of colsTableauBase) {
          if (
            existant.données[col.id] === undefined &&
            nouvelÉlément.données[col.id] !== undefined
          ) {
            àAjouter[col.id] = nouvelÉlément.données[col.id];
          }
        }

        if (Object.keys(àAjouter).length) {
          await this.effacerÉlément({
            idTableau: idTableauBase,
            idÉlément: existant.id,
          });
          await this.ajouterÉlément({
            idTableau: idTableauBase,
            vals: Object.assign({}, existant.données, àAjouter),
          });
        }
      } else {
        await this.ajouterÉlément({
          idTableau: idTableauBase,
          vals: nouvelÉlément.données,
        });
      }
    }
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

  async sauvegarderNomsTableau({
    idTableau,
    noms,
  }: {
    idTableau: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    await this._confirmerPermission({ idTableau });
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idTableau,
      type: "keyvalue",
    });

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdNoms,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }

    await fOublier();
  }

  async sauvegarderNomTableau({
    idTableau,
    langue,
    nom,
  }: {
    idTableau: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    await this._confirmerPermission({ idTableau });
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idTableau,
      type: "keyvalue",
    });

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdNoms,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    await bdNoms.set(langue, nom);
    await fOublier();
  }

  async effacerNomTableau({
    idTableau,
    langue,
  }: {
    idTableau: string;
    langue: string;
  }): Promise<void> {
    await this._confirmerPermission({ idTableau });
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idTableau,
      type: "keyvalue",
    });

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdNoms,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    await bdNoms.del(langue);

    await fOublier();
  }

  @cacheSuivi
  async suivreNomsTableau({
    idTableau,
    f,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({
      id: idTableau,
      clef: "noms",
      schéma: schémaStructureBdNoms,
      f,
    });
  }

  async ajouterColonneTableau({
    idTableau,
    idVariable,
    idColonne,
  }: {
    idTableau: string;
    idVariable?: string;
    idColonne?: string;
  }): Promise<string> {
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

    idColonne = idColonne || uuidv4();
    const élément = {
      id: idColonne,
      variable: idVariable,
    };
    await bdColonnes.put(idColonne, élément);

    await fOublier();
    return idColonne;
  }

  async effacerColonneTableau({
    idTableau,
    idColonne,
  }: {
    idTableau: string;
    idColonne: string;
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
    await bdColonnes.del(idColonne);

    await fOublier();
  }

  @cacheSuivi
  async suivreColonnesTableau({
    idTableau,
    f,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<InfoCol[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicOrdonnéeDeClef({
      id: idTableau,
      clef: "colonnes",
      schéma: schémaBdInfoCol,
      f: async (cols) => await f(cols.map((c) => c.value)),
    });
  }

  @cacheSuivi
  async suivreColonnesEtCatégoriesTableau({
    idTableau,
    f,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<InfoColAvecCatégorie[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (colonnes?: InfoColAvecCatégorie[]) => {
      if (colonnes) return await f(colonnes);
    };
    const fBranche = async ({
      fSuivreBranche,
      branche,
    }: {
      fSuivreBranche: schémaFonctionSuivi<InfoColAvecCatégorie>;
      branche: InfoCol;
    }): Promise<schémaFonctionOublier> => {
      const idVariable = branche.variable;
      if (!idVariable) return faisRien;

      return await this.client.variables.suivreCatégorieVariable({
        idVariable,
        f: async (catégorie) => {
          const col = Object.assign(
            { catégorie, variable: idVariable },
            branche,
          );
          await fSuivreBranche(col);
        },
      });
    };
    const fIdDeBranche = (x: InfoColAvecCatégorie) => x.id;

    const fSuivreBdColonnes = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<InfoColAvecCatégorie[]>;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.suivreBdsDeBdDic({
        id,
        f: fSuivreBd,
        fBranche,
        fIdDeBranche,
      });
    };

    return await this.client.suivreBdDeClef({
      id: idTableau,
      clef: "colonnes",
      f: fFinale,
      fSuivre: fSuivreBdColonnes,
    });
  }

  @cacheSuivi
  async suivreVariables({
    idTableau,
    f,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (variables?: string[]) => {
      await f((variables || []).filter((v) => v && isValidAddress(v)));
    };
    const fSuivreBdColonnes = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<string[]>;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.suivreBdListe({
        id,
        f: (cols: InfoCol[]) =>
          fSuivreBd(cols.map((c) => c.variable).filter((v) => !!v) as string[]),
      });
    };
    return await this.client.suivreBdDeClef({
      id: idTableau,
      clef: "colonnes",
      f: fFinale,
      fSuivre: fSuivreBdColonnes,
    });
  }

  async ajouterRègleTableau<R extends règleVariable = règleVariable>({
    idTableau,
    idColonne,
    règle,
  }: {
    idTableau: string;
    idColonne: string;
    règle: R;
  }): Promise<string> {
    await this._confirmerPermission({ idTableau });
    const idBdRègles = await this.client.obtIdBd({
      nom: "règles",
      racine: idTableau,
      type: "keyvalue",
    });

    const { bd: bdRègles, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdRègles,
      type: "keyvalue",
      schéma: schémaBdRègles,
    });

    const id = uuidv4();
    const règleAvecId: règleVariableAvecId<R> = {
      id,
      règle,
    };

    const élément: règleColonne = {
      règle: règleAvecId,
      source: { type: "tableau", id: idTableau },
      colonne: idColonne,
    };
    await bdRègles.put(id, élément);

    await fOublier();

    return id;
  }

  async effacerRègleTableau({
    idTableau,
    idRègle,
  }: {
    idTableau: string;
    idRègle: string;
  }): Promise<void> {
    await this._confirmerPermission({ idTableau });
    const idBdRègles = await this.client.obtIdBd({
      nom: "règles",
      racine: idTableau,
      type: "keyvalue",
    });

    const { bd: bdRègles, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdRègles,
      type: "keyvalue",
      schéma: schémaBdRègles,
    });

    await bdRègles.del(idRègle);

    await fOublier();
  }

  @cacheSuivi
  async suivreRègles({
    idTableau,
    f,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<règleColonne[]>;
  }): Promise<schémaFonctionOublier> {
    const dicRègles: { tableau?: règleColonne[]; variable?: règleColonne[] } =
      {};
    const fFinale = async () => {
      if (!dicRègles.tableau || !dicRègles.variable) return;
      return await f([...dicRègles.tableau, ...dicRègles.variable]);
    };

    // Suivre les règles spécifiées dans le tableau
    const fFinaleRèglesTableau = async (règles: {
      [id: string]: règleColonne;
    }) => {
      dicRègles.tableau = Object.values(règles);
      return await fFinale();
    };

    const oublierRèglesTableau = await this.client.suivreBdDicDeClef({
      id: idTableau,
      clef: "règles",
      schéma: schémaBdRègles,
      f: fFinaleRèglesTableau,
    });

    // Suivre les règles spécifiées dans les variables
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: InfoColAvecVariable[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreColonnesTableau({
        idTableau,
        f: async (cols) =>
          fSuivreRacine(
            cols.filter((c) => !!c.variable) as InfoColAvecVariable[],
          ),
      });
    };

    const fFinaleRèglesVariables = async (règles: règleColonne[]) => {
      dicRègles.variable = règles;
      return await fFinale();
    };

    const fBranche = async ({
      id: idVariable,
      fSuivreBranche,
      branche,
    }: {
      id: string | undefined;
      fSuivreBranche: schémaFonctionSuivi<règleColonne[]>;
      branche: InfoCol;
    }) => {
      if (!idVariable) {
        await fSuivreBranche([]);
        return faisRien;
      }
      const fFinaleSuivreBranche = async (
        règles: règleVariableAvecId<règleVariable>[],
      ) => {
        const règlesColonnes: règleColonne[] = règles.map((r) => {
          return {
            règle: r,
            source: { type: "variable", id: idVariable },
            colonne: branche.id,
          };
        });
        return await fSuivreBranche(règlesColonnes);
      };
      return await this.client.variables.suivreRèglesVariable({
        idVariable,
        f: fFinaleSuivreBranche,
      });
    };

    const fIdDeBranche = (b: InfoColAvecVariable) => b.variable;

    const oublierRèglesVariable = await suivreDeFonctionListe({
      fListe,
      f: fFinaleRèglesVariables,
      fBranche,
      fIdDeBranche,
    });

    // Tout oublier
    const fOublier = async () => {
      await oublierRèglesTableau();
      await oublierRèglesVariable();
    };

    return fOublier;
  }

  @cacheSuivi
  async suivreValidDonnées({
    idTableau,
    f,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<erreurValidation[]>;
  }): Promise<schémaFonctionOublier> {
    const info: {
      données?: élémentDonnées[];
      règles?: schémaFonctionValidation[];
      varsÀColonnes?: { [key: string]: string };
    } = {};
    const fFinale = async () => {
      if (!info.données || !info.règles) return;

      let erreurs: erreurValidation[] = [];
      for (const r of info.règles) {
        const nouvellesErreurs = r(info.données);
        erreurs = [...erreurs, ...nouvellesErreurs.flat()];
      }
      await f(erreurs);
    };
    const fFinaleRègles = async (
      règles: { règle: règleColonne; donnéesCatégorie?: élémentsBd[] }[],
    ) => {
      if (info.varsÀColonnes) {
        const varsÀColonnes = info.varsÀColonnes;
        info.règles = règles.map((r) =>
          générerFonctionRègle({
            règle: r.règle,
            varsÀColonnes,
            donnéesCatégorie: r.donnéesCatégorie,
          }),
        );
        await fFinale();
      }
    };
    const fFinaleDonnées = async (données: élémentDonnées[]) => {
      info.données = données;
      await fFinale();
    };
    const fOublierVarsÀColonnes = await this.suivreColonnesTableau({
      idTableau,
      f: async (cols) => {
        const varsÀColonnes = cols.reduce(
          (o, c) => (c.variable ? { ...o, [c.variable]: c.id } : { ...o }),
          {},
        );
        info.varsÀColonnes = varsÀColonnes;
        await fFinale();
      },
    });

    const fListeRègles = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (règles: règleColonne[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreRègles({ idTableau, f: fSuivreRacine });
    };

    const fBrancheRègles = async ({
      fSuivreBranche,
      branche: règle,
    }: {
      fSuivreBranche: schémaFonctionSuivi<{
        règle: règleColonne;
        donnéesCatégorie?: élémentsBd[];
      }>;
      branche: règleColonne;
    }): Promise<schémaFonctionOublier> => {
      if (
        règle.règle.règle.typeRègle === "valeurCatégorique" &&
        règle.règle.règle.détails.type === "dynamique"
      ) {
        const { tableau, colonne } = règle.règle.règle.détails;
        return await this.suivreDonnées({
          idTableau: tableau,
          f: async (données) =>
            await fSuivreBranche({
              règle,
              donnéesCatégorie: données.map((d) => d.données[colonne]),
            }),
        });
      } else {
        await fSuivreBranche({ règle });
        return faisRien;
      }
    };

    const fIdDeBranche = (b: règleColonne) => b.règle.id;

    const fOublierRègles = await suivreDeFonctionListe({
      fListe: fListeRègles,
      f: fFinaleRègles,
      fBranche: fBrancheRègles,
      fIdDeBranche,
    });

    const fOublierDonnées = await this.suivreDonnées({
      idTableau,
      f: fFinaleDonnées,
    });
    const fOublier = async () => {
      await fOublierRègles();
      await fOublierDonnées();
      await fOublierVarsÀColonnes();
    };
    return fOublier;
  }

  @cacheSuivi
  async suivreValidRègles({
    idTableau,
    f,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<erreurRègle[]>;
  }): Promise<schémaFonctionOublier> {
    const info: {
      règles?: {
        règle: règleColonne<règleVariable>;
        colsTableauRéf?: InfoColAvecCatégorie[];
      }[];
      colonnes?: InfoCol[];
    } = {};

    const fFinale = async () => {
      if (!info.colonnes || !info.règles) return;

      const erreurs: erreurRègle[] = [];

      const règlesTypeBornes = info.règles
        .map((r) => r.règle)
        .filter(
          (r) => r.règle.règle.typeRègle === "bornes",
        ) as règleColonne<règleBornes>[];

      const règlesBornesColonnes = règlesTypeBornes.filter(
        (r) => r.règle.règle.détails.type === "dynamiqueColonne",
      ) as règleColonne<règleBornes<détailsRègleBornesDynamiqueColonne>>[];

      const règlesBornesVariables = règlesTypeBornes.filter(
        (r) => r.règle.règle.détails.type === "dynamiqueVariable",
      ) as règleColonne<règleBornes<détailsRègleBornesDynamiqueVariable>>[];

      const règlesCatégoriquesDynamiques = info.règles.filter(
        (r) =>
          r.règle.règle.règle.typeRègle === "valeurCatégorique" &&
          r.règle.règle.règle.détails.type === "dynamique",
      ) as {
        règle: règleColonne<
          règleValeurCatégorique<détailsRègleValeurCatégoriqueDynamique>
        >;
        colsTableauRéf?: InfoColAvecCatégorie[];
      }[];

      for (const r of règlesBornesColonnes) {
        const colRéfRègle = info.colonnes.find(
          (c) => c.id === r.règle.règle.détails.val,
        );
        if (!colRéfRègle) {
          const erreur: erreurRègleBornesColonneInexistante = {
            règle: r,
            détails: "colonneBornesInexistante",
          };
          erreurs.push(erreur);
        }
      }

      for (const r of règlesBornesVariables) {
        const varRéfRègle = info.colonnes.find(
          (c) => c.variable === r.règle.règle.détails.val,
        );
        if (!varRéfRègle) {
          const erreur: erreurRègleBornesVariableNonPrésente = {
            règle: r,
            détails: "variableBornesNonPrésente",
          };
          erreurs.push(erreur);
        }
      }

      for (const r of règlesCatégoriquesDynamiques) {
        const colRéfRègle = r.colsTableauRéf?.find(
          (c) => c.id === r.règle.règle.règle.détails.colonne,
        );
        if (!colRéfRègle) {
          const erreur: erreurRègleCatégoriqueColonneInexistante = {
            règle: r.règle,
            détails: "colonneCatégInexistante",
          };
          erreurs.push(erreur);
        }
      }
      await f(erreurs);
    };

    const fFinaleRègles = async (
      règles: {
        règle: règleColonne<règleVariable>;
        colsTableauRéf?: InfoColAvecCatégorie[];
      }[],
    ) => {
      info.règles = règles;
      return await fFinale();
    };

    const fOublierColonnes = await this.suivreColonnesTableau({
      idTableau,
      f: async (cols) => {
        info.colonnes = cols;
        return await fFinale();
      },
    });

    const fListeRègles = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (règles: règleColonne<règleVariable>[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreRègles({ idTableau, f: fSuivreRacine });
    };

    const fBrancheRègles = async ({
      fSuivreBranche,
      branche: règle,
    }: {
      fSuivreBranche: schémaFonctionSuivi<{
        règle: règleColonne<règleVariable>;
        colsTableauRéf?: InfoCol[];
      }>;
      branche: règleColonne<règleVariable>;
    }): Promise<schémaFonctionOublier> => {
      if (
        règle.règle.règle.typeRègle === "valeurCatégorique" &&
        règle.règle.règle.détails.type === "dynamique"
      ) {
        const { tableau } = règle.règle.règle.détails;
        return await this.suivreColonnesTableau({
          idTableau: tableau,
          f: (cols) =>
            fSuivreBranche({
              règle,
              colsTableauRéf: cols,
            }),
        });
      } else {
        await fSuivreBranche({ règle });
        return faisRien;
      }
    };

    const fIdDeBranche = (b: règleColonne<règleVariable>) => b.règle.id;

    const fOublierRègles = await suivreDeFonctionListe({
      fListe: fListeRègles,
      f: fFinaleRègles,
      fBranche: fBrancheRègles,
      fIdDeBranche,
    });

    const fOublier = async () => {
      await fOublierRègles();
      await fOublierColonnes();
    };
    return fOublier;
  }

  async effacerTableau({ idTableau }: { idTableau: string }): Promise<void> {
    // Effacer toutes les composantes du tableau
    for (const clef of ["noms", "données", "colonnes", "règles"]) {
      const idBd = await this.client.obtIdBd({
        nom: clef,
        racine: idTableau,
      });
      if (idBd) await this.client.effacerBd({ id: idBd });
    }
    // Effacer le tableau lui-même
    await this.client.effacerBd({ id: idTableau });
  }
}
