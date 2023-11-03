import { cidValide } from "@constl/utils-ipa";
import { expect } from "aegir/chai";

describe("Utils : SFIP", function () {
  describe("cidValide", function () {
    it("valide", () => {
      const valide = cidValide(
        "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ",
      );
      expect(valide).to.be.true();
    });
    it("non valide", () => {
      const valide = cidValide("Bonjour, je ne suis pas un IDC.");
      expect(valide).to.be.false();
    });
  });
});
