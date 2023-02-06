import { webRTCStar } from "@libp2p/webrtc-star";
import { webSockets } from "@libp2p/websockets";
import { webRTCDirect } from "@libp2p/webrtc-direct";
import { noise } from "@chainsafe/libp2p-noise";
import { tcp } from "@libp2p/tcp";

import { kadDHT} from "@libp2p/kad-dht"
import { create } from "ipfs";

// https://github.com/libp2p/js-libp2p/blob/master/doc/CONFIGURATION.md#setup-webrtc-transport-and-discovery
// https://github.com/ipfs/js-ipfs/blob/master/packages/ipfs-core-config/src/libp2p.browser
// https://github.com/ipfs/js-ipfs/blob/master/packages/ipfs-core-config/src/libp2p
const config: Parameters<typeof create>[0] = {
    libp2p: {
        transports: [tcp, webRTCStar, webSockets, webRTCDirect],
        connectionEncryption: [noise],
        dht: kadDHT(),
    }
};

export default config
