import { WorkBook, read as readXLSX, ParsingOptions } from "xlsx";
import axios from "axios";

import type { DonnéesJSON } from "./json.js";

export async function importerJSONdURL(url: string): Promise<DonnéesJSON> {
  const réponse = await axios.get(url);
  const données = await réponse.data;
  return données as DonnéesJSON;
}

export async function importerFeuilleCalculDURL(
  url: string,
  options?: ParsingOptions,
): Promise<WorkBook> {
  const réponse = await axios.get<string>(url, { responseType: "arraybuffer" });
  const données = réponse.data;

  const optionsParDéfault: ParsingOptions = {
    type: "buffer",
    cellDates: true,
  };
  const optsXLSX: ParsingOptions = Object.assign(
    optionsParDéfault,
    options || {},
  );
  return readXLSX(données, optsXLSX);
}
