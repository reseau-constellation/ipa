import { expect } from "aegir/chai";
import { Constellation } from "@/v2/constellation.js";
import { créerConstellationsTest } from "./utils.js";

describe.only("Constellation", function () {
  describe("création", function () {
    let fermer: () => Promise<void>;
    let constls: Constellation[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
      }));
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("démarrage", async () => {
      expect(constls[0].estDémarrée).to.not.be.false();

      expect(Object.values(constls[0].services).every((s) => s.estDémarré));
    });

    it("instances de Constellation test non connectées au relai production", async () => {
      const libp2p = await constls[0].services["libp2p"].libp2p();
      const connexions = libp2p.getConnections();

      expect(connexions.filter(c=>c.remoteAddr.getComponents().find(a=>a.name.includes('ip')))).to.not.be.empty();
      expect(connexions.filter(c=>c.remoteAddr.getComponents().find(a=>a.name.includes('dns')))).to.be.empty();
    })

    it("fermeture", async () => {
      await constls[0].fermer();
      expect(Object.values(constls[0].services).every((s) => !s.estDémarré));
    });
  });
});
