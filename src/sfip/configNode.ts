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
// import { kadDHT } from "@libp2p/kad-dht";
import type { Libp2pOptions } from "libp2p";

import { ADRESSES_NŒUDS_RELAI } from "./const.js";

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
        "/webrtc-direct",
      ],
    },
    transports: [
      webSockets({
        filter: all,
      }),
      webRTC({
        rtcConfiguration: {
          iceServers: [
            {
              urls: [
                "stun:stun.l.google.com:19302",
                "stun:global.stun.twilio.com:3478",
              ],
            },
          ],
        },
      }),
      webTransport(),
      webRTCDirect(),
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
      mdns(),
      bootstrap({
        list: ADRESSES_NŒUDS_RELAI,
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
      pubsub: gossipsub({ allowPublishToZeroTopicPeers: true, runOnTransientConnection: true }),
      /*dht: kadDHT({
        clientMode: true,
      }),*/
    },
  };
};
