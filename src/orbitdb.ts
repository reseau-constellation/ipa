import OrbitDB from "orbit-db";
import AccessControllers from "./accès";
import IPFS from "ipfs";

export default async function initOrbite(sfip: IPFS.IPFS): Promise<OrbitDB> {
  return await OrbitDB.createInstance(sfip, {
    AccessControllers,
  });
}
