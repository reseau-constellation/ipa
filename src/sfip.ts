import { create } from "ipfs";
import { IPFS } from "ipfs-core-types";
import wrtc from "wrtc";
import WebRTCStar from "libp2p-webrtc-star";
import Websockets from "libp2p-websockets";
import WebRTCDirect from "libp2p-webrtc-direct";
import { NOISE } from "libp2p-noise";

export default async function initSFIP(dir = "./sfip-cnstl"): Promise<IPFS> {
  const sfip: IPFS = await create({
    libp2p: {
      modules: {
        transport: [WebRTCStar, Websockets, WebRTCDirect],
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
            connEncryption: [NOISE],
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
    },
    repo: dir,
  });

  // https://github.com/LucaPanofsky/ipfs-wss-heroku-node
  // "/dns4/p2p-circuit.herokuapp.com/tcp/443/wss/p2p/QmY8XpuX6VnaUVDz4uA14vpjv3CZYLif3wLPqCkgU2KLSB"
  sfip.swarm.connect("/dns4/p2p-circuit-constellation.herokuapp.com/tcp/46396/wss/p2p/QmY8XpuX6VnaUVDz4uA14vpjv3CZYLif3wLPqCkgU2KLSB")

  return sfip;
}
