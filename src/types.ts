import { JSONSchemaType } from "ajv";
import type { Oublier } from "./v2/crabe/types.js";
import type { objRôles } from "@/accès/types.js";
import type { Constellation } from "@/client.js";

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
