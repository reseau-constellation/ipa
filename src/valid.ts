import gjv from "geojson-validation";

import { élémentsBd } from "@/types.js";
import { cidValide } from "@constl/utils-ipa";
import type {
  catégorieBaseVariables,
  catégorieVariables,
} from "@/variables.js";
import type { élémentBdListeDonnées, élémentDonnées } from "@/tableaux.js";
import { cholqij } from "@/dates.js";
import { JSONSchemaType } from "ajv";
import { isValidAddress } from "@orbitdb/core";

export type typeRègle = "catégorie" | "bornes" | "valeurCatégorique" | "existe";
export type sourceRègle =
  | { type: "variable"; id: string }
  | { type: "tableau"; id: string };

export type règleVariableAvecId<T extends règleVariable = règleVariable> = {
  id: string;
  règle: T;
};

export const schémaRègleVariableAvecId: JSONSchemaType<règleVariableAvecId> = {
  type: "object",
  properties: {
    id: { type: "string" },
    règle: {
      type: "object",
      properties: {
        typeRègle: { type: "string" },
        détails: {
          type: "object",
          required: [],
          additionalProperties: true,
        },
      },
      required: ["détails", "typeRègle"],
    },
  },
  required: ["id", "règle"],
};

export type règleVariable =
  | règleExiste
  | règleBornes
  | règleValeurCatégorique
  | règleCatégorie;

export type schémaRègleVariable<T extends détailsRègleVariable> = {
  typeRègle: typeRègle;
  détails: T;
};

export type règleColonne<T extends règleVariable = règleVariable> = {
  règle: règleVariableAvecId<T>;
  source: sourceRègle;
  colonne: string;
};

export const schémaRègleColonne: JSONSchemaType<règleColonne> = {
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
};

export type détailsRègleVariable =
  | détailsRègleExiste
  | détailsRègleBornes
  | détailsRègleValeurCatégorique
  | détailsRègleCatégorie;

export type typeOp = ">" | "<" | ">=" | "<=" | "≥" | "≤";

export type règleExiste = schémaRègleVariable<détailsRègleExiste> & {
  typeRègle: "existe";
};

export type détailsRègleExiste = Record<string, never>;

export type règleBornes<T extends détailsRègleBornes = détailsRègleBornes> =
  schémaRègleVariable<T> & {
    typeRègle: "bornes";
  };

// Peut être numérique ou bien l'id d'une autre variable ou l'id d'une colonne sur la même BD
export type détailsRègleBornes =
  | détailsRègleBornesFixe
  | détailsRègleBornesDynamiqueColonne
  | détailsRègleBornesDynamiqueVariable;

export type détailsRègleBornesFixe = {
  type: "fixe";
  val: number;
  op: typeOp;
};

export type détailsRègleBornesDynamiqueColonne = {
  type: "dynamiqueColonne";
  val: string;
  op: typeOp;
};

export type détailsRègleBornesDynamiqueVariable = {
  type: "dynamiqueVariable";
  val: string;
  op: typeOp;
};

export type règleValeurCatégorique<
  T extends détailsRègleValeurCatégorique = détailsRègleValeurCatégorique
> = schémaRègleVariable<T> & {
  typeRègle: "valeurCatégorique";
};

export type détailsRègleValeurCatégorique =
  | détailsRègleValeurCatégoriqueFixe
  | détailsRègleValeurCatégoriqueDynamique;

export type détailsRègleValeurCatégoriqueFixe = {
  type: "fixe";
  options: élémentsBd[];
};

export type détailsRègleValeurCatégoriqueDynamique = {
  type: "dynamique";
  tableau: string;
  colonne: string;
};

export type règleCatégorie = schémaRègleVariable<détailsRègleCatégorie> & {
  typeRègle: "catégorie";
};

export type détailsRègleCatégorie = {
  catégorie: catégorieVariables;
};

export type Erreur<T extends règleVariable = règleVariable> = {
  règle: règleColonne<T>;
};

export type erreurValidation<T extends règleVariable = règleVariable> = {
  empreinte: string;
  erreur: Erreur<T>;
};

export type erreurRègle =
  | erreurRègleCatégoriqueColonneInexistante
  | erreurRègleBornesColonneInexistante
  | erreurRègleBornesVariableNonPrésente;

