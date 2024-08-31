// node dist/src/tempo.js

import { créerConstellation } from "@/index";
import { rmSync } from "fs";

const constellation = créerConstellation({ dossier: "./test-tempo" });

const attendre = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  console.log("on attend");
  await attendre(15000);
  console.log("on a attendu");

  let avant = Date.now();
  for (const i in [...Array(50).keys()]) {
    await constellation.bds.créerBd({ licence: "ODbl-1_0" });
    const après = Date.now();
    console.log(i, après - avant);
    avant = après;
  }
  await constellation.fermer();
  rmSync("./test-tempo", { recursive: true });
})();
