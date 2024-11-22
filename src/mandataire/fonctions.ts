import { générerMandataire } from "@constl/mandataire";

import { MandataireProc } from "./ipaProc.js";
import type { Constellation as ClientNonMandatairifié } from "@/client.js";
import type { Constellation } from "@/index.js";

export const mandatairifier = (
  client: ClientNonMandatairifié,
): Constellation => {
  return générerMandataire(new MandataireProc(client));
};
