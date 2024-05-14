import { configVitePress } from "./config.js";

export const obtCompilateur = async () => {
  const { Compilateur, extentions } = await import(
    "@lassi-js/kilimukku-vitepress"
  );

  const compilateur = new Compilateur({
    languePrincipale: "fr",
    languesCibles: ["த", "cst", "kaq", "हिं", "فا", "ગુ", "తె", "ಕ", "മ"],
    dossierSource: "src",
    dossierTraductions: "traducs",
    configVitePress,
    extentions: [
      new extentions.ExtentionImages({
        dossierImages: "traducsImages",
      }),
    ],
  });
  return compilateur;
};
