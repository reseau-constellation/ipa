import AccessControllers from "orbit-db-access-controllers";
import ContrôleurConstellation from "./cntrlConstellation.js";
import ContrôleurAccès from "./cntrlMod.js";

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
