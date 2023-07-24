import { webRTCDirect } from "@libp2p/webrtc-direct";
import { webTransport } from "@libp2p/webtransport";
import type { create } from "ipfs-core";

import { ADRESSES_WEBRTC_STAR } from "./const.js";

const config: Parameters<typeof create>[0] = {
  libp2p: {
    transports: [webRTCDirect(), webTransport()],
    addresses: {
      listen: ADRESSES_WEBRTC_STAR,
    },
  },
};
export default config;
