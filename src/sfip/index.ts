import {
  isBrowser,
  isElectronMain,
  isElectronRenderer,
  isNode,
  isWebWorker,
} from "wherearewe";
import { mplex } from "@libp2p/mplex";
import { create } from "ipfs-core";
import { noise } from "@chainsafe/libp2p-noise";
import mergeOptions from "merge-options";
import type { IPFS } from "ipfs-core";
import type { Options } from "ipfs-core";
import { FaultTolerance } from "@libp2p/interface-transport";

const obtConfigPlateforme = async (): Promise<Parameters<typeof create>[0]> => {
  let configPlateforme: Parameters<typeof create>[0];
  if (isBrowser || isElectronRenderer) {
    configPlateforme = (await import("@/sfip/configNavigateur.js")).default;
  } else if (isWebWorker) {
    configPlateforme = (await import("@/sfip/configTravailleur.js")).default;
  } else if (isElectronMain) {
    configPlateforme = (await import("@/sfip/configÉlectronPrincipal.js"))
      .default;
  } else if (isNode) {
    configPlateforme = (await import("@/sfip/configNode.js")).default;
  } else {
    console.warn(
      "Plateforme non reconnue. On utilisera la configuration navigateur."
    );
    configPlateforme = (await import("@/sfip/configNavigateur.js")).default;
  }
  return configPlateforme;
};

// https://github.com/libp2p/js-libp2p-webrtc-direct/issues/98
const obtConfigCommun = (): Options => {
  return {
    libp2p: {
      streamMuxers: [mplex()],
      connectionEncryption: [noise()],
      transportManager: {
        faultTolerance: FaultTolerance.NO_FATAL,
      },
    },
    relay: { enabled: true, hop: { enabled: true, active: true } },
  };
};

export default async function initSFIP(dir = "./constl/sfip"): Promise<IPFS> {
  const config = obtConfigCommun();
  const configPlateforme = await obtConfigPlateforme();

  config.repo = dir;

  const configFinale: Parameters<typeof create>[0] = mergeOptions(
    config,
    configPlateforme
  );
  return await create(configFinale);
}
