import { join } from "path";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { autoNAT } from "@libp2p/autonat";
import { bootstrap } from "@libp2p/bootstrap";
import {
  circuitRelayServer,
  circuitRelayTransport,
} from "@libp2p/circuit-relay-v2";
import { dcutr } from "@libp2p/dcutr";
import { identify, identifyPush } from "@libp2p/identify";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import { webTransport } from "@libp2p/webtransport";
import { FaultTolerance, PrivateKey } from "@libp2p/interface";
import { ping } from "@libp2p/ping";
import { uPnPNAT } from "@libp2p/upnp-nat";
import { peerIdFromPrivateKey } from "@libp2p/peer-id";
import { FsDatastore } from "datastore-fs";
import {
  ADRESSES_NŒUDS_INITIAUX,
  ADRESSES_NŒUDS_RELAI_RUST,
  ADRESSES_NŒUDS_RELAI_WS,
} from "./const.js";
import { applicationScore, résoudreInfoAdresses } from "./utils.js";
import { reconnecteur } from "./services/reconnecteur.js";
import type { Libp2pOptions } from "libp2p";

// import { kadDHT } from "@libp2p/kad-dht";

export const obtOptionsLibp2pNode = async ({
  dossier,
  domaines,
  clefPrivée,
}: {
  dossier?: string;
  domaines?: string[];
  clefPrivée?: PrivateKey;
} = {}): Promise<Libp2pOptions> => {
  // Ces librairies-ci ne peuvent pas être compilées pour l'environnement
  // navigateur. Nous devons donc les importer dynamiquement ici afin d'éviter
  // des problèmes de compilation pour le navigateur.
  const { tcp } = await import("@libp2p/tcp");
  const { mdns } = await import("@libp2p/mdns");

  const idPair = clefPrivée ? peerIdFromPrivateKey(clefPrivée) : undefined;

  let stockage: FsDatastore | undefined = undefined;
  if (dossier) {
    const { FsDatastore } = await import("datastore-fs");
    const dossierStockage = join(dossier, "libp2p");
    stockage = new FsDatastore(dossierStockage);
    stockage.open();
  }

  return {
    addresses: {
      listen: [
        "/ip4/0.0.0.0/tcp/0",
        "/ip4/0.0.0.0/tcp/0/ws",
        "/ip6/::/tcp/0",
        "/ip6/::/tcp/0/ws",
        "/webrtc",
        "/webtransport",
        "/p2p-circuit",
      ],
      announce:
        domaines?.length && idPair
          ? domaines
              .map((domaine) => [
                `/dns4/${domaine}/tcp/443/wss/p2p/${idPair.toString()}`,
                `/dns4/${domaine}/tcp/80/ws/p2p/${idPair.toString()}`,
              ])
              .flat()
          : undefined,
    },
    transportManager: {
      faultTolerance: FaultTolerance.NO_FATAL,
    },
    transports: [
      webSockets(),
      webRTC(),
      webTransport(),
      webRTCDirect(),
      tcp(),
      circuitRelayTransport(),
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr: () => false,
    },
    // https://github.com/libp2p/js-libp2p/issues/2897
    connectionManager: {
      inboundStreamProtocolNegotiationTimeout: 1e4,
      inboundUpgradeTimeout: 1e4,
      outboundStreamProtocolNegotiationTimeout: 1e4,
      outboundUpgradeTimeout: 1e4,
    },
    // datastore: stockage,
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
      reconnecteur: reconnecteur({ liste: [...ADRESSES_NŒUDS_RELAI_WS] }),
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
          acceptPXThreshold: 100,
        },
      }),
      /*dht: kadDHT({
        clientMode: true,
        // peerInfoMapper: removePrivateAddressesMapper
        }),*/
      upnp: uPnPNAT(),
      relay: circuitRelayServer(),
    },
  };
};
