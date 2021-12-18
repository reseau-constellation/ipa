import { WorkBook, read as readXLSX } from "xlsx";

import { DonnéesJSON } from "./json";

export async function importerJSONdURL(url: string): Promise<DonnéesJSON> {
  const réponse = await fetch(url);
  return await réponse.json();
}

export async function importerFeuilleCalculDURL(
  url: string,
  modDePasse?: string
): Promise<WorkBook> {
  const réponse = await fetch(url);
  const données = await réponse.arrayBuffer();
  return readXLSX(données, {
    type: "array",
    cellDates: true,
    password: modDePasse,
  });
}
