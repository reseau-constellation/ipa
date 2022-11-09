import OrbitDB from "orbit-db";
import AccessControllers from "@/accès/index.js";
import { IPFS } from "ipfs-core";

export default async function initOrbite(
  sfip: IPFS,
  dossierOrbite = "./orbite-cnstl"
): Promise<OrbitDB> {
  return await OrbitDB.createInstance(sfip, {
    directory: dossierOrbite,
    AccessControllers,
  });
}
