import { webSockets } from "@libp2p/websockets";
import { webRTCDirect } from "@libp2p/webrtc-direct";
import { webRTCStar } from "@libp2p/webrtc-star";
import { kadDHT } from "@libp2p/kad-dht";
import { webTransport } from "@libp2p/webtransport"
import type { create } from "ipfs-core";

import wrtc from "wrtc";
import { ADRESSES_WEBRTC_STAR } from "./const.js";

const webrtc = webRTCStar({
  wrtc
});

// https://github.com/libp2p/js-libp2p/blob/master/doc/CONFIGURATION.md#setup-webrtc-transport-and-discovery
// https://github.com/ipfs/js-ipfs/blob/master/packages/ipfs-core-config/src/libp2p.browser
// https://github.com/ipfs/js-ipfs/blob/master/packages/ipfs-core-config/src/libp2p
const config: Parameters<typeof create>[0] = {
  libp2p: {
    transports: [webTransport(), webSockets(), webrtc.transport, webRTCDirect({wrtc})],
    peerDiscovery: [webrtc.discovery],
    dht: kadDHT(),
    addresses: {
      listen: ADRESSES_WEBRTC_STAR,
    },
  },
};

export default config;
