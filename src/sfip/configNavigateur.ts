import {
  createDelegatedRoutingV1HttpApiClient,
  DelegatedRoutingV1HttpApiClient,
} from '@helia/delegated-routing-v1-http-api-client'
import { identify } from "@libp2p/identify";
import { webSockets } from "@libp2p/websockets";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webTransport } from "@libp2p/webtransport";
import { bootstrap } from "@libp2p/bootstrap";
import { all } from "@libp2p/websockets/filters";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { autoNAT } from "@libp2p/autonat";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { dcutr } from "@libp2p/dcutr";
import { kadDHT } from "@libp2p/kad-dht";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { Multiaddr } from '@multiformats/multiaddr';
import first from 'it-first'
import { peerIdFromString } from '@libp2p/peer-id'

import type { Libp2pOptions } from "libp2p";
import { ADRESSES_NŒUDS_RELAI, IDS_NŒUDS_RELAI } from "./const.js";
import { PeerId } from '@libp2p/interface';

export const obtOptionsLibp2pNavigateur = async (): Promise<Libp2pOptions> => {
  
  const delegatedClient = createDelegatedRoutingV1HttpApiClient('https://delegated-ipfs.dev')
  const { bootstrapAddrs, relayListenAddrs } = await getBootstrapMultiaddrs(delegatedClient)

  return {
    addresses: {
      listen: ["/webrtc", "/webtransport", ...relayListenAddrs],
    },
    transports: [
      webSockets({
        filter: all,
      }),
      webRTC({
        rtcConfiguration: {
          iceServers: [
            {
              urls: [
                "stun:stun.l.google.com:19302",
                "stun:global.stun.twilio.com:3478",
              ],
            },
          ],
        },
      }),
      webRTCDirect(),
      webTransport(),
      circuitRelayTransport({
        discoverRelays: 1,
      }),
    ],
    connectionManager: {
      maxConnections: 30,
      minConnections: 5,
    },
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr: () => false,
    },
    peerDiscovery: [
      bootstrap({
        list: [...ADRESSES_NŒUDS_RELAI,  "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
        "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
        "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
        "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",],
        timeout: 0,
      }),
      pubsubPeerDiscovery({
        interval: 1000,
        topics: ["constellation._peer-discovery._p2p._pubsub"], // par défaut : ['_peer-discovery._p2p._pubsub']
        listenOnly: false,
      }),
    ],
    services: {
      identify: identify(),
      autoNAT: autoNAT(),
      dcutr: dcutr(),
      pubsub: gossipsub({ 
        allowPublishToZeroTopicPeers: true, 
        ignoreDuplicatePublishError: true 
      }),
      dht: kadDHT({
        clientMode: true,
      }),
      delegatedRouting:  () => delegatedClient,
    },
  };
};

interface BootstrapsMultiaddrs {
  // Multiaddrs that are dialable from the browser
  bootstrapAddrs: string[]

  // multiaddr string representing the circuit relay v2 listen addr
  relayListenAddrs: string[]
}

// Function which resolves PeerIDs of rust/go bootstrap nodes to multiaddrs dialable from the browser
// Returns both the dialable multiaddrs in addition to the relay
async function getBootstrapMultiaddrs(
  client: DelegatedRoutingV1HttpApiClient,
): Promise<BootstrapsMultiaddrs> {
  const peers = await Promise.all(
    IDS_NŒUDS_RELAI.map((peerId) => first(client.getPeers(peerIdFromString(peerId)))),
  )

// Constructs a multiaddr string representing the circuit relay v2 listen address for a relayed connection to the given peer.
const getRelayListenAddr = (maddr: Multiaddr, peer: PeerId): string =>
  `${maddr.toString()}/p2p/${peer.toString()}/p2p-circuit`

  const bootstrapAddrs = []
  const relayListenAddrs = []
  for (const p of peers) {
    if (p && p.Addrs.length > 0) {
      for (const maddr of p.Addrs) {
        const protos = maddr.protoNames()
        if (
          (protos.includes('webtransport') || protos.includes('webrtc-direct')) &&
          protos.includes('certhash')
        ) {
          if (maddr.nodeAddress().address === '127.0.0.1') continue // skip loopback
          bootstrapAddrs.push(maddr.toString())
          relayListenAddrs.push(getRelayListenAddr(maddr, p.ID))
        }
      }
    }
  }
  return { bootstrapAddrs, relayListenAddrs }
}