import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { bootstrap } from "@libp2p/bootstrap";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { identify } from "@libp2p/identify";
import { webSockets } from "@libp2p/websockets";
import { webTransport } from "@libp2p/webtransport";
import { ADRESSES_NŒUDS_INITIAUX } from "./const.js";
import type { Libp2pOptions } from "libp2p";

export const obtOptionsLibp2pTravailleurWeb = async ({
  pairsParDéfaut = [],
}: {
  pairsParDéfaut?: string[];
}): Promise<Libp2pOptions> => {
  return {
    addresses: {
      listen: ["/webrtc", "/p2p-circuit"],
    },
    transports: [webSockets(), webTransport(), circuitRelayTransport()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr: () => false,
    },
    peerDiscovery: [
      bootstrap({
        list: [...ADRESSES_NŒUDS_INITIAUX, ...pairsParDéfaut],
        timeout: 0,
      }),
    ],
    services: {
      identify: identify(),
      pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
    },
  };
};
