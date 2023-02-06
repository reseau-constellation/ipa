import {
  isBrowser,
  isElectronRenderer,
  isWebWorker,
} from "wherearewe";
import { mplex } from '@libp2p/mplex'
import { create,  } from "ipfs";
import { noise } from "@chainsafe/libp2p-noise";
import mergeOptions from 'merge-options'
import type { IPFS } from "ipfs";

const obtConfigPlateforme = async (): Promise<Parameters<typeof create>[0]> => {
  if (isBrowser || isElectronRenderer || isWebWorker ) {
    const configNavigateur = await import("./configNavigateur.js")
    return configNavigateur.default;
  } else {
    const configNode = await import("./configNode.js");
    return configNode.default;
  }
};

// https://github.com/libp2p/js-libp2p-webrtc-direct/issues/98
const obtConfigCommun = (): Parameters<typeof create>[0] => {
  return {
    libp2p: {
      streamMuxers: [
        mplex()
      ],
      connectionEncryption: [
        noise()
      ],
      addresses: {
        listen: ["/dns4/arcane-springs-02799.herokuapp.com/tcp/443/wss/p2p-webrtc-star/"]
      },
    },
    relay: { enabled: true, hop: { enabled: true, active: true } },
  }
};


export default async function initSFIP(dir = "./constl/sfip"): Promise<IPFS> {

  const config = obtConfigCommun();
  const configPlateforme = await obtConfigPlateforme();

  config.repo = dir;

  const configFinale: Parameters<typeof create>[0] = mergeOptions(config, configPlateforme);

  return create(configFinale)
}
