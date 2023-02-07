import initSFIP from "../src/sfip/index.js";
import { expect } from "aegir/chai";
import type { IPFS } from "ipfs";

describe("SFIP", function () {
  let sfip: IPFS;
  // @ts-ignore
  before(async () => {
    sfip = await initSFIP();
  });
  it("Initialiser", async () => {
    const id = await sfip.id();
    expect(id.id.toCID().toString()).to.be.a.string;
  }, 10000);
  afterEach(async () => {
    await sfip.stop();
  });
});
