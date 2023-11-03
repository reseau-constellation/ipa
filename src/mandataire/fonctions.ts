import { générerMandataire } from "@constl/mandataire";

import type { ClientConstellation } from "@/index.js";
import type { ClientConstellation as ClientNonMandatairifié } from "@/client.js";

import { MandataireClientProc } from "./ipaProc.js";

export const mandatairifier = (
  client: ClientNonMandatairifié,
): ClientConstellation => {
  return générerMandataire(new MandataireClientProc(client));
};
