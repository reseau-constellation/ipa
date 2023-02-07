import OrbitDB from "orbit-db";
import AccessControllers from "@/accès/index.js";
import type { IPFS } from "ipfs-core";
import { isElectronMain, isNode } from "wherearewe";

export default async function initOrbite({
  sfip,
  dossierOrbite,
}: {
  sfip: IPFS;
  dossierOrbite?: string;
}): Promise<OrbitDB> {
  let dossierOrbiteFinal: string | undefined = undefined;
  if (isElectronMain) {
    const electron = await import("electron");
    const path = await import("path");
    dossierOrbiteFinal =
      dossierOrbite ||
      path.join(electron.default.app.getPath("userData"), "orbite");
  } else if (isNode) {
    const path = await import("path");
    dossierOrbiteFinal = dossierOrbite || path.join(".", "orbite");
  }

  return await OrbitDB.createInstance(sfip, {
    directory: dossierOrbiteFinal,
    AccessControllers,
  });
}
