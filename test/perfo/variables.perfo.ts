import {describe, bench, beforeAll, afterAll} from "@chainsafe/benchmark";
import { constellation as constlTest } from "@constl/utils-tests";

import { type Constellation, créerConstellation } from '@/index.js';
import { schémaFonctionOublier } from "@/types.js";

describe("Variables", () => {
  let constls: Constellation[]
  let fOublier: schémaFonctionOublier;
  beforeAll(async  ()  => {
    ({clients: constls, fOublier} = await constlTest.créerConstellationsTest({n: 1,  créerConstellation}));
    await constls[0].obtIdCompte();
  })
  afterAll(async () => {
    await fOublier();
  })
  bench('Création variable', async () => {
    await constls[0].variables.créerVariable({catégorie: "audio"});
  });
  bench({
    id: 'Ajouter nom variable',
    beforeEach: async () => await constls[0].variables.créerVariable({catégorie: "numérique"}),
    fn: async (idVariable: string) => {
      await constls[0].variables.sauvegarderNomVariable({idVariable, nom: "Précipitation", langue: 'fra'});
    }
  })
});
