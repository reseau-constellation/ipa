import { isBrowser, isElectronRenderer, isWebWorker } from "wherearewe";
import { mplex } from "@libp2p/mplex";
import { create } from "ipfs-core";
import { noise } from "@chainsafe/libp2p-noise";
import mergeOptions from "merge-options";
import type { IPFS } from "ipfs-core";
import type { Options } from "ipfs-core";

const obtConfigPlateforme = async (): Promise<Parameters<typeof create>[0]> => {
  if (isBrowser || isElectronRenderer) {
    const configNavigateur = await import("@/sfip/configNavigateur.js");
    return configNavigateur.default;
  } else if (isWebWorker) {
    const configTravailleurWeb = await import("@/sfip/configTravailleur.js");
    return configTravailleurWeb.default;
  } else {
    const configNode = await import("@/sfip/configNode.js");
    return configNode.default;
  }
};

// https://github.com/libp2p/js-libp2p-webrtc-direct/issues/98
const obtConfigCommun = (): Options => {
  return {
    libp2p: {
      streamMuxers: [mplex()],
      connectionEncryption: [noise()],
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

  return create(configFinale);
}
