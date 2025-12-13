import { expect } from "aegir/chai";
import { MEMBRE } from "@/v2/crabe/services/compte/accès/consts.js";
import { créerConstellationsTest, obtenir } from "./utils.js";
import type { Constellation } from "@/v2/index.js";
import type { Oublier } from "@/v2/crabe/types.js";

describe("Réseau Constellation", async () => {
  let constls: Constellation[];
  let fermer: Oublier;

  let idsComptes: string[];

  before(async () => {
    ({ constls, fermer } = await créerConstellationsTest({ n: 3 }));

    idsComptes = await Promise.all(constls.map((c) => c.compte.obtIdCompte()));
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("confiance automatique", function () {
    let idMotClef: string;

    before(async () => {
      idMotClef = await constls[0].motsClefs.créerMotClef();
    });

    it("co-autorat objet - détecté sur le propriétaire de l'objet", async () => {
      const pConfiance = obtenir<number>(({ si }) =>
        constls[0].réseau.suivreConfianceCompte({
          idCompte: idsComptes[1],
          f: si((x) => !!x && x !== 0),
        }),
      );
      await constls[0].motsClefs.inviterAuteur({
        idMotClef,
        idCompte: idsComptes[1],
        rôle: MEMBRE,
      });
      const confiance = await pConfiance;

      expect(confiance).to.be.greaterThan(0);
    });

    it("co-autorat objet - non détecté sur un autre compte", async () => {});

    it("co-autorat objet - acceptation invitation", async () => {});
  });
});
