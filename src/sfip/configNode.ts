import { webRTCStar } from "@libp2p/webrtc-star";
import { webSockets } from "@libp2p/websockets";
import { webRTCDirect } from "@libp2p/webrtc-direct";
import wrtc from "wrtc";

import { kadDHT} from "@libp2p/kad-dht"
import type { create } from "ipfs";
import { ADRESSES_WEBRTC_STAR } from "./const.js";
const webRTC = webRTCStar({
    wrtc
  })
// https://github.com/libp2p/js-libp2p/blob/master/doc/CONFIGURATION.md#setup-webrtc-transport-and-discovery
// https://github.com/ipfs/js-ipfs/blob/master/packages/ipfs-core-config/src/libp2p.browser
// https://github.com/ipfs/js-ipfs/blob/master/packages/ipfs-core-config/src/libp2p
const config: Parameters<typeof create>[0] = {
    libp2p: {
        transports: [webSockets(), webRTC.transport, webRTCDirect()],
        peerDiscovery: [webRTC.discovery],
        dht: kadDHT(),
      addresses: {
        listen: ADRESSES_WEBRTC_STAR
      },
    }
};

export default config
