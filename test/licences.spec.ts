import {
  attente,
  constellation as utilsTestConstellation,
} from "@constl/utils-tests";
import { expect } from "aegir/chai";
import { type InfoLicence, infoLicences, licences } from "@/licences.js";
import { schémaFonctionOublier } from "@/types.js";
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

    const fsOublier: schémaFonctionOublier[] = [];
    const licencesSuivies = new attente.AttendreRésultat<{
      [licence: string]: InfoLicence;
    }>();

    before(async () => {
      ({ fOublier: fOublierClients, clients } = await créerConstellationsTest({
        n: 1,
        créerConstellation,
      }));
      client = clients[0];
    });

    after(async () => {
      if (fOublierClients) await fOublierClients();
      await Promise.allSettled(fsOublier.map((f) => f()));
    });

    it("licences dynamiques", async () => {
      const fOublier = await client.licences.suivreLicences({
        f: (x) => {
          console.log("ahah", Object.keys(x).length);
          licencesSuivies.mettreÀJour(x);
        },
      });
      fsOublier.push(fOublier);

      const val = await licencesSuivies.attendreExiste();
      expect(Object.keys(val).length).to.be.gt(0);
    });
  });
});
