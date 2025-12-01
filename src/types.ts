import type { Oublier } from "./v2/crabe/types.js";

// https://hackernoon.com/mastering-type-safe-json-serialization-in-typescript
type PrimitifJson = string | number | boolean | null | undefined;
export type Jsonifiable =
  | PrimitifJson
  | Jsonifiable[]
  | {
      [key: string]: Jsonifiable;
    };

export type schémaRetourFonctionRechercheParProfondeur = {
  fOublier: Oublier;
  fChangerProfondeur: (p: number) => Promise<void>;
};
