import oùSommesNous from "wherearewe";
import { create } from "ipfs";
import { IPFS } from "ipfs-core-types";
import wrtc from "wrtc";
import { Noise } from "@chainsafe/libp2p-noise";

const configNavigateur = import("./configNavigateur");
const configÉlectron = import("./configÉlectron");
const configNode = import("./configNode");

const obtConfigPlateforme = async () => {
  if (oùSommesNous.isBrowser || oùSommesNous.isElectronRenderer) {
    return (await configNavigateur).default;
  } else if (oùSommesNous.isElectronMain) {
    return (await configÉlectron).default;
  } else {
    return (await configNode).default;
  }
};

const obtConfigCommun = (): { [key: string]: any } => {
  return {
    libp2p: {
      modules: {},
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
            connEncryption: [Noise],
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
        ],
      },
      Swarm: {
        ConnMgr: {
          LowWater: 100,
          HighWater: 200,
        },
      },
    },
  };
};

export default async function initSFIP(dir = "./constl/sfip"): Promise<IPFS> {
  const config = obtConfigCommun();
  const configPlateforme = await obtConfigPlateforme();

  config.libp2p.modules = configPlateforme;
  config.repo = dir;
  console.log(config);

  const sfip: IPFS = await create(config);

  // https://github.com/LucaPanofsky/ipfs-wss-heroku-node
  sfip.swarm.connect(
    "/dns4/p2p-circuit-constellation.herokuapp.com/tcp/443/wss/p2p/QmY8XpuX6VnaUVDz4uA14vpjv3CZYLif3wLPqCkgU2KLSB"
  );

  return sfip;
}
