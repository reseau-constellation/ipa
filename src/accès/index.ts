import { useAccessController } from "@orbitdb/core";

import { registerSet } from "@orbitdb/set-db";
import { ContrôleurConstellation } from "./cntrlConstellation.js";
import { ContrôleurAccès } from "./cntrlMod.js";

export const enregistrerContrôleurs = (): void => {
  registerSet();
  useAccessController(ContrôleurConstellation);
  useAccessController(ContrôleurAccès);
};

export * as cntrlConstellation from "./cntrlConstellation.js";
export * as cntrlMod from "./cntrlMod.js";

export * from "./consts.js";
