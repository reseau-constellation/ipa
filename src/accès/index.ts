import { AccessControllers } from "orbit-db";
import ContrôleurConstellation from "./cntrlConstellation";
import ContrôleurAccès from "./cntrlMod";

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
