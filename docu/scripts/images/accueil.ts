import { Nuchabäl } from "nuchabal";
import {
  changerLangue,
  déjàGénérés,
  optsPrises,
  ouvrirConstellation,
  type schémaFObtCheminImage,
} from "./utils.js";
import type { Browser } from "playwright";

const nuchabäl = new Nuchabäl({});

export const prisesAccueil = async ({
  langue,
  navigateur,
  obtCheminImage,
}: {
  langue: string;
  navigateur: Browser;
  obtCheminImage: schémaFObtCheminImage;
}) => {
  if (
    déjàGénérés({
      images: ["pageAccueil.png", "changerLangue.png"],
      langue,
      obtCheminImage,
    })
  )
    return;

  console.log("Génération prises accueil : ", langue);

  const page = await navigateur.newPage();

  await ouvrirConstellation({ page });

  await changerLangue({ page, langue });

  await page.screenshot({
    path: obtCheminImage({ nomImage: "pageAccueil.png", langue }),
    ...optsPrises,
  });

  const btnLangues = await page.waitForSelector(".mdi-earth");
  await btnLangues.click();

  const nomLangue = nuchabäl.rubiChabäl({ runuk: langue });
  if (nomLangue) {
    await page.getByText(nomLangue).waitFor();
    await page.getByText(nomLangue).hover();

    await page.screenshot({
      path: obtCheminImage({ nomImage: "changerLangue.png", langue }),
      ...optsPrises,
    });
  }
};
