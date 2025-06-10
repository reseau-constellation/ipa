import {describe, bench, beforeAll, afterAll} from "@chainsafe/benchmark";
import { constellation as constlTest } from "@constl/utils-tests";
import { créerConstellation, type Constellation } from '@/index.js';
import { schémaFonctionOublier } from "@/types.js";

describe("Nuées", () => {
  let constls: Constellation[]
  let fOublier: schémaFonctionOublier;
  beforeAll(async  ()  => {
    ({clients: constls, fOublier} = await constlTest.créerConstellationsTest({n: 1,  créerConstellation}));
    await constls[0].obtIdCompte();
  })
  afterAll(async () => {
    await fOublier();
    console.log("Constellation fermée")
  })
  bench('Création nuée', async () => {
    await constls[0].nuées.créerNuée();
  });
});
