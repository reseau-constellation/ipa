import { webRTCStar } from "@libp2p/webrtc-star";
import { webSockets } from "@libp2p/websockets";
import { webRTCDirect } from "@libp2p/webrtc-direct";
import { create } from "ipfs";

const config: Parameters<typeof create>[0] = {
  libp2p: {
    transports: [webRTCStar(), webSockets(), webRTCDirect()],
  }
};
export default config
