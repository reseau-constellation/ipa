import { validerCatégorieVal } from "@constl/utils-ipa";
import { obtIdIndex } from "./utils.js";

import type { JSONSchemaType } from "ajv";
import type { DagCborEncodable } from "@orbitdb/core";
import type { PartielRécursif, TraducsTexte } from "@constl/interface";
import type {
  SpécificationRègleColonne,
  RègleVariable,
  ErreurDonnée,
  RègleColonne,
  RègleCatégorie,
  RègleVariableAvecId,
  RègleBornes,
  RègleValeurCatégorique,
} from "@constl/interface/règles";
import type {
  DonnéesRangéeTableau,
  DonnéesRangéeTableauAvecId,
} from "@constl/interface/tableaux";

export const schémaSpécificationRègleColonne: JSONSchemaType<
  PartielRécursif<SpécificationRègleColonne>
> & { nullable: true } = {
  type: "object",
  properties: {
    colonne: { type: "string", nullable: true },
    règle: {
      type: "object",
      properties: {
        détails: {
          type: "object",
          required: [],
          nullable: true,
        },
        type: { type: "string", nullable: true },
      },
      nullable: true,
      required: [],
    },
  },
  nullable: true,
  required: [],
};

export const règleComplète = (
  règle?: PartielRécursif<SpécificationRègleColonne>,
): règle is SpécificationRègleColonne => {
  // À faire : être plus exhaustif (peut-être avec AJV ?)
  return Boolean(règle && règle.colonne && règle.règle?.type);
};

// Fonctions

export type FonctionValidation<
  T extends DonnéesRangéeTableau = DonnéesRangéeTableau,
  R extends RègleVariable = RègleVariable,
> = (valeurs: DonnéesRangéeTableauAvecId<T>[]) => ErreurDonnée<R>[];

export function générerFonctionValidation<
  T extends DonnéesRangéeTableau,
  R extends RègleVariable,
>({
  règle,
  varsÀColonnes,
  donnéesCatégorie,
  colsIndex,
}: {
  règle: RègleColonne<R>;
  varsÀColonnes: TraducsTexte;
  donnéesCatégorie?: DagCborEncodable[];
  colsIndex: string[];
}): FonctionValidation<T, R> {
  const règleOriginale = règle.règle;
  const { colonne } = règle;
  const { type } = règleOriginale.règle;

  switch (type) {
    case "existe": {
      return (vals: DonnéesRangéeTableauAvecId<T>[]): ErreurDonnée<R>[] => {
        const nonValides = vals.filter((v) => v.données[colonne] === undefined);
        return nonValides.map((v) => {
          const { id } = v;
          const erreur: ErreurDonnée<R> = {
            id,
            erreur: règle,
          };
          return erreur;
        });
      };
    }

    case "catégorie": {
      return (vals: DonnéesRangéeTableauAvecId<T>[]) => {
        const catégorie = (règleOriginale.règle as RègleCatégorie).détails
          .catégorie;
        const nonValides = vals.filter(
          (v) => !validerCatégorieVal({ val: v.données[colonne], catégorie }),
        );
        return nonValides.map((v) => {
          const { id } = v;
          const erreur: ErreurDonnée<R> = {
            id,
            erreur: règle,
          };
          return erreur;
        });
      };
    }

    case "bornes": {
      const règleTypeBornes =
        règleOriginale as RègleVariableAvecId<RègleBornes>;

      let fComp: (v: DonnéesRangéeTableauAvecId<T>) => boolean;
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
        fComp = (v: DonnéesRangéeTableauAvecId<T>): boolean => {
          const donnéesCol = v.données[colonne];
          return Array.isArray(donnéesCol)
            ? donnéesCol.every((x) => fOp(x as number, val as number))
            : fOp(donnéesCol as number, val as number);
        };
      } else {
        fComp = (v: DonnéesRangéeTableauAvecId<T>): boolean => {
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

      return (vals: DonnéesRangéeTableauAvecId<T>[]) => {
        const nonValides = vals.filter(
          (v) => !validerBorneVal({ val: v, fComp }),
        );
        return nonValides.map((v) => {
          const { id } = v;
          const erreur: ErreurDonnée<R> = {
            id,
            erreur: règle,
          };
          return erreur;
        });
      };
    }

    case "valeurCatégorique": {
      const règleTypeCatégorique =
        règleOriginale.règle as RègleValeurCatégorique;

      const options =
        règleTypeCatégorique.détails.type === "fixe"
          ? règleTypeCatégorique.détails.options
          : donnéesCatégorie;

      if (!options) throw new Error("Options non spécifiées");

      return (vals: DonnéesRangéeTableauAvecId<T>[]) => {
        const nonValides = vals.filter(
          (v) =>
            v.données[colonne] !== undefined &&
            !options.includes(v.données[colonne]),
        );
        return nonValides.map((v) => {
          const { id } = v;
          const erreur: ErreurDonnée<R> = {
            id,
            erreur: règle,
          };
          return erreur;
        });
      };
    }

    case "indexUnique": {
      return (vals: DonnéesRangéeTableauAvecId<T>[]) => {
        const décompte = vals
          .map((v) => v.données)
          .reduce((acc: { [index: string]: number }, données) => {
            const index = obtIdIndex(données, colsIndex);
            if (index) acc[index] = (acc[index] || 0) + 1;
            return acc;
          }, {});
        const nonValides = vals.filter(
          (v) => décompte[obtIdIndex(v.données, colsIndex)] > 1,
        );
        return nonValides.map((v) => {
          const { id } = v;
          const erreur: ErreurDonnée<R> = {
            id,
            erreur: règle,
          };
          return erreur;
        });
      };
    }
    default:
      throw Error(`Catégorie ${type} inconnue.`);
  }
}

const validerBorneVal = <T extends DonnéesRangéeTableau>({
  val,
  fComp,
}: {
  val: DonnéesRangéeTableauAvecId<T>;
  fComp: (v: DonnéesRangéeTableauAvecId<T>) => boolean;
}) => {
  if (Array.isArray(val)) {
    return val.every((v) => fComp(v));
  } else {
    return fComp(val);
  }
};
