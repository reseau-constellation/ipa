import type { Oublier } from "./v2/crabe/types.js";


export type schémaRetourFonctionRechercheParProfondeur = {
  fOublier: Oublier;
  fChangerProfondeur: (p: number) => Promise<void>;
};
