import { WorkBook, read as readXLSX } from "xlsx";
import axios from "axios";

import { DonnéesJSON } from "./json.js";

export async function importerJSONdURL(url: string): Promise<DonnéesJSON> {
  const réponse = await axios.get(url);
  return (await réponse.data) as DonnéesJSON;
}

export async function importerFeuilleCalculDURL(
  url: string,
  modDePasse?: string
): Promise<WorkBook> {
  const réponse = await axios.get<string>(url, { responseType: "arraybuffer" });
  const données = réponse.data;

  return readXLSX(données, {
    type: "buffer",
    cellDates: true,
    password: modDePasse,
  });
}
