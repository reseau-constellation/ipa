import { générerMandataire } from "@constl/mandataire";

import { MandataireProc } from "./ipaProc.js";
import type { Nébuleuse } from "../nébuleuse.js";

export const mandatairifier = <T extends Nébuleuse>(nébuleuse: T): T => {
  return générerMandataire<T>(new MandataireProc(nébuleuse));
};
