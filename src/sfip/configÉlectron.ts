const WebRTCStar = import( "@libp2p/webrtc-star");
const WebSockets = import("@libp2p/websockets");
const WebRTCDirect = import("@libp2p/webrtc-direct");
const MulticastDNS = import("@libp2p/mdns");
const KadDHT = import("@libp2p/kad-dht");
import { Noise } from "@chainsafe/libp2p-noise";
import { TCP } from "@libp2p/tcp";

// https://github.com/libp2p/js-libp2p/blob/master/doc/CONFIGURATION.md#setup-webrtc-transport-and-discovery
// https://github.com/ipfs/js-ipfs/blob/master/packages/ipfs-core-config/src/libp2p.browser
// https://github.com/ipfs/js-ipfs/blob/master/packages/ipfs-core-config/src/libp2p
export default async() => {
  return {
  transport: [TCP,
    // (await WebRTCStar).WebRTCStar, 
    (await WebSockets).WebSockets, (await WebRTCDirect).WebRTCDirect],
  connectionEncryption: [new Noise()],
  peerDiscovery: [(await MulticastDNS).MulticastDNS],
//  dht: (await KadDHT).KadDHT,
}};
