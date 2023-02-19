const {
  extraireTraductiblesProjet,
  compilerTraductions,
  ajusterGitIgnore,
} = require("./compilateurTraducs.js");

(async () => {
  await extraireTraductiblesProjet();
  await compilerTraductions();
  ajusterGitIgnore();
})();
