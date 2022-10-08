import AccessControllers from "orbit-db-access-controllers";
import ContrôleurConstellation from "@/accès/cntrlConstellation.js";
import ContrôleurAccès from "@/accès/cntrlMod.js";

export const enregistrerContrôleurs = (): void => {
  AccessControllers.addAccessController({
    AccessController: ContrôleurConstellation,
  });
  AccessControllers.addAccessController({
    AccessController: ContrôleurAccès,
  });
};

enregistrerContrôleurs();

export default AccessControllers;

export * from "@/accès/consts.js";
