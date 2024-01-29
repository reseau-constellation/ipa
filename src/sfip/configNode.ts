import { identify } from '@libp2p/identify'
import { webSockets } from '@libp2p/websockets'
import { webRTC } from '@libp2p/webrtc'
import { all } from '@libp2p/websockets/filters'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import type {  } from "@libp2p/interface";
import { tcp } from '@libp2p/tcp'

export const OptionsLibp2pNode = {
  addresses: {
    listen: ['/ip4/0.0.0.0/tcp/0/ws']
  },
  transports: [
    webSockets({
      filter: all
    }),
    webRTC(),
    circuitRelayTransport({
      discoverRelays: 1
    }),
    tcp(),
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
