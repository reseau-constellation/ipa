import { webSockets } from "@libp2p/websockets";
import { webRTCDirect } from "@libp2p/webrtc-direct";
import type { create } from "ipfs";
const config: Parameters<typeof create>[0] = {
  libp2p: {
    transports: [webRTCDirect()],
  }
};
export default config
