import {describe, bench, beforeAll, afterAll} from "@chainsafe/benchmark";
import { constellation as constlTest } from "@constl/utils-tests";
import { type Constellation, créerConstellation } from '@/index.js';
import { schémaFonctionOublier } from "@/types.js";

describe("Bds", () => {
  let constls: Constellation[]
  let fOublier: schémaFonctionOublier;
  beforeAll(async  ()  => {
    ({clients: constls, fOublier} = await constlTest.créerConstellationsTest({n: 1,  créerConstellation}));
    await constls[0].obtIdCompte();
  })
  afterAll(async () => {
    await fOublier();
  })

  bench('Création bd', async () => {
    await constls[0].bds.créerBd({licence: "ODbl-1_0"});
  });
  bench({
    id: 'Ajouter nom bd',
    beforeEach: async () => await constls[0].bds.créerBd({licence: "ODbl-1_0"}),
    fn: async (idBd: string) => {
      await constls[0].bds.sauvegarderNomBd({idBd, nom: "Hydrologie", langue: 'fra'});
    }
  })
});
