import axios from "axios";
import { read as readXLSX } from "xlsx";
import type { ParsingOptions, WorkBook } from "xlsx";

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
  const données = ArrayBuffer.isView(réponse.data)
    ? réponse.data
    : new Uint8Array(Object.values(réponse.data) as unknown as number[]);

  const optionsParDéfault: ParsingOptions = {
    type: "buffer",
    cellDates: true,
  };
  const optsXLSX: ParsingOptions = Object.assign(
    {},
    optionsParDéfault,
    options || {},
  );
  return readXLSX(données, optsXLSX);
}
