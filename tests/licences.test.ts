import { expect } from "chai";

import { licences, infoLicences } from "@/licences";

describe("Licences", function () {
  it("infoLicences", () => {
    expect(infoLicences).to.be.an("object");
  });
  it("licences", () => {
    expect(licences)
      .to.be.an("array")
      .of.length(Object.keys(infoLicences).length);
  });
});
