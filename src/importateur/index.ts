import XLSX from "xlsx";

import { DonnéesJSON } from "./json";

export async function importerJSONdURL(url: string): Promise<DonnéesJSON> {
  const réponse = await fetch(url);
  return await réponse.json();
}

export async function importerFeuilleCalculDURL(
  url: string,
  modDePasse?: string
): Promise<XLSX.WorkBook> {
  const réponse = await fetch(url);
  const données = await réponse.arrayBuffer();
  return XLSX.read(données, {
    type: "array",
    cellDates: true,
    password: modDePasse,
  });
}
