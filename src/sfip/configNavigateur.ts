import { webSockets } from "@libp2p/websockets";
import { webRTCDirect } from "@libp2p/webrtc-direct";

import type { create } from "ipfs-core";
import { ADRESSES_WEBRTC_STAR } from "./const.js";
const config: Parameters<typeof create>[0] = {
  libp2p: {
    transports: [webSockets(), webRTCDirect()],
    addresses: {
      listen: ADRESSES_WEBRTC_STAR,
    },
  },
};
export default config;
