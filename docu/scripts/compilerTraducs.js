const { Compilateur } = require("./traducsVitepress/dist/index.js");
const { configVitePress } = require("./config.js");

/** @type Compilateur */
const compilateur = new Compilateur({
  languePrincipale: "fr",
  languesCibles: ["த", "es", "kaq", "ខ្មែរ", "हिं", "فا", "ગુ", "తె"],
  dossierSource: "src",
  dossierTraductions: "traducs",
  configVitePress,
});

(async () => {
  await compilateur.mettreFichiersTraducsÀJour();
  await compilateur.compiler();
  compilateur.ajusterGitIgnore();
})();
