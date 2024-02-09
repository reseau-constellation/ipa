import { isElectronMain, isNode } from "wherearewe";
import axios, { AxiosRequestConfig } from "axios";

export const obtRessourceTest = async ({
  nomFichier,
  optsAxios,
}: {
  nomFichier: string;
  optsAxios?: AxiosRequestConfig;
}) => {
  if (isNode || isElectronMain) {
    const fs = await import("fs");
    const path = await import("path");
    const url = await import("url");

    const ext = nomFichier.split(".").pop();

    const cheminFichier = path.join(
      url
        .fileURLToPath(new URL(".", import.meta.url))
        .replace("dist" + path.sep, ""),
      nomFichier,
    );

    const rés = fs.readFileSync(cheminFichier);
    if (ext === "json") {
      return JSON.parse(rés.toString());
    }
    return rés;
  } else {
    const rés = await axios.get(
      `http://localhost:3000/fichier/${encodeURIComponent(nomFichier)}`,
      optsAxios,
    );
    return typeof rés.data === "string"
      ? new TextEncoder().encode(rés.data)
      : rés.data;
  }
};
