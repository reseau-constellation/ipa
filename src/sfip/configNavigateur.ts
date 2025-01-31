import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { autoNAT } from "@libp2p/autonat";
import { bootstrap } from "@libp2p/bootstrap";
import { dcutr } from "@libp2p/dcutr";
import { identify } from "@libp2p/identify";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import { all } from "@libp2p/websockets/filters";
import { webTransport } from "@libp2p/webtransport";
// import { kadDHT } from "@libp2p/kad-dht";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { detect } from "detect-browser";

import {
  ADRESSES_NŒUDS_INITIAUX,
  ADRESSES_NŒUDS_RELAI_RUST,
  ADRESSES_NŒUDS_RELAI_WS,
} from "./const.js";
import { résoudreInfoAdresses } from "./utils.js";
import type { Libp2pOptions } from "libp2p";

// https://github.com/libp2p/specs/blob/master/pubsub/gossipsub/gossipsub-v1.1.md#recommendations-for-network-operators

export const obtOptionsLibp2pNavigateur = async (): Promise<Libp2pOptions> => {
  const transports = [
    webSockets({
      filter: all,
    }),
    webRTC(),
    webRTCDirect(),
    circuitRelayTransport(),
  ];
  // En attendant une résolution à https://github.com/libp2p/js-libp2p-webtransport/issues/64
  if (detect()?.name !== "chrome") {
    transports.push(webTransport());
  }
  return {
    addresses: {
      listen: ["/webrtc", "/webtransport", "/p2p-circuit"],
    },
    transports,
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
        directPeers: résoudreInfoAdresses([
          ...ADRESSES_NŒUDS_RELAI_WS,
          ...ADRESSES_NŒUDS_RELAI_RUST,
        ]),
        scoreThresholds: {
          acceptPXThreshold: 0,
        },
      }),
      /*dht: kadDHT({
        clientMode: true,
        // peerInfoMapper: removePrivateAddressesMapper
      }),*/
    },
  };
};
