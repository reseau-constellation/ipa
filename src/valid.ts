import { validerCatégorieVal } from "@constl/utils-ipa";
import { élémentsBd } from "@/types.js";
import type { élémentBdListeDonnées, élémentDonnées } from "@/tableaux.js";

export type Erreur<T extends règleVariable = règleVariable> = {
  règle: règleColonne<T>;
};

export type erreurValidation<T extends règleVariable = règleVariable> = {
  id: string;
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
  T extends élémentBdListeDonnées = élémentBdListeDonnées,
  R extends règleVariable = règleVariable,
> = (valeurs: élémentDonnées<T>[]) => erreurValidation<R>[];

export function générerFonctionRègle<
  T extends élémentBdListeDonnées,
  R extends règleVariable,
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
          const { id } = v;
          const erreur: erreurValidation<R> = {
            id,
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
          (v) => !validerCatégorieVal({ val: v.données[colonne], catégorie }),
        );
        return nonValides.map((v: élémentDonnées<T>) => {
          const { id } = v;
          const erreur: erreurValidation<R> = {
            id,
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
          (v) => !validerBorneVal({ val: v, fComp }),
        );
        return nonValides.map((v: élémentDonnées<T>) => {
          const { id } = v;
          const erreur: erreurValidation<R> = {
            id,
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
            !options.includes(v.données[colonne]),
        );
        return nonValides.map((v: élémentDonnées<T>) => {
          const { id } = v;
          return {
            id,
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

const validerBorneVal = <T extends élémentBdListeDonnées>({
  val,
  fComp,
}: {
  val: élémentDonnées<T>;
  fComp: (v: élémentDonnées<T>) => boolean;
}) => {
  if (Array.isArray(val)) {
    return val.every((v) => fComp(v));
  } else {
    return fComp(val);
  }
};
