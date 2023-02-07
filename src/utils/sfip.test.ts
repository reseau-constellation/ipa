import { cidValide } from "@/utils/index.js";

describe("Utils", function () {
  describe("cidValide", function () {
    test("valide", () => {
      const valide = cidValide(
        "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ"
      );
      expect(valide).toBe(true);
    });
    test("non valide", () => {
      const valide = cidValide("Bonjour, je ne suis pas un IDC.");
      expect(valide).toBe(false);
    });
  });
});
