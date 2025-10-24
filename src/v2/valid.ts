import { JSONSchemaType } from "ajv";
import { PartielRécursif } from "./types.js";
import type { CatégorieVariables } from "./variables.js";

export type TypeRègle = "catégorie" | "bornes" | "valeurCatégorique" | "existe";
export type SourceRègle =
  | { type: "variable"; id: string }
  | { type: "tableau"; id: string };

export type RègleVariableAvecId<T extends RègleVariable = RègleVariable> = {
  id: string;
  règle: T;
};

export type RègleVariable =
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

export type RègleExiste = {
  typeRègle: "existe";
  détails: DétailsRègleExiste;
};

export type DétailsRègleExiste = Record<string, never>;

export type RègleBornes<T extends DétailsRègleBornes = DétailsRègleBornes> = {
  typeRègle: "bornes";
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
  typeRègle: "valeurCatégorique";
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
  tableau: string;
  colonne: string;
};

export type RègleCatégorie = {
  typeRègle: "catégorie";
  détails: DétailsRègleCatégorie;
};

export type DétailsRègleCatégorie = {
  catégorie: CatégorieVariables;
};

export const schémaRègleColonne: JSONSchemaType<
  PartielRécursif<RègleColonne>
> & { $ref: string } = {
  $ref: "règle colonne",
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
            typeRègle: { type: "string", nullable: true },
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
