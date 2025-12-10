export type Suivi<T> = (x: T) => void | Promise<void>;

export type Oublier = () => Promise<void>;

export type RetourRecherche = { oublier: Oublier; n: (n: number) => void };

export type RetourRechercheProfondeur = {
  oublier: Oublier;
  profondeur: (p: number) => Promise<void>;
};

// https://hackernoon.com/mastering-type-safe-json-serialization-in-typescript
type PrimitifJson = string | number | boolean | null | undefined;
export type Jsonifiable =
  | PrimitifJson
  | Jsonifiable[]
  | {
      [key: string]: Jsonifiable;
    };
