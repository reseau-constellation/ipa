import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { autoNAT } from "@libp2p/autonat";
import { bootstrap } from "@libp2p/bootstrap";
import { dcutr } from "@libp2p/dcutr";
import { identify, identifyPush } from "@libp2p/identify";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import { webTransport } from "@libp2p/webtransport";
// import { kadDHT } from "@libp2p/kad-dht";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { detect } from "detect-browser";
import { ping } from "@libp2p/ping";

import { IDBDatastore } from "datastore-idb";
import { FaultTolerance } from "@libp2p/interface";
import {
  ADRESSES_NŒUDS_INITIAUX,
  ADRESSES_NŒUDS_RELAI_RUST,
  ADRESSES_NŒUDS_RELAI_WS,
} from "./const.js";
import { applicationScore, résoudreInfoAdresses } from "./utils.js";
import type { Libp2pOptions } from "libp2p";

// https://github.com/libp2p/specs/blob/master/pubsub/gossipsub/gossipsub-v1.1.md#recommendations-for-network-operators

// https://github.com/ipfs/helia/blob/main/packages/helia/src/utils/libp2p-defaults.browser.ts#L34

export const obtOptionsLibp2pNavigateur = async ({
  dossier,
}: {
  dossier: string;
}): Promise<Libp2pOptions> => {
  const dossierStockage = `${dossier}/libp2p`;
  const stockage = new IDBDatastore(dossierStockage);
  await stockage.open();

  const transports = [
    webSockets(),
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
    transportManager: {
      faultTolerance: FaultTolerance.NO_FATAL,
    },
    transports,
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr: () => false,
    },
    // datastore: stockage,
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
      ping: ping(),
      identify: identify({
        maxMessageSize: 1e6,
        maxInboundStreams: 50,
        maxOutboundStreams: 50,
      }),
      identifyPush: identifyPush({
        maxMessageSize: 1e6,
        maxInboundStreams: 50,
        maxOutboundStreams: 50,
      }),
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
        scoreParams: {
          appSpecificScore: applicationScore,
        },
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
