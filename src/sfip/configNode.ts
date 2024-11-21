import { identify } from "@libp2p/identify";
import { webSockets } from "@libp2p/websockets";
import { webTransport } from "@libp2p/webtransport";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { bootstrap } from "@libp2p/bootstrap";
import { all } from "@libp2p/websockets/filters";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { autoNAT } from "@libp2p/autonat";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { dcutr } from "@libp2p/dcutr";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";

import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
// import { kadDHT, removePrivateAddressesMapper } from '@libp2p/kad-dht'
import type { Libp2pOptions } from "libp2p";

import {
  ADRESSES_NŒUDS_INITIAUX,
  ADRESSES_NŒUDS_RELAI_RUST,
  ADRESSES_NŒUDS_RELAI_WS,
} from "./const.js";
import { FaultTolerance } from "@libp2p/interface";
import { résoudreInfoAdresses } from "./utils.js";

export const obtOptionsLibp2pNode = async (): Promise<Libp2pOptions> => {
  // Ces librairies-ci ne peuvent pas être compilées pour l'environnement
  // navigateur. Nous devons donc les importer dynamiquement ici afin d'éviter
  // des problèmes de compilation pour le navigateur.
  const { tcp } = await import("@libp2p/tcp");
  const { mdns } = await import("@libp2p/mdns");

  return {
    addresses: {
      listen: [
        "/ip4/0.0.0.0/tcp/0/ws",
        "/webrtc",
        "/webtransport",
        "/p2p-circuit",
        "/webrtc-direct",
      ],
    },
    transportManager: {
      faultTolerance: FaultTolerance.NO_FATAL,
    },
    transports: [
      webSockets({
        filter: all,
      }),
      webRTC(),
      webTransport(),
      webRTCDirect(),
      tcp(),
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
      mdns(),
      bootstrap({
        list: ADRESSES_NŒUDS_INITIAUX,
        timeout: 0,
      }),
      pubsubPeerDiscovery({
        interval: 10000,
        topics: ["constellation._peer-discovery._p2p._pubsub"], // defaults to ['_peer-discovery._p2p._pubsub']
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
