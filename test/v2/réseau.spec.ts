import { expect } from "aegir/chai";
import { MEMBRE } from "@/v2/nébuleuse/services/compte/accès/consts.js";
import { créerConstellationsTest, obtenir } from "./utils.js";
import type { Constellation } from "@/v2/index.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";

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

    it("co-autorat objet", async () => {
      const pConfiance = obtenir<number>(({ si }) =>
        constls[0].réseau
          .suivreConfianceCompte({
            idCompte: idsComptes[1],
            f: si((x) => !!x && x !== 0),
          })
          .then(({ oublier }) => oublier),
      );
      await constls[0].motsClefs.inviterAuteur({
        idMotClef,
        idCompte: idsComptes[1],
        rôle: MEMBRE,
      });
      const confiance = await pConfiance;

      expect(confiance).to.be.greaterThan(0);
    });

    it("co-autorat objet - détection sur un autre compte", async () => {
      const confiance = await obtenir<number>(({ si }) =>
        constls[2].réseau
          .suivreConfianceCompte({
            idCompte: idsComptes[1],
            idCompteDépart: idsComptes[0],
            f: si((x) => !!x && x !== 0),
          })
          .then(({ oublier }) => oublier),
      );

      expect(confiance).to.be.greaterThan(0);
    });
  });
});
