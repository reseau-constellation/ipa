import {
  isBrowser,
  isElectronMain,
  isElectronRenderer,
  isNode,
  isReactNative,
  isWebWorker,
} from "wherearewe";

import {
  Constellation,
  OptionsConstellation,
  Constellation as _Constellation,
} from "./constellation.js";
import {
  générerMandataireProcessus,
  générerMandataireTravailleur,
} from "./crabe/mandataire/index.js";
import type { MandataireConstellation } from "@constl/mandataire";

export type Constellation = MandataireConstellation<_Constellation>;

export const créerConstellation = (
  opts: OptionsConstellation = {},
): Constellation => {
  if (isNode || isElectronMain) {
    return générerMandataireProcessus(async () => new Constellation(opts));
  } else if (isBrowser) {
    return générerMandataireProcessus(opts);
  } else if (isElectronRenderer) {
    console.warn(
      "Constellation a été initialisée par le processus de rendu d'Électron. Ce n'est pas un gros gros problème, mais nous vous recommandons d'utiliser Constellation dans le processus principal, ce qui est beaucoup plus performant et vous permettra également d'accéder à toutes les fonctionnalités de Constellation telles les sauvegardes et les importations automatisées. Voir la documentation: https://docu.réseau-constellation.ca/avancé/applications/électron.html.",
    );
    return générerMandataireProcessus(opts);
  } else if (isWebWorker) {
    console.warn(
      "Constellation a été initialisée dans un processus de travailleur. J'espère que ça va fonctionner !",
    );
    return générerMandataireTravailleur(opts);
  } else if (isReactNative) {
    console.warn(
      "Constellation n'a pas encore été optimisé pour React Native. Nous utiliserons l'implémentation pour navigateurs.",
    );
    return générerMandataireProcessus(opts);
  } else {
    return générerMandataireProcessus(opts);
  }
};
