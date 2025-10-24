export { version } from "@/version.js";

export * as accès from "@/accès/index.js";
export * as importateur from "@/importateur/index.js";
export * as mandataire from "@/mandataire/index.js";

export * as automatisation from "@/automatisation.js";
export * as bds from "@/bds.js";
export * as client from "@/client.js";
export * as épingles from "@/epingles.js";
export * as favoris from "@/favoris.js";
export * as licences from "@/licences.js";
export * as motsClefs from "@/motsClefs.js";
export * as orbite from "@/orbite.js";
export * as profil from "@/profil.js";
export * as projets from "@/projets.js";
export * as réseau from "@/reseau.js";
export * as sfip from "@/sfip/index.js";
export * as tableaux from "@/tableaux.js";
export * as types from "@/types.js";
export * as valid from "@/valid.js";
export * as variables from "@/variables.js";

import {
  isBrowser,
  isElectronMain,
  isElectronRenderer,
  isNode,
  isReactNative,
  isWebWorker,
} from "wherearewe";
import { préparerOrbite } from "./orbite.js";
import type {
  optsConstellation,
  Constellation as _Constellation,
} from "@/client.js";
import type { MandataireConstellation } from "@constl/mandataire";
import { confirmerOptsTravailleur } from "@/mandataire/ipaTravailleur.js";
import {
  générerMandataireProc,
  générerMandataireTravailleur,
} from "@/mandataire/index.js";

export type Constellation = MandataireConstellation<_Constellation>;

export const créerConstellation = (
  opts: optsConstellation = {},
): Constellation => {
  préparerOrbite();
  if (isNode || isElectronMain) {
    return générerMandataireProc(opts);
  } else if (isBrowser) {
    return générerMandataireProc(confirmerOptsTravailleur(opts));
  } else if (isElectronRenderer) {
    console.warn(
      "Constellation a été initialisée par le processus de rendu d'Électron. Ce n'est pas un gros gros problème, mais nous vous recommandons d'utiliser Constellation dans le processus principal, ce qui est beaucoup plus performant et vous permettra également d'accéder à toutes les fonctionnalités de Constellation telles les sauvegardes et les importations automatisées. Voir la documentation: https://docu.réseau-constellation.ca/avancé/applications/électron.html.",
    );
    return générerMandataireProc(confirmerOptsTravailleur(opts));
  } else if (isWebWorker) {
    console.warn(
      "Constellation a été initialisée dans un processus de travailleur. J'espère que ça va fonctionner !",
    );
    return générerMandataireTravailleur(confirmerOptsTravailleur(opts));
  } else if (isReactNative) {
    console.warn(
      "Constellation n'a pas encore été optimisé pour React Native. Nous utiliserons l'implémentation pour navigateurs.",
    );
    return générerMandataireProc(confirmerOptsTravailleur(opts));
  } else {
    console.warn(
      "Environnement non détecté. On va utiliser la configuration navigateur.",
    );
    return générerMandataireTravailleur(confirmerOptsTravailleur(opts));
  }
};
