import {
  isBrowser,
  isElectronMain,
  isElectronRenderer,
  isNode,
  isWebWorker,
} from "wherearewe";
import { mplex } from "@libp2p/mplex";
import { noise } from "@chainsafe/libp2p-noise";
import mergeOptions from "merge-options";
import { Helia, type HeliaInit, createHelia } from "helia";
import type { Libp2p, ServiceMap } from "@libp2p/interface";

const obtConfigPlateforme = async (): Promise<HeliaInit> => {
  let configPlateforme: Libp2p<ServiceMap>;
  if (isBrowser || isElectronRenderer) {
    configPlateforme = (await import("@/sfip/configNavigateur.js")).DefaultLibp2pBrowserOptions;
  } else if (isWebWorker) {
    configPlateforme = (await import("@/sfip/configTravailleur.js")).OptionsLibp2pTravailleurWeb;
  } else if (isElectronMain) {
    configPlateforme = (await import("@/sfip/configÉlectronPrincipal.js"))
      .OptionsLibp2pÉlectionPrincipal;
  } else if (isNode) {
    configPlateforme = (await import("@/sfip/configNode.js")).OptionsLibp2pNode;
  } else {
    console.warn(
      "Plateforme non reconnue. On utilisera la configuration navigateur.",
    );
    configPlateforme = (await import("@/sfip/configNavigateur.js")).OptionsLibp2pNavigateur;
  }
  return configPlateforme;
};

export default async function initSFIP(dir = "./constl/sfip"): Promise<Helia> {
  const config = await obtConfigPlateforme();

  config.repo = dir;

  return await createHelia(config);
}
