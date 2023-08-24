export { version } from "@/version.js";

export * as accès from "@/accès/index.js";
export * as importateur from "@/importateur/index.js";
export * as mandataire from "@/mandataire/index.js";

export * as automatisation from "@/automatisation.js";
export * as bds from "@/bds.js";
export * as client from "@/client.js";
export * as épingles from "@/epingles.js";
export * as profil from "@/profil.js";
export * as encryption from "@/encryption.js";
export * as favoris from "@/favoris.js";
export * as licences from "@/licences.js";
export * as motsClefs from "@/motsClefs.js";
export * as projets from "@/projets.js";
export * as réseau from "@/reseau.js";
export * as tableaux from "@/tableaux.js";
export * as types from "@/types.js"
export * as valid from "@/valid.js";
export * as variables from "@/variables.js";

import { ipa, ipaTravailleur } from "@/mandataire/index.js";
import type { optsConstellation } from "@/client.js";
import type { optsIpaTravailleur } from "@/mandataire/ipaTravailleur.js";
import type { MandataireClientConstellation } from "@constl/mandataire";

import type { ClientConstellation as _ClientConstellation } from "@/client.js";
export type ClientConstellation = MandataireClientConstellation<_ClientConstellation>;


function générerClient({
  opts,
  mandataire,
}: {
  opts: optsConstellation;
  mandataire: "proc";
}): ClientConstellation;
function générerClient({
  opts,
  mandataire,
}: {
  opts: optsIpaTravailleur;
  mandataire: "travailleur";
}): ClientConstellation;
function générerClient({
  opts,
  mandataire,
}: {
  opts: optsConstellation;
  mandataire?: "proc";
}): ClientConstellation;
function générerClient({
  opts,
  mandataire = "proc",
}: {
  opts: optsConstellation | optsIpaTravailleur;
  mandataire?: "proc" | "travailleur";
}): ClientConstellation {
  switch (mandataire) {
    case "proc":
      return ipa.générerMandataireProc(opts);
    case "travailleur":
      return ipaTravailleur.default(opts as optsIpaTravailleur);
    default:
      throw new Error(
        `Mandataire de type ${mandataire} non reconnu (doit être "proc" ou "travailleur").`
      );
  }
}

export { générerClient };

