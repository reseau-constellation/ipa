import { obtCompilateur } from "./compilateur.js";
import { générerPrisesDÉcran } from "./images/index.js";

(async () => {
  const compilateur = await obtCompilateur();
  await générerPrisesDÉcran({
    langueSource: compilateur.languePrincipale,
    langues: compilateur.languesCibles,
    dossierRacine: "./src",
    dossierOriginales: "images/prisesdÉcran",
    dossierTraduites: "traducsImages",
  });
})();
