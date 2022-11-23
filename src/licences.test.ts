import isArray from "lodash/isArray";

import { licences, infoLicences } from "@/licences.js";

describe("Licences", function () {
  test("licences", () => {
    expect(isArray(licences)).toBe(true);
    expect(licences).toHaveLength(Object.keys(infoLicences).length);
  });
});
