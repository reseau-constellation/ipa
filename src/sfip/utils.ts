import { peerIdFromString } from "@libp2p/peer-id";
import { multiaddr } from "@multiformats/multiaddr";
import type { AddrInfo } from "@chainsafe/libp2p-gossipsub/dist/src/types";
import { ADRESSES_NŒUDS_RELAI_RUST, ADRESSES_NŒUDS_RELAI_WS } from "./const.js";

export const résoudreInfoAdresses = (adresses: string[]): AddrInfo[] => {
  const infos: AddrInfo[] = [];
  for (const adresse of adresses) {
    const ma = multiaddr(adresse);
    const idPaire = ma.getPeerId();
    if (!idPaire) continue;
    const info: AddrInfo = infos.find((i) => i.id.toString() === idPaire) || {
      id: peerIdFromString(idPaire),
      addrs: [],
    };
    info.addrs.push(ma);
  }
  return infos;
};


export function applicationScore(p: string) {
  if ([...ADRESSES_NŒUDS_RELAI_RUST, ...ADRESSES_NŒUDS_RELAI_WS].map(adr => multiaddr(adr).getPeerId()).includes(p)) {
    return 150
  }

  return 0
}
