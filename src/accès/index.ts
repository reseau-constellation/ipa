import {useAccessController} from "@orbitdb/core";

import ContrôleurConstellation from "@/accès/cntrlConstellation.js";
import ContrôleurAccès from "@/accès/cntrlMod.js";

export const enregistrerContrôleurs = (): void => {
  useAccessController(ContrôleurConstellation)
  useAccessController(ContrôleurAccès)
};



export * from "@/accès/consts.js";
