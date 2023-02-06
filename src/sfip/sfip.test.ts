import initSFIP from "@/sfip/index.js";

describe("SFIP", function () {
    test("Initialiser", async () => {
        const sfip = await initSFIP();
        console.log(sfip)
    }, 10000)
})