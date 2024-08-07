import type { Libp2pOptions } from "libp2p";

import { identify } from "@libp2p/identify";
import { webSockets } from "@libp2p/websockets";
import { webTransport } from "@libp2p/webtransport";
import { bootstrap } from "@libp2p/bootstrap";
import { all } from "@libp2p/websockets/filters";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { ADRESSES_NŒUDS_RELAI } from "./const.js";

export const obtOptionsLibp2pTravailleurWeb =
  async (): Promise<Libp2pOptions> => {
    return {
      addresses: {
        listen: ["/webrtc"],
      },
      transports: [
        webSockets({
          filter: all,
        }),
        webTransport(),
        circuitRelayTransport({
          discoverRelays: 1,
        }),
      ],
      connectionEncryption: [noise()],
      streamMuxers: [yamux()],
      connectionGater: {
        denyDialMultiaddr: () => false,
      },
      peerDiscovery: [
        bootstrap({
          list: ADRESSES_NŒUDS_RELAI,
          timeout: 0,
        }),
      ],
      services: {
        identify: identify(),
        pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
      },
    };
  };
