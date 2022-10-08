import { WebRTCStar } from "@libp2p/webrtc-star";
import { WebSockets } from "@libp2p/websockets";
import { WebRTCDirect } from "@libp2p/webrtc-direct";
import { MulticastDNS } from "@libp2p/mdns";
import { KadDHT } from "@libp2p/kad-dht";
import { Noise } from "@chainsafe/libp2p-noise";
import { TCP } from "@libp2p/tcp";

// https://github.com/libp2p/js-libp2p/blob/master/doc/CONFIGURATION.md#setup-webrtc-transport-and-discovery
// https://github.com/ipfs/js-ipfs/blob/master/packages/ipfs-core-config/src/libp2p.browser
// https://github.com/ipfs/js-ipfs/blob/master/packages/ipfs-core-config/src/libp2p
export default async () => {
  return {
    transport: [TCP, WebRTCStar, WebSockets, WebRTCDirect],
    connectionEncryption: [new Noise()],
    peerDiscovery: [MulticastDNS],
    dht: KadDHT,
  };
};
