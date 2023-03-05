import { configVitePress } from "./config.js";


export const obtCompilateur = async () => {
    const { Compilateur } = await import("./traducsVitepress/dist/index.js");

    const compilateur = new Compilateur({
        languePrincipale: "fr",
        languesCibles: ["த", "es", "kaq", "ខ្មែរ", "हिं", "فا", "ગુ", "తె"],
        dossierSource: "src",
        dossierTraductions: "traducs",
        configVitePress,
    });
    return compilateur
}