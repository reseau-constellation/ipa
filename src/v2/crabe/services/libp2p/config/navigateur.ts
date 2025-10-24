import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import { webTransport } from "@libp2p/webtransport";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { detect } from "detect-browser";

import { FaultTolerance } from "@libp2p/interface";
import { obtStockageDonnées } from "../../utils.js";
import {
  ConfigOptionsLibp2p,
  ServicesLibp2pCrabeDéfaut,
  découvertePairs,
  servicesDéfaut,
} from "./utils.js";
import type { Libp2pOptions } from "libp2p";

// https://github.com/libp2p/specs/blob/master/pubsub/gossipsub/gossipsub-v1.1.md#recommendations-for-network-operators

// https://github.com/ipfs/helia/blob/main/packages/helia/src/utils/libp2p-defaults.browser.ts#L34

export type ServicesLibp2pNavigateur = ServicesLibp2pCrabeDéfaut;

export const obtOptionsLibp2pNavigateur = async (
  config: ConfigOptionsLibp2p,
): Promise<Libp2pOptions<ServicesLibp2pNavigateur>> => {
  const { dossier, pairsParDéfaut, clefPrivée } = config;
  const stockage = await obtStockageDonnées(dossier);

  const options: Libp2pOptions<ServicesLibp2pCrabeDéfaut> = {
    privateKey: clefPrivée,
    addresses: {
      listen: ["/webrtc", "/webtransport", "/p2p-circuit"],
    },
    transportManager: {
      faultTolerance: FaultTolerance.NO_FATAL,
    },
    // En attendant une résolution à https://github.com/libp2p/js-libp2p-webtransport/issues/64
    transports: [
      ...[webSockets(), webRTC(), webRTCDirect(), circuitRelayTransport()],
      ...(detect()?.name === "chrome" ? [] : [webTransport()]),
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr: () => false,
    },
    datastore: stockage,
    peerDiscovery: découvertePairs(config),
    services: servicesDéfaut({ pairsParDéfaut }),
  };
  return options;
};
