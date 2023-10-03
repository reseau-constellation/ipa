import { configVitePress } from "./config.js";

export const obtCompilateur = async () => {
  const { Compilateur } = await import("./traducsVitepress/dist/index.js");
  const { ExtentionImages } = await import(
    "./traducsVitepress/dist/extentions/images.js"
  );

  const compilateur = new Compilateur({
    languePrincipale: "fr",
    languesCibles: ["த", "cst", "kaq", "हिं", "فا", "ગુ", "తె"],
    dossierSource: "src",
    dossierTraductions: "traducs",
    configVitePress,
    extentions: [
      new ExtentionImages({
        dossierImages: "traducsImages",
      }),
    ],
  });
  return compilateur;
};
