import axios from "axios";
import type { ÉlémentDicJSON } from "./json.js";

export const importerDonnéesEpiCollecte = async ({
  idProjet,
  instance = "https://five.epicollect.net",
}: {
  idProjet: string;
  instance: string;
}): Promise<ÉlémentDicJSON[]> => {
  const urlBase = `${instance}/api/export/entries/${idProjet}`;
  const réponseBase = (await axios.get(urlBase)).data;
  const nPages = réponseBase["meta"]["last_page"];
  let données: ÉlémentDicJSON[] = [];
  for (const i in Array(nPages).keys()) {
    const urlPage = `${instance}/api/export/entries/${idProjet}?page=${i + 1}`;
    données = [
      ...données,
      ...(await axios.get(urlPage)).data["data"]["entries"],
    ];
  }
  return données;
};
