import OrbitDB from "orbit-db";
import AccessControllers from "./accès";
import { IPFS } from "ipfs";

export default async function initOrbite(
  sfip: IPFS,
  dossierOrbite = "./orbite-cnstl"
): Promise<OrbitDB> {
  return await OrbitDB.createInstance(sfip, {
    directory: dossierOrbite,
    AccessControllers,
  });
}
