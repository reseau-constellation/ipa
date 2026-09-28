import axios from "axios";
import type { ÉlémentDicJSON } from "./json.js";

export const importerDonnéesOmekaS = async ({
  instance,
}: {
  instance: string;
}): Promise<ÉlémentDicJSON[]> => {
  const urlBase = `${instance}/api/items/`;
  const réponseBase = await axios.get(urlBase);
  const liens: string = réponseBase.headers["Link"];

  // Format `Link`
  /* <https://ifp-s-intg.inist.fr/api/items?sort_by=id&sort_order=asc&page=1>; rel="first", <https://ifp-s-intg.inist.fr/api/items?sort_by=id&sort_order=asc&page=2>; rel="next", <https://ifp-s-intg.inist.fr/api/items?sort_by=id&sort_order=asc&page=1115>; rel="last"*/
  const nPages = Number(
    liens.slice(liens.lastIndexOf("&page=") + 6).replace('>; rel="last"', ""),
  );

  let données: ÉlémentDicJSON[] = [];
  for (const i in Array(nPages).keys()) {
    const urlPage = `${instance}/api/items?page=${i + 1}`;
    données = [...données, ...(await axios.get(urlPage)).data];
  }
  return données;
};
