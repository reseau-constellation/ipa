import { générerMandataire } from "@constl/mandataire";

import type { Constellation } from "@/index.js";
import type { Constellation as ClientNonMandatairifié } from "@/client.js";

import { MandataireProc } from "./ipaProc.js";

export const mandatairifier = (
  client: ClientNonMandatairifié,
): Constellation => {
  return générerMandataire(new MandataireProc(client));
};
