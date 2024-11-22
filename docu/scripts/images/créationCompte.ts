import {
  changerLangue,
  déjàGénérés,
  optsPrises,
  ouvrirConstellation,
  type schémaFObtCheminImage,
} from "./utils.js";
import type { Browser } from "playwright";

export const prisesCréationCompte = async ({
  langue,
  navigateur,
  obtCheminImage,
}: {
  langue: string;
  navigateur: Browser;
  obtCheminImage: schémaFObtCheminImage;
}) => {
  if (déjàGénérés({ images: ["nouveauCompte.png"], langue, obtCheminImage }))
    return;

  console.log("Génération prises création compte : ", langue);

  const page = await navigateur.newPage();

  await ouvrirConstellation({ page });

  await changerLangue({ page, langue });

  (await page.waitForSelector(".v-btn--variant-outlined")).click();

  // const btnNouveauCompte = await page.waitForSelector(".bg-primary")
  // btnNouveauCompte.click();
  await page.screenshot({
    path: obtCheminImage({ nomImage: "nouveauCompte.png", langue }),
    ...optsPrises,
  });
};
