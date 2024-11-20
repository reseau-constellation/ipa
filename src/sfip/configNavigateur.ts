import { identify } from "@libp2p/identify";
import { webSockets } from "@libp2p/websockets";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webTransport } from "@libp2p/webtransport";
import { bootstrap } from "@libp2p/bootstrap";
import { all } from "@libp2p/websockets/filters";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { autoNAT } from "@libp2p/autonat";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { dcutr } from "@libp2p/dcutr";
// import { kadDHT } from "@libp2p/kad-dht";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";

import type { Libp2pOptions } from "libp2p";
import { ADRESSES_NŒUDS_INITIAUX, ADRESSES_NŒUDS_RELAI_RUST, ADRESSES_NŒUDS_RELAI_WS } from "./const.js";
import { résoudreInfoAdresses } from "./utils.js";

export const obtOptionsLibp2pNavigateur = async (): Promise<Libp2pOptions> => {
  return {
    addresses: {
      listen: ["/webrtc", "/webtransport", "/p2p-circuit"],
    },
    transports: [
      webSockets({
        filter: all,
      }),
      webRTC(),
      webRTCDirect(),
      webTransport(),
      circuitRelayTransport(),
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr:
        process.env.NODE_ENV !== "test" ? () => false : undefined,
    },
    connectionManager: {},
    peerDiscovery: [
      bootstrap({
        list: ADRESSES_NŒUDS_INITIAUX,
        timeout: 0,
      }),
      pubsubPeerDiscovery({
        interval: 1000,
        topics: ["constellation._peer-discovery._p2p._pubsub"], // par défaut : ['_peer-discovery._p2p._pubsub']
        listenOnly: false,
      }),
    ],
    services: {
      identify: identify(),
      autoNAT: autoNAT(),
      dcutr: dcutr(),
      pubsub: gossipsub({
        allowPublishToZeroTopicPeers: true,
        runOnLimitedConnection: true,
        canRelayMessage: true,
        directPeers: résoudreInfoAdresses([...ADRESSES_NŒUDS_RELAI_WS, ...ADRESSES_NŒUDS_RELAI_RUST]),
      }),
      /*dht: kadDHT({
        clientMode: true,
      }),*/
    },
  };
};
