
import { identify } from '@libp2p/identify'
import { webSockets } from '@libp2p/websockets'
import { webRTC as libp2pWebRTC } from '@libp2p/webrtc'
import { all } from '@libp2p/websockets/filters'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import type {  } from "@libp2p/interface";

import webRTC from "@constl/electron-webrtc-relay";

const wrtc = webRTC();
wrtc.init();

export const OptionsLibp2pÉlectionPrincipal = {
  addresses: {
    listen: ['/ip4/0.0.0.0/tcp/0/ws']
  },
  transports: [
    webSockets({
      filter: all
    }),
    libp2pWebRTC({}),
    circuitRelayTransport({
      discoverRelays: 1
    })
  ],
  connectionEncryption: [noise()],
  streamMuxers: [yamux()],
  connectionGater: {
    denyDialMultiaddr: () => false
  },
  services: {
    identify: identify(),
    pubsub: gossipsub({ allowPublishToZeroPeers: true })
  }
}
