import { identify } from "@libp2p/identify";
import { webSockets } from "@libp2p/websockets";
import { webRTC as libp2pWebRTC, webRTCDirect } from "@libp2p/webrtc";
import { webTransport } from "@libp2p/webtransport";
import { bootstrap } from "@libp2p/bootstrap";
import { all } from "@libp2p/websockets/filters";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import type { Libp2pOptions } from "libp2p";
import { ADRESSES_NŒUDS_RELAI } from "./const.js";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { autoNAT } from "@libp2p/autonat";
import { dcutr } from "@libp2p/dcutr";
import { kadDHT } from "@libp2p/kad-dht";

export const obtOptionsLibp2pÉlectionPrincipal =
  async (): Promise<Libp2pOptions> => {
    const { tcp } = await import("@libp2p/tcp");
    const webRTC = (await import("@constl/electron-webrtc-relay")).default;

    const wrtc = webRTC();
    wrtc.init();
    return {
      addresses: {
        listen: ["/ip4/0.0.0.0/tcp/0/ws", "/webrtc", "/webtransport"],
      },
      transports: [
        webSockets({
          filter: all,
        }),
        libp2pWebRTC({
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
        bootstrap({
          list: ADRESSES_NŒUDS_RELAI,
          tagTTL: Infinity,
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
        pubsub: gossipsub({ allowPublishToZeroPeers: true }),
        dht: kadDHT({
          //   protocolPrefix: "/svelte-pubsub",
          //   maxInboundStreams: 5000,
          //   maxOutboundStreams: 5000,
          clientMode: false,
        }),
      },
    };
  };
