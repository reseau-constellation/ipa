import WebRTCStar from "libp2p-webrtc-star";
import { WebSockets } from "libp2p-websockets";
import { WebRTCDirect } from "libp2p-webrtc-direct";

export default {
  modules: {
    transport: [WebRTCStar, WebSockets, WebRTCDirect],
  },
};
