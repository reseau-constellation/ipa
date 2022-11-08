import { webRTCStar } from "@libp2p/webrtc-star";
import { webSockets } from "@libp2p/websockets";
import { webRTCDirect } from "@libp2p/webrtc-direct";

export default {
  modules: {
    transport: [webRTCStar, webSockets, webRTCDirect],
  },
};
