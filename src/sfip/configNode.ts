import { identify } from "@libp2p/identify";
import { webSockets } from "@libp2p/websockets";
import { webTransport } from "@libp2p/webtransport";
import { webRTC } from "@libp2p/webrtc";
import { bootstrap } from "@libp2p/bootstrap";
import { all } from "@libp2p/websockets/filters";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";

import type { Libp2pOptions } from "libp2p";

import { ADRESSES_NŒUDS_RELAI } from "./const.js";

export const obtOptionsLibp2pNode = async (): Promise<Libp2pOptions> => {
  const { tcp } = await import("@libp2p/tcp");
  return {
    addresses: {
      listen: ["/ip4/0.0.0.0/tcp/0/ws"],
    },
    transports: [
      webSockets({
        filter: all,
      }),
      webRTC(),
      webTransport(),
      tcp(),
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
        tagTTL: Infinity,
      }),
    ],
    services: {
      identify: identify(),
      pubsub: gossipsub({ allowPublishToZeroPeers: true }),
    },
  };
};
