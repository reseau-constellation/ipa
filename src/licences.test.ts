import isArray from "lodash/isArray";

import { licences, infoLicences } from "@/licences";

describe("Licences", function () {
  it("licences", () => {
    expect(isArray(licences)).toBe(true);
    expect(licences).toHaveLength(Object.keys(infoLicences).length);
  });
});
