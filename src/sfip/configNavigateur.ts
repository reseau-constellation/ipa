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
import { kadDHT } from "@libp2p/kad-dht";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";

import type { Libp2pOptions } from "libp2p";
import { obtAdressesDépart, obtClientDélégation } from './utils.js';

export const obtOptionsLibp2pNavigateur = async (): Promise<Libp2pOptions> => {
  const { bootstrapAddrs, relayListenAddrs } = await obtAdressesDépart();
  const delegatedClient = obtClientDélégation();

  return {
    addresses: {
      listen: ["/webrtc","/webtransport", ...relayListenAddrs],
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
      webRTCDirect(),
      webTransport(),
      circuitRelayTransport({
        discoverRelays: 1,
      }),
    ],
    connectionManager: {
      maxConnections: 30,
      minConnections: 5,
    },
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr: () => false,
    },
    peerDiscovery: [
      bootstrap({
        list: bootstrapAddrs,
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
        ignoreDuplicatePublishError: true 
      }),
      dht: kadDHT({
        clientMode: true,
      }),
      delegatedRouting:  () => delegatedClient,
    },
  };
};
