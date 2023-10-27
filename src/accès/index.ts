import { useAccessController } from "@orbitdb/core";

import ContrôleurConstellation from "./cntrlConstellation.js";
import ContrôleurAccès from "./cntrlMod.js";

export const enregistrerContrôleurs = (): void => {
  useAccessController(ContrôleurConstellation);
  useAccessController(ContrôleurAccès);
};

export *  as cntrlConstellation from "./cntrlConstellation.js";
export * as cntrlMod from "./cntrlMod.js";

export * from "./consts.js";
