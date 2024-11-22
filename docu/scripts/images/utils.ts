import fs from "fs";
import path from "path";
import { Nuchabäl } from "nuchabal";
import type { Page, PageScreenshotOptions } from "playwright";

const nuchabäl = new Nuchabäl({});

export const optsPrises: Partial<PageScreenshotOptions> = {
  scale: "css",
  animations: "disabled",
};

export type schémaFObtCheminImage = ({
  nomImage,
  langue,
}: {
  nomImage: string;
  langue: string;
}) => string;

export const générerFObtCheminImage = ({
  dossierRacine,
  dossierOriginales,
  dossierTraduites,
  langueSource,
}: {
  dossierRacine: string;
  dossierOriginales: string;
  dossierTraduites: string;
  langueSource: string;
}): schémaFObtCheminImage => {
  return ({
    nomImage,
    langue,
  }: {
    nomImage: string;
    langue: string;
  }): string => {
    if (langue === langueSource)
      return path.join(dossierRacine, dossierOriginales, nomImage);
    else
      return path.join(dossierTraduites, langue, dossierOriginales, nomImage);
  };
};

export const déjàGénérés = ({
  images,
  langue,
  obtCheminImage,
}: {
  images: string[];
  langue: string;
  obtCheminImage: schémaFObtCheminImage;
}) => {
  const fichiers = images.map((nomImage) =>
    obtCheminImage({ nomImage, langue }),
  );
  return fichiers.every((fichier) => fs.existsSync(fichier));
};

export const ouvrirConstellation = async ({ page }: { page: Page }) => {
  await page.goto("https://appli.réseau-constellation.ca");
  await page.getByRole("button", { name: /démarrer/i }).waitFor();
};

export const changerLangue = async ({
  langue,
  page,
}: {
  langue: string;
  page: Page;
}) => {
  const nomLangue = nuchabäl.rubiChabäl({ runuk: langue });

  const btnLangues = await page.waitForSelector(".mdi-earth");
  await btnLangues.click();

  if (nomLangue) {
    // Donner 3 secondes maximum (si la langue n'est pas encore disponible, on ne la trouvera pas)
    await new Promise<void>((résoudre) => {
      const chrono = setTimeout(résoudre, 3000);
      page
        .getByText(nomLangue)
        .click()
        .then(() => {
          clearTimeout(chrono);
          résoudre();
        });
    });

    // Attendre que le menu disparaisse
    await page.waitForSelector(".v-list", { state: "hidden" });
  }
};

export const créerCompte = async ({ page }: { page: Page }) => {
  await page.getByRole("button", { name: /démarrer/i }).click();
  // Attendre modal ouvert
  // Créer nouveau compte
  // Ajouter nom
  // ...
};
