import { expect } from "aegir/chai";
import { infoLicences, licences } from "@/licences.js";

describe("Licences", function () {
  it("licences", () => {
    expect(Array.isArray(licences)).to.be.true();
    expect(licences.length).to.equal(Object.keys(infoLicences).length);
  });
});
