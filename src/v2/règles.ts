import { JSONSchemaType } from "ajv";
import { PartielRécursif } from "./types.js";
import type { CatégorieVariables } from "./variables.js";

export type type = "catégorie" | "bornes" | "valeurCatégorique" | "existe";
export type SourceRègle =
  | { type: "variable"; id: string }
  | { type: "tableau"; id: string };

export type RègleVariableAvecId<T extends RègleVariable = RègleVariable> = {
  id: string;
  règle: T;
};

export type RègleVariable =
  | RègleIndexUnique
  | RègleExiste
  | RègleBornes
  | RègleValeurCatégorique
  | RègleCatégorie;

export type RègleColonne<T extends RègleVariable = RègleVariable> = {
  règle: RègleVariableAvecId<T>;
  source: SourceRègle;
  colonne: string;
};

export type Op = ">" | "<" | ">=" | "<=" | "≥" | "≤";

export type RègleIndexUnique = {
  type: "indexUnique"
}

export type RègleExiste = {
  type: "existe";
  détails: DétailsRègleExiste;
};

export type DétailsRègleExiste = Record<string, never>;

export type RègleBornes<T extends DétailsRègleBornes = DétailsRègleBornes> = {
  type: "bornes";
  détails: T;
};

// Peut être numérique ou bien l'id d'une autre variable ou l'id d'une colonne sur la même BD ou Nuée
export type DétailsRègleBornes =
  | DétailsRègleBornesFixe
  | DétailsRègleBornesDynamiqueColonne
  | DétailsRègleBornesDynamiqueVariable;

export type DétailsRègleBornesFixe = {
  type: "fixe";
  val: number;
  op: Op;
};

export type DétailsRègleBornesDynamiqueColonne = {
  type: "dynamiqueColonne";
  val: string;
  op: Op;
};

export type DétailsRègleBornesDynamiqueVariable = {
  type: "dynamiqueVariable";
  val: string;
  op: Op;
};

export type RègleValeurCatégorique<
  T extends DétailsRègleValeurCatégorique = DétailsRègleValeurCatégorique,
> = {
  type: "valeurCatégorique";
  détails: T;
};

export type DétailsRègleValeurCatégorique =
  | DétailsRègleValeurCatégoriqueFixe
  | DétailsRègleValeurCatégoriqueDynamique;

export type DétailsRègleValeurCatégoriqueFixe = {
  type: "fixe";
  options: (string | number | boolean)[];
};

export type DétailsRègleValeurCatégoriqueDynamique = {
  type: "dynamique";
  structure: string;
  tableau: string;
  colonne: string;
};

export type RègleCatégorie = {
  type: "catégorie";
  détails: DétailsRègleCatégorie;
};

export type DétailsRègleCatégorie = {
  catégorie: CatégorieVariables;
};

export const schémaRègleColonne: JSONSchemaType<
  PartielRécursif<RègleColonne>
> & { nullable: true } = {
  type: "object",
  properties: {
    colonne: { type: "string", nullable: true },
    source: {
      type: "object",
      properties: {
        id: { type: "string", nullable: true },
        type: { type: "string", nullable: true },
      },
      nullable: true,
      required: [],
    },
    règle: {
      type: "object",
      properties: {
        id: { type: "string", nullable: true },
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
    },
  },
  nullable: true,
  required: [],
};


// Erreurs

export type ErreurColonne = ErreurColonneVariableDédoublée;
export type ErreurColonneVariableDédoublée = {
  type: "variableDédoublée";
  colonnes: string[];
}

export type ErreurDonnée<T extends RègleVariable = RègleVariable> = {
  id: string;
  erreur: RègleColonne<T>;
};

export type ErreurRègle =
  | ErreurRègleCatégoriqueColonneInexistante
  | ErreurRègleBornesColonneInexistante
  | ErreurRègleBornesVariableNonPrésente;

export type ErreurRègleCatégoriqueColonneInexistante = {
  règle: RègleColonne<
    RègleValeurCatégorique<DétailsRègleValeurCatégoriqueDynamique>
  >;
  type: "colonneCatégInexistante";
};

export type ErreurRègleBornesColonneInexistante = {
  règle: RègleColonne<RègleBornes<DétailsRègleBornesDynamiqueColonne>>;
  type: "colonneBornesInexistante";
};

export type ErreurRègleBornesVariableNonPrésente = {
  règle: RègleColonne<RègleBornes<DétailsRègleBornesDynamiqueVariable>>;
  type: "variableBornesNonPrésente";
};

// Fonctions


export type FonctionValidation<
  T extends élémentBdListeDonnées = élémentBdListeDonnées,
  R extends RègleVariable = RègleVariable,
> = (valeurs: élémentDonnées<T>[]) => ErreurDonnée<R>[];

export function générerFonctionValidation<
  T extends élémentBdListeDonnées,
  R extends RègleVariable,
>({
  règle,
  varsÀColonnes,
  donnéesCatégorie,
}: {
  règle: RègleColonne<R>;
  varsÀColonnes: { [key: string]: string };
  donnéesCatégorie?: élémentsBd[];
}): FonctionValidation<T, R> {
  const règleOriginale = règle.règle;
  const { colonne } = règle;
  const { type } = règleOriginale.règle;

  switch (type) {
    case "existe": {
      return (vals: élémentDonnées<T>[]): ErreurDonnée<R>[] => {
        const nonValides = vals.filter((v) => v.données[colonne] === undefined);
        return nonValides.map((v: élémentDonnées<T>) => {
          const { id } = v;
          const erreur: ErreurDonnée<R> = {
            id,
            erreur: { règle },
          };
          return erreur;
        });
      };
    }

    case "catégorie": {
      return (vals: élémentDonnées<T>[]) => {
        const catégorie = (règleOriginale.règle as RègleCatégorie).détails
          .catégorie;
        const nonValides = vals.filter(
          (v) => !validerCatégorieVal({ val: v.données[colonne], catégorie }),
        );
        return nonValides.map((v: élémentDonnées<T>) => {
          const { id } = v;
          const erreur: ErreurDonnée<R> = {
            id,
            erreur: { règle },
          };
          return erreur;
        });
      };
    }

    case "bornes": {
      const règleTypeBornes =
        règleOriginale as RègleVariableAvecId<RègleBornes>;

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
          const erreur: ErreurDonnée<R> = {
            id,
            erreur: { règle },
          };
          return erreur;
        });
      };
    }

    case "valeurCatégorique": {
      const règleTypeCatégorique =
        règleOriginale.règle as règleValeurCatégorique;

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
    case "indexUnique": {
      return (vals: élémentDonnées<T>[]): ErreurDonnée<RègleIndexUnique>[] => {
        const décompte = (colonnes).map(c=>c.variable).reduce((acc: {[idVar: string]: number}, idVariable) => {
          if (idVariable) acc[idVariable] = (acc[idVariable] || 0) + 1;
          return acc;
        }, {});
        const nonValides = vals.filter((v) => v.données[colonne] === undefined);
        return nonValides.map((v: élémentDonnées<T>) => {
          const { id } = v;
          const erreur: ErreurDonnée<RègleIndexUnique> = {
            id,
            erreur: { règle },
          };
          return erreur;
        });
      };
    }
    default:
      throw Error(`Catégorie ${type} inconnue.`);
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
