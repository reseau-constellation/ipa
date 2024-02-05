import { identify } from "@libp2p/identify";
import { webSockets } from "@libp2p/websockets";
import { webRTC as libp2pWebRTC } from "@libp2p/webrtc";
import { webTransport } from "@libp2p/webtransport";
import { bootstrap } from "@libp2p/bootstrap";
import { all } from "@libp2p/websockets/filters";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import type { Libp2pOptions } from "libp2p";
import { ADRESSES_NŒUDS_RELAI } from "./const.js";

export const obtOptionsLibp2pÉlectionPrincipal =
  async (): Promise<Libp2pOptions> => {
    const { tcp } = await import("@libp2p/tcp");
    const { webRTC } = await import("@constl/electron-webrtc-relay");

    const wrtc = webRTC();
    wrtc.init();
    return {
      addresses: {
        listen: ["/ip4/0.0.0.0/tcp/0/ws"],
      },
      transports: [
        webSockets({
          filter: all,
        }),
        libp2pWebRTC({}),
        webTransport(),
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
      ],
      services: {
        identify: identify(),
        pubsub: gossipsub({ allowPublishToZeroPeers: true }),
      },
    };
  };
