import { générerMandataire } from "@constl/mandataire";

import { Crabe } from "../crabe.js";
import { MandataireProc } from "./ipaProc.js";

export const mandatairifier = <T extends Crabe>(crabe: T): T => {
  return générerMandataire<T>(new MandataireProc(crabe));
};
