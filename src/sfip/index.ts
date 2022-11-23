import {
  isBrowser,
  isElectronRenderer,
  isElectronMain,
  isNode,
} from "wherearewe";
import { createController, ControllerOptions } from "ipfsd-ctl";

import { IPFS } from "ipfs-core-types";
import wrtc from "wrtc";
import { noise } from "@chainsafe/libp2p-noise";

const configNavigateur = import("./configNavigateur.js");
// const configÉlectron = import("./configÉlectron.js");
const configNode = import("./configNode.js");

const obtConfigPlateforme = async () => {
  if (isBrowser || isElectronRenderer) {
    return (await configNavigateur).default;
  } else if (isElectronMain) {
    return {}; // await (await configÉlectron).default();
  } else if (isNode) {
    return (await configNode).default();
  } else {
    throw new Error("Environnement non supporté");
  }
};
// https://github.com/libp2p/js-libp2p-webrtc-direct/issues/98
const obtConfigCommun = (): { [key: string]: any } => {
  return {
    libp2p: {
      modules: {},
      connectionManager: {
        autoDial: false,
      },
      config: {
        peerDiscovery: {
          webRTCStar: {
            // <- note the lower-case w - see https://github.com/libp2p/js-libp2p/issues/576
            enabled: true,
          },
        },
        transport: {
          WebRTCStar: {
            // <- note the upper-case w- see https://github.com/libp2p/js-libp2p/issues/576
            wrtc,
            connEncryption: [noise],
          },
        },
      },
      transportManager: { faultTolerance: 1 },
    },
    relay: { enabled: true, hop: { enabled: true, active: true } },
    config: {
      Addresses: {
        Swarm: [
          // https://suda.pl/free-webrtc-star-heroku/
          "/dns4/arcane-springs-02799.herokuapp.com/tcp/443/wss/p2p-webrtc-star/",
          // https://github.com/LucaPanofsky/ipfs-wss-heroku-node
          "/dns4/p2p-circuit-constellation.herokuapp.com/tcp/443/wss/p2p/QmY8XpuX6VnaUVDz4uA14vpjv3CZYLif3wLPqCkgU2KLSB",
        ],
      },
    },
  };
};

export default async function initSFIP(dir = "./constl/sfip"): Promise<IPFS> {
  const controllerConfig: ControllerOptions = {
    type: "proc",
    disposable: false,
    test: false,
    ipfsModule: await import("ipfs"),
  };

  const config = obtConfigCommun();
  const configPlateforme = await obtConfigPlateforme();

  config.libp2p.modules = configPlateforme;
  config.repo = dir;

  controllerConfig.ipfsOptions = config;
  // Spawn an IPFS daemon (type defined in)
  const ipfsd = await createController(controllerConfig);
  await ipfsd.init();
  await ipfsd.start();

  return ipfsd.api;
}