export type erreurRègleCatégoriqueColonneInexistante = {
  règle: règleColonne<
    règleValeurCatégorique<détailsRègleValeurCatégoriqueDynamique>
  >;
  détails: "colonneCatégInexistante";
};

export type erreurRègleBornesColonneInexistante = {
  règle: règleColonne<règleBornes<détailsRègleBornesDynamiqueColonne>>;
  détails: "colonneBornesInexistante";
};

export type erreurRègleBornesVariableNonPrésente = {
  règle: règleColonne<règleBornes<détailsRègleBornesDynamiqueVariable>>;
  détails: "variableBornesNonPrésente";
};

export type schémaFonctionValidation<
  T extends élémentBdListeDonnées,
  R extends règleVariable = règleVariable
> = (valeurs: élémentDonnées<T>[]) => erreurValidation<R>[];

export function générerFonctionRègle<
  T extends élémentBdListeDonnées,
  R extends règleVariable
>({
  règle,
  varsÀColonnes,
  donnéesCatégorie,
}: {
  règle: règleColonne<R>;
  varsÀColonnes: { [key: string]: string };
  donnéesCatégorie?: élémentsBd[];
}): schémaFonctionValidation<T, R> {
  const règleDeLaVariable = règle.règle;
  const { colonne } = règle;
  const { typeRègle } = règleDeLaVariable.règle;

  switch (typeRègle) {
    case "existe": {
      return (vals: élémentDonnées<T>[]): erreurValidation<R>[] => {
        const nonValides = vals.filter((v) => v.données[colonne] === undefined);
        return nonValides.map((v: élémentDonnées<T>) => {
          const { empreinte } = v;
          const erreur: erreurValidation<R> = {
            empreinte,
            erreur: { règle },
          };
          return erreur;
        });
      };
    }

    case "catégorie": {
      return (vals: élémentDonnées<T>[]) => {
        const catégorie = (règleDeLaVariable.règle as règleCatégorie).détails
          .catégorie;
        const nonValides = vals.filter(
          (v) => !validerCatégorieVal({ val: v.données[colonne], catégorie })
        );
        return nonValides.map((v: élémentDonnées<T>) => {
          const { empreinte } = v;
          const erreur: erreurValidation<R> = {
            empreinte,
            erreur: { règle },
          };
          return erreur;
        });
      };
    }

    case "bornes": {
      const règleTypeBornes =
        règleDeLaVariable as règleVariableAvecId<règleBornes>;

      let fComp: (v: élémentDonnées<T>) => boolean;
      let fOp: (v1: number, v2: number) => boolean;

      const { val, op, type: typeBornes } = règleTypeBornes.règle.détails;

      const manquantes = (v1?: number, v2?: number): boolean => {
        return v1 === undefined || v2 === undefined;
      };

      switch (op) {
        case ">":
          fOp = (v1?: number, v2?: number) => manquantes(v1, v2) || v1! > v2!;
          break;
        case "<":
          fOp = (v1?: number, v2?: number) => manquantes(v1, v2) || v1! < v2!;
          break;
        case "≥":
        case ">=":
          fOp = (v1?: number, v2?: number) => manquantes(v1, v2) || v1! >= v2!;
          break;
        case "≤":
        case "<=":
          fOp = (v1?: number, v2?: number) => manquantes(v1, v2) || v1! <= v2!;
          break;
      }

      if (typeBornes === "fixe") {
        fComp = (v: élémentDonnées<T>): boolean => {
          const donnéesCol = v.données[colonne];
          return Array.isArray(donnéesCol)
            ? donnéesCol.every((x) => fOp(x as number, val as number))
            : fOp(donnéesCol as number, val as number);
        };
      } else {
        fComp = (v: élémentDonnées<T>): boolean => {
          const donnéesCol = v.données[colonne];

          // Vérifier s'il s'agit d'une variable ou d'une colonne et s'ajuster en fonction
          const borne = (
            typeBornes === "dynamiqueVariable"
              ? v.données[varsÀColonnes[val]]
              : v.données[val]
          ) as number;
          return Array.isArray(donnéesCol)
            ? donnéesCol.every((x) => fOp(x as number, borne))
            : fOp(donnéesCol as number, borne);
        };
      }

      return (vals: élémentDonnées<T>[]) => {
        const nonValides = vals.filter(
          (v) => !validerBorneVal({ val: v, fComp })
        );
        return nonValides.map((v: élémentDonnées<T>) => {
          const { empreinte } = v;
          const erreur: erreurValidation<R> = {
            empreinte,
            erreur: { règle },
          };
          return erreur;
        });
      };
    }

    case "valeurCatégorique": {
      const règleTypeCatégorique =
        règleDeLaVariable.règle as règleValeurCatégorique;

      const options =
        règleTypeCatégorique.détails.type === "fixe"
          ? règleTypeCatégorique.détails.options
          : donnéesCatégorie;

      if (!options) throw new Error("Options non spécifiées");

      return (vals: élémentDonnées<T>[]) => {
        const nonValides = vals.filter(
          (v: élémentDonnées<T>) =>
            v.données[colonne] !== undefined &&
            !options.includes(v.données[colonne])
        );
        return nonValides.map((v: élémentDonnées<T>) => {
          const { empreinte } = v;
          return {
            empreinte,
            colonne,
            erreur: { règle },
          };
        });
      };
    }
    default:
      throw Error(`Catégorie ${typeRègle} inconnue.`);
  }
}

