import { chromium } from "playwright";

import { générerFObtCheminImage } from "./utils.js";

import { prisesAccueil } from "./accueil.js";

export const générerPrisesDÉcran = async ({
  langues,
  langueSource,
  dossierRacine,
  dossierOriginales,
  dossierTraduites,
}: {
  langues: string[];
  langueSource: string;
  dossierRacine: string;
  dossierOriginales: string;
  dossierTraduites: string;
}) => {
  const navigateur = await chromium.launch();
  const obtCheminImage = générerFObtCheminImage({
    langueSource,
    dossierRacine,
    dossierOriginales,
    dossierTraduites,
  });

  for (const langue of [langueSource, ...langues]) {
    await prisesAccueil({ langue, navigateur, obtCheminImage });
    // await prisesCréationCompte({ langue, navigateur, obtCheminImage });
  }
  await navigateur.close();
};
