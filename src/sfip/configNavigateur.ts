import { identify } from '@libp2p/identify'
import { webSockets } from '@libp2p/websockets'
import { webRTC } from '@libp2p/webrtc'
import { all } from '@libp2p/websockets/filters'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'

/**
 * A basic Libp2p configuration for browser nodes.
 */
export const OptionsLibp2pNavigateur = {
  addresses: {
    listen: ['/webrtc']
  },
  transports: [
    webSockets({
      filter: all
    }),
    webRTC(),
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
