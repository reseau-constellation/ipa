import type { Rôle } from "./nébuleuse/services/compte/accès/types.js";
import type { DagCborEncodable } from "@orbitdb/core";

export type TraducsTexte = { [langue: string]: string };
export type SansNonDéfinis<T> = { [C in keyof T]: Exclude<T[C], undefined> };

export type PartielRécursif<T> = {
  [P in keyof T]?: T[P] extends object ? PartielRécursif<T[P]> : T[P];
};

export type RequisRécursif<T> = {
  [P in keyof T]-?: T[P] extends object ? RequisRécursif<T[P]> : T[P];
};

export type TYPES_STATUT = "interne" | "jouet" | "active" | "obsolète";

export type StatutDonnées =
  | {
      statut: Exclude<TYPES_STATUT, "obsolète">;
    }
  | {
      statut: "obsolète";
      idNouvelle?: string;
    };

export const statutComplet = (
  statut?: PartielRécursif<StatutDonnées>,
): statut is StatutDonnées => {
  return statut?.statut !== undefined;
};

export type Métadonnées = { [clef: string]: DagCborEncodable };

export type InfoAuteur = {
  idCompte: string;
  accepté: boolean;
  rôle: Rôle;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Asynchronifier<T extends (...args: any[]) => any> = (
  ...args: Parameters<T>
) => Promise<ReturnType<T>>;

export type Mandatairifier<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [C in keyof T]: T[C] extends (args: any) => Promise<any>
    ? T[C]
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      T[C] extends (args: any) => any
      ? Asynchronifier<T[C]>
      : T[C] extends object
        ? Mandatairifier<T[C]>
        : never;
};
