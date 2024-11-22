import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { autoNAT } from "@libp2p/autonat";
import { bootstrap } from "@libp2p/bootstrap";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { dcutr } from "@libp2p/dcutr";
import { identify } from "@libp2p/identify";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import { all } from "@libp2p/websockets/filters";
import { webTransport } from "@libp2p/webtransport";
import { ADRESSES_NŒUDS_INITIAUX } from "./const.js";
import type { Libp2pOptions } from "libp2p";
// import { kadDHT } from "@libp2p/kad-dht";

export const obtOptionsLibp2pÉlectionPrincipal =
  async (): Promise<Libp2pOptions> => {
    const { tcp } = await import("@libp2p/tcp");
    const { mdns } = await import("@libp2p/mdns");

    return {
      addresses: {
        listen: [
          "/ip4/0.0.0.0/tcp/0/ws",
          "/webrtc",
          "/webtransport",
          "/p2p-circuit",
        ],
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
      peerDiscovery: [
        mdns(),
        bootstrap({
          list: ADRESSES_NŒUDS_INITIAUX,
          timeout: 0,
        }),
        pubsubPeerDiscovery({
          interval: 1000,
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
        }),
        /*dht: kadDHT({
          clientMode: true,
        }),*/
      },
    };
  };
