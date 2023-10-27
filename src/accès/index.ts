import { useAccessController } from "@orbitdb/core";

import ContrôleurConstellation from "./cntrlConstellation.js";
import ContrôleurAccès from "./cntrlMod.js";

export const enregistrerContrôleurs = (): void => {
  useAccessController(ContrôleurConstellation);
  useAccessController(ContrôleurAccès);
};

export * from "./cntrlConstellation.js";
export * from "./cntrlMod.js";
export * from "./consts.js";
