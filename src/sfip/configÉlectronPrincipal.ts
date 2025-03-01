import { join } from "path";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { autoNAT } from "@libp2p/autonat";
import { bootstrap } from "@libp2p/bootstrap";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { dcutr } from "@libp2p/dcutr";
import { identify, identifyPush } from "@libp2p/identify";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import { all } from "@libp2p/websockets/filters";
import { webTransport } from "@libp2p/webtransport";
import { uPnPNAT } from "@libp2p/upnp-nat";
import { ping } from "@libp2p/ping";
import { FaultTolerance } from "@libp2p/interface";
import {
  ADRESSES_NŒUDS_INITIAUX,
  ADRESSES_NŒUDS_RELAI_RUST,
  ADRESSES_NŒUDS_RELAI_WS,
} from "./const.js";
import { applicationScore, résoudreInfoAdresses } from "./utils.js";
import type { Libp2pOptions } from "libp2p";
// import { kadDHT } from "@libp2p/kad-dht";

export const obtOptionsLibp2pÉlectionPrincipal = async ({
  dossier,
}: {
  dossier: string;
}): Promise<Libp2pOptions> => {
  const { tcp } = await import("@libp2p/tcp");
  const { mdns } = await import("@libp2p/mdns");
  const { FsDatastore } = await import("datastore-fs");
  const dossierStockage = join(dossier, "libp2p");
  const stockage = new FsDatastore(dossierStockage);

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
      denyDialMultiaddr: () => false,
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
      }),
      upnp: uPnPNAT(),
      /*dht: kadDHT({
          clientMode: true,
        }),*/
    },
  };
};
