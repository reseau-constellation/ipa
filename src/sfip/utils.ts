
import {
  createDelegatedRoutingV1HttpApiClient,
  type DelegatedRoutingV1HttpApiClient,
} from '@helia/delegated-routing-v1-http-api-client'
import { Multiaddr } from '@multiformats/multiaddr';
import first from 'it-first'
import { peerIdFromString } from '@libp2p/peer-id'

import { ADRESSES_INITIALES, IDS_NŒUDS_RELAI } from "./const.js";
import { PeerId } from '@libp2p/interface';

let delegatedClient: DelegatedRoutingV1HttpApiClient;
export const obtClientDélégation = () => {
  if (!delegatedClient) delegatedClient = createDelegatedRoutingV1HttpApiClient('https://delegated-ipfs.dev')
  return delegatedClient
}
export const obtAdressesDépart = async () => {
  return await getBootstrapMultiaddrs(
    obtClientDélégation()
  )
}

interface BootstrapsMultiaddrs {
  // Multiaddrs that are dialable from the browser
  bootstrapAddrs: string[]

  // multiaddr string representing the circuit relay v2 listen addr
  relayListenAddrs: string[]
}

// Function which resolves PeerIDs of rust/go bootstrap nodes to multiaddrs dialable from the browser
// Returns both the dialable multiaddrs in addition to the relay
export async function getBootstrapMultiaddrs(
  client: DelegatedRoutingV1HttpApiClient,
): Promise<BootstrapsMultiaddrs> {
  const peers = await Promise.all(
    IDS_NŒUDS_RELAI.map((peerId) => first(client.getPeers(peerIdFromString(peerId)))),
  )

  const bootstrapAddrs = [...ADRESSES_INITIALES];
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

// Constructs a multiaddr string representing the circuit relay v2 listen address for a relayed connection to the given peer.
const getRelayListenAddr = (maddr: Multiaddr, peer: PeerId): string =>
`${maddr.toString()}/p2p/${peer.toString()}/p2p-circuit`
