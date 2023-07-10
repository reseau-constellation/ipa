

import { licences, infoLicences } from "@/licences.js";

import {expect} from "aegir/chai";


describe("Licences", function () {
  it("licences", () => {
    expect(Array.isArray(licences)).to.be.true();
    expect(licences.length).to.equal(Object.keys(infoLicences).length);
  });
});
