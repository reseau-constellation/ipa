import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import {
  CircuitRelayService,
  circuitRelayServer,
  circuitRelayTransport,
} from "@libp2p/circuit-relay-v2";
import { FaultTolerance } from "@libp2p/interface";
import { UPnPNAT, uPnPNAT } from "@libp2p/upnp-nat";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import { webTransport } from "@libp2p/webtransport";
import { Libp2pOptions } from "libp2p";
import { obtStockageDonnées } from "../../utils.js";
import {
  ConfigOptionsLibp2p,
  ServicesLibp2pCrabeDéfaut,
  découvertePairs,
  servicesDéfaut,
} from "./utils.js";

export type ServicesLibp2pÉlectronPrincipal = ServicesLibp2pCrabeDéfaut & {
  upnp: UPnPNAT;
  relay: CircuitRelayService;
};

export const obtOptionsLibp2pÉlectronPrincipal = async (
  config: ConfigOptionsLibp2p,
): Promise<Libp2pOptions<ServicesLibp2pÉlectronPrincipal>> => {
  const { dossier, clefPrivée, pairsParDéfaut } = config;

  // Ces librairies-ci ne peuvent pas être compilées pour l'environnement
  // navigateur. Nous devons donc les importer dynamiquement ici afin d'éviter
  // des problèmes de compilation pour le navigateur.
  const { tcp } = await import("@libp2p/tcp");
  const { mdns } = await import("@libp2p/mdns");

  const stockage = await obtStockageDonnées(dossier);

  return {
    privateKey: clefPrivée,
    addresses: {
      listen: [
        "/ip4/0.0.0.0/tcp/0",
        "/ip4/0.0.0.0/tcp/0/ws",
        "/ip6/::/tcp/0",
        "/ip6/::/tcp/0/ws",
        "/webrtc",
        "/webtransport",
        "/p2p-circuit",
      ],
    },
    transportManager: {
      faultTolerance: FaultTolerance.NO_FATAL,
    },
    transports: [
      webSockets(),
      webRTC(),
      webTransport(),
      webRTCDirect(),
      tcp(),
      circuitRelayTransport(),
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr: () => false,
    },
    datastore: stockage,
    peerDiscovery: [mdns(), ...découvertePairs(config)],
    services: {
      ...servicesDéfaut({ pairsParDéfaut }),
      upnp: uPnPNAT(),
      relay: circuitRelayServer(),
    },
  };
};
