import { obtCompilateur } from "./compilateur.js";
import { générerPrisesDÉcran } from "./images/dist/index.js"

(async () => {
  const compilateur = await obtCompilateur();
  await générerPrisesDÉcran({ 
    langueSource: compilateur.languePrincipale, 
    langues: compilateur.languesCibles,
    dossierRacine: "./src",
    dossierOriginales: "images/prisesdÉcran",
    dossierTraduites: "traducsImages"
  });
  await compilateur.mettreFichiersTraducsÀJour();
  await compilateur.compiler();
  compilateur.ajusterGitIgnore();
})();
