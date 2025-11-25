import { générerMandataire } from "@constl/mandataire";

import { MandataireProc } from "./ipaProc.js";
import type { Crabe } from "../crabe.js";

export const mandatairifier = <T extends Crabe>(crabe: T): T => {
  return générerMandataire<T>(new MandataireProc(crabe));
};
