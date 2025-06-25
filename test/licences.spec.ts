import { constellation as utilsTestConstellation } from "@constl/utils-tests";
import { expect } from "aegir/chai";
import { obtenir } from "@constl/utils-ipa";
import { type InfoLicence, infoLicences, licences } from "@/licences.js";
import { créerConstellation } from "@/index.js";
import type { Constellation } from "@/client.js";

const { créerConstellationsTest } = utilsTestConstellation;

describe("Licences", function () {
  it("licences statiques", () => {
    expect(Array.isArray(licences)).to.be.true();
    expect(licences.length).to.equal(Object.keys(infoLicences).length);
  });

  describe("licences dynamiques", function () {
    let fOublierClients: () => Promise<void>;
    let clients: Constellation[];
    let client: Constellation;

    before(async () => {
      ({ fOublier: fOublierClients, clients } = await créerConstellationsTest({
        n: 1,
        créerConstellation,
      }));
      client = clients[0];
    });

    after(async () => {
      if (fOublierClients) await fOublierClients();
    });

    it("licences dynamiques", async () => {
      const licencesDynamiques = await obtenir<{
        [licence: string]: InfoLicence;
      }>(({ siDéfini }) =>
        client.licences.suivreLicences({
          f: siDéfini(),
        }),
      );

      expect(Object.keys(licencesDynamiques).length).to.be.gt(0);
    });
  });
});
