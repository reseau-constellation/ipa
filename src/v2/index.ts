import { isElectronRenderer, isWebWorker } from "wherearewe";

import { Constellation as ConstructeurConstellation } from "./constellation.js";
import {
  générerMandataireProcessus,
  générerMandataireTravailleur,
} from "./crabe/mandataire/index.js";
import type { OptionsConstellation } from "./constellation.js";
import type { MandataireConstellation } from "@constl/mandataire";

export type Constellation = MandataireConstellation<ConstructeurConstellation>;

export const créerConstellation = (
  opts: OptionsConstellation = {},
): Constellation => {
  if (isWebWorker) {
    console.warn(
      "Constellation a été initialisée dans un processus de travailleur, ce qui pourrait mener à des difficultés de connectivité.",
    );
    return générerMandataireTravailleur(
      () => new ConstructeurConstellation(opts),
    );
  }

  const mandataire = générerMandataireProcessus(
    async () => new ConstructeurConstellation(opts),
  );

  if (isElectronRenderer) {
    console.warn(
      "Constellation a été initialisée par le processus de rendu d'Électron. " +
        "Ce n'est pas un gros gros problème, mais nous vous recommandons d'utiliser " +
        "Constellation dans le processus principal, ce qui est beaucoup plus performant " +
        "et vous permettra également d'accéder à toutes les fonctionnalités de Constellation " +
        "telles les sauvegardes et les importations automatisées. Voir la documentation: " +
        "https://docu.réseau-constellation.ca/avancé/applications/électron.html.",
    );
  }
  return mandataire;
};
