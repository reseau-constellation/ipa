import gjv from "geojson-validation";

import { cidValide, élémentsBd } from "@/utils";
import { catégorieVariables } from "@/variables";
import { élémentBdListeDonnées } from "@/tableaux";

export type typeRègle = "catégorie" | "bornes" | "valeurCatégorique" | "existe";
export type sourceRègle = "variable" | "tableau";

export type règleVariableAvecId<T extends règleVariable = règleVariable> = {
  id: string;
  règle: T;
};

export type règleVariable = {
  typeRègle: typeRègle;
  détails: { [key: string]: élémentsBd };
};

export type règleColonne<T extends règleVariable = règleVariable> = {
  règle: règleVariableAvecId<T>;
  source: sourceRègle;
  colonne: string;
};

export type typeOp = ">" | "<" | ">=" | "<=";

export interface règleExiste extends règleVariable {
  typeRègle: "existe";
  détails: Record<string, never>;
}

export interface règleBornes extends règleVariable {
  typeRègle: "bornes";
  détails: {
    val: number | string; // Peut être numérique ou bien le nom d'une autre variable
    op: typeOp;
  };
}

export interface règleValeurCatégorique extends règleVariable {
  typeRègle: "valeurCatégorique";
  détails:
    | {
        type: "fixe";
        options: élémentsBd[];
      }
    | {
        type: "dynamique";
        tableau: string;
        colonne: string;
      };
}

export interface règleCatégorie extends règleVariable {
  typeRègle: "catégorie";
  détails: {
    catégorie: catégorieVariables;
  };
}

export interface Erreur {
  règle: règleColonne;
}

export interface erreurValidation {
  empreinte: string;
  erreur: Erreur;
}

export type schémaFonctionValidation<T extends élémentBdListeDonnées> = (
  valeurs: élémentDonnées<T>[]
) => erreurValidation[];

export interface élémentDonnées<
  T extends élémentBdListeDonnées = élémentBdListeDonnées
> {
  données: T;
  empreinte: string;
}

export function générerFonctionRègle<T extends élémentBdListeDonnées>({
  règle,
  varsÀColonnes,
  donnéesCatégorie,
}: {
  règle: règleColonne;
  varsÀColonnes: { [key: string]: string };
  donnéesCatégorie?: élémentsBd[];
}): schémaFonctionValidation<T> {
  const règleVariable = règle.règle;
  const { colonne } = règle;
  const { typeRègle } = règleVariable.règle;

  switch (typeRègle) {
    case "existe": {
      return (vals: élémentDonnées<T>[]) => {
        const nonValides = vals.filter((v) => v.données[colonne] === undefined);
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

    case "catégorie": {
      return (vals: élémentDonnées<T>[]) => {
        const catégorie = (règleVariable.règle as règleCatégorie).détails
          .catégorie;
        const nonValides = vals.filter(
          (v) => !validerCatégorieVal({ val: v.données[colonne], catégorie })
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

    case "bornes": {
      let fComp: (v: élémentDonnées<T>) => boolean;
      let fOp: (v1: number, v2: number) => boolean;

      const { val, op } = (règleVariable.règle as règleBornes).détails;

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
        case ">=":
          fOp = (v1?: number, v2?: number) => manquantes(v1, v2) || v1! >= v2!;
          break;
        case "<=":
          fOp = (v1?: number, v2?: number) => manquantes(v1, v2) || v1! <= v2!;
          break;
      }

      switch (typeof val) {
        case "string": {
          const idsColonnes = Object.values(varsÀColonnes);

          if (règle.source === "tableau" && !idsColonnes.includes(val)) {
            fComp = (_: élémentDonnées<T>) => false;
          } else {
            fComp = (v: élémentDonnées<T>) =>
              fOp(
                v.données[colonne] as number,
                // Vérifier s'il s'agit d'une variable ou d'une colonne et s'ajuster en fonction
                (règle.source === "variable"
                  ? v.données[varsÀColonnes[val]]
                  : v.données[val]) as number
              );
          }
          break;
        }
        case "number":
          fComp = (v: élémentDonnées<T>) =>
            fOp(v.données[colonne] as number, val as number);
          break;
        default:
          throw Error(`Borne de type ${typeof val} non reconnue.`);
      }

      return (vals: élémentDonnées<T>[]) => {
        const nonValides = vals.filter((v) => !fComp(v));
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

    case "valeurCatégorique": {
      const règleCatégorique = règleVariable.règle as règleValeurCatégorique;

      const options =
        règleCatégorique.détails.type === "fixe"
          ? règleCatégorique.détails.options
          : donnéesCatégorie;

      if (!options) throw "Options non spécifiées";

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
  if (typeof val !== "object") return false;
  const { cid, ext } = val as { cid: string; ext: string };
  if (!cidValide(cid)) return false;
  if (typeof ext !== "string") return false;
  if (exts) {
    return exts.includes(ext.replace(".", ""));
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

  const estUnHoroDatage = (v: unknown): boolean => {
    if (!["number", "string"].includes(typeof v)) return false;

    const date = new Date(v as string | number);
    return !isNaN(date.valueOf());
  };

  switch (catégorie) {
    case "numérique":
      return typeof val === "number";
    case "horoDatage": {
      return estUnHoroDatage(val);
    }
    case "intervaleTemps":
      if (!Array.isArray(val)) return false;
      return (val as unknown[]).every((d) => estUnHoroDatage(d));
    case "chaîne":
      return typeof val === "string";
    case "catégorique":
      return true;
    case "booléen":
      return typeof val === "boolean";
    case "géojson":
      if (!(typeof val === "object")) return false;
      return gjv.valid(val);
    case "vidéo":
      return validFichier(val, formatsFichiers.vidéo);
    case "audio":
      return validFichier(val, formatsFichiers.audio);
    case "photo":
      return validFichier(val, formatsFichiers.images);
    case "fichier":
      return validFichier(val);
    default:
      return false;
  }
}
