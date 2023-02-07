import initSFIP from "@/sfip/index.js";

describe("SFIP", function () {
  test("Initialiser", async () => {
    const sfip = await initSFIP();
    console.log((await sfip.id()).id.toCID().toString());
  }, 10000);
});
