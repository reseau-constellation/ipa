import { obtCompilateur } from "./compilateur.js";

(async () => {
  const compilateur = await obtCompilateur();
  await compilateur.mettreFichiersTraducsÀJour();
  await compilateur.compiler();
  compilateur.ajusterGitIgnore();
})();
