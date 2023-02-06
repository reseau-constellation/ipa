import OrbitDB from "orbit-db";
import AccessControllers from "@/accès/index.js";
import type { IPFS } from "ipfs-core";

export default async function initOrbite(
  sfip: IPFS,
  dossierOrbite = "./constl/orbite.js"
): Promise<OrbitDB> {
  return await OrbitDB.createInstance(sfip, {
    directory: dossierOrbite,
    AccessControllers,
  });
}
