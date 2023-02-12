import { webSockets } from "@libp2p/websockets";
import { webRTCDirect } from "@libp2p/webrtc-direct";

import { kadDHT } from "@libp2p/kad-dht";
import type { create } from "ipfs-core";

import { ADRESSES_WEBRTC_STAR } from "./const.js";

// https://github.com/libp2p/js-libp2p/blob/master/doc/CONFIGURATION.md#setup-webrtc-transport-and-discovery
// https://github.com/ipfs/js-ipfs/blob/master/packages/ipfs-core-config/src/libp2p.browser
// https://github.com/ipfs/js-ipfs/blob/master/packages/ipfs-core-config/src/libp2p
const config: Parameters<typeof create>[0] = {
  libp2p: {
    transports: [webSockets(), webRTCDirect()],
    dht: kadDHT(),
    addresses: {
      listen: ADRESSES_WEBRTC_STAR,
    },
  },
};

export default config;
