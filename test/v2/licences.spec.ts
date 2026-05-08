import { expect } from "aegir/chai";
import { type InfoLicence, infoLicences, licences } from "@/v2/licences.js";
import { créerConstellationsTest, obtenir } from "./utils.js";
import type { Constellation } from "@/v2/index.js";

describe("Licences", function () {
  it("licences statiques", () => {
    expect(Array.isArray(licences)).to.be.true();
    expect(licences.length).to.equal(Object.keys(infoLicences).length);
  });

  describe("licences dynamiques", function () {
    let fermer: () => Promise<void>;
    let constls: Constellation[];
    let constl: Constellation;

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 1,
      }));
      constl = constls[0];
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("licences dynamiques", async () => {
      const licencesDynamiques = await obtenir<{
        [licence: string]: InfoLicence;
      }>(({ siDéfini }) =>
        constl.licences.suivreLicences({
          f: siDéfini(),
        }),
      );

      expect(Object.keys(licencesDynamiques).length).to.be.gt(0);
    });
  });
});
