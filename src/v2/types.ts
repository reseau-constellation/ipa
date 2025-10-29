export type TraducsTexte = { [langue: string]: string };

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
