import { identify } from "@libp2p/identify";
import { webSockets } from "@libp2p/websockets";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webTransport } from "@libp2p/webtransport";
import { bootstrap } from "@libp2p/bootstrap";
import { all } from "@libp2p/websockets/filters";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import type { Libp2pOptions } from "libp2p";
import { WEBRTC_BOOTSTRAP_NODE, WEBTRANSPORT_BOOTSTRAP_NODE } from "./const.js";

export const obtOptionsLibp2pNavigateur = async (): Promise<Libp2pOptions> => {
  return {
    addresses: {
      listen: ["/webrtc"],
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
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr: () => false,
    },
    peerDiscovery: [
      bootstrap({
        list: [WEBRTC_BOOTSTRAP_NODE, WEBTRANSPORT_BOOTSTRAP_NODE],
        tagTTL: Infinity,
      }),
    ],
    services: {
      identify: identify(),
      pubsub: gossipsub({ allowPublishToZeroPeers: true }),
    },
  };
};
