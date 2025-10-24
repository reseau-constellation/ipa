import { créerConstellationsTest } from "@constl/utils-tests";
import { expect } from "aegir/chai";
import { Constellation } from "@/v2/constellation.js";
import { créerConstellation } from "@/v2/index.js";

describe("Constellation", function () {
  describe("création", function () {
    let fermer: () => Promise<void>;
    let constls: Constellation[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
        créerConstellation,
      }));
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("démarrage", async () => {
      expect(constls[0].estDémarrée).to.not.be.false();

      expect(Object.values(constls[0].services).every((s) => s.estDémarré));
    });

    it("fermeture", async () => {
      await constls[0].fermer();
      expect(Object.values(constls[0].services).every((s) => !s.estDémarré));
    });
  });
});