export const formatsFichiers = {
  images: [
    "webp",
    "svg",
    "png",
    "jpg",
    "jpeg",
    "jfif",
    "pjpeg",
    "pjp",
    "gif",
    "avif",
    "apng",
  ],
  vidéo: ["mp4"],
  audio: ["mp3", "ogg", "m4a"],
};

function validFichier(val: unknown, exts?: string[]): boolean {
  if (typeof val !== "string") return false;
  let id: string;
  let fichier: string;
  try {
    [id, fichier] = val.split("/");
  } catch {
    return false;
  }
  if (!fichier) return false;
  if (!cidValide(id)) return false;
  if (exts) {
    const ext = fichier.split(".")[1];
    return exts.includes(ext);
  }
  return true;
}

export function validerCatégorieVal({
  val,
  catégorie,
}: {
  val: unknown;
  catégorie: catégorieVariables;
}): boolean {
  if (val === undefined) return true; // Permettre les valeurs manquantes

  if (catégorie.type === "simple") {
    return validerCatégorieBase({ catégorie: catégorie.catégorie, val });
  } else {
    if (Array.isArray(val)) {
      return val.every((v) =>
        validerCatégorieBase({ catégorie: catégorie.catégorie, val: v })
      );
    } else {
      return false;
    }
  }
}

const validerBorneVal = ({
  val,
  fComp,
}: {
  val: unknown;
  fComp: (v: any) => boolean;
}) => {
  if (Array.isArray(val)) {
    return val.every((v) => fComp(v));
  } else {
    return fComp(val);
  }
};

const estUnHoroDatage = (val: unknown): boolean => {
  if (["number", "string"].includes(typeof val)) {
    const date = new Date(val as string | number);
    return !isNaN(date.valueOf());
  } else {
    return cholqij.dateValide(val);
  }
};

const validerCatégorieBase = ({
  catégorie,
  val,
}: {
  catégorie: catégorieBaseVariables;
  val: unknown;
}) => {
  switch (catégorie) {
    case "numérique":
      return typeof val === "number";
    case "horoDatage": {
      return estUnHoroDatage(val);
    }
    case "intervaleTemps":
      if (!Array.isArray(val)) return false;
      if (val.length !== 2) return false;
      return val.every((d) => estUnHoroDatage(d));
    case "chaîne":
      return isValidAddress(val);
    case "chaîneNonTraductible":
      return typeof val === "string";
    case "booléen":
      return typeof val === "boolean";
    case "géojson":
      if (!(typeof val === "object")) return false;
      return gjv.valid(val);
    case "vidéo":
      return validFichier(val, formatsFichiers.vidéo);
    case "audio":
      return validFichier(val, formatsFichiers.audio);
    case "image":
      return validFichier(val, formatsFichiers.images);
    case "fichier":
      return validFichier(val);
    default:
      return false;
  }
};
