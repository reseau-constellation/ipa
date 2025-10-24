import { peerIdFromPrivateKey } from "@libp2p/peer-id";
import { Libp2pOptions } from "libp2p";
import { FaultTolerance } from "@libp2p/interface";
import { webSockets } from "@libp2p/websockets";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webTransport } from "@libp2p/webtransport";
import {
  CircuitRelayService,
  circuitRelayServer,
  circuitRelayTransport,
} from "@libp2p/circuit-relay-v2";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { UPnPNAT, uPnPNAT } from "@libp2p/upnp-nat";
import { obtStockageDonnées } from "../../utils.js";
import {
  ConfigOptionsLibp2p,
  ServicesLibp2pCrabeDéfaut,
  découvertePairs,
  servicesDéfaut,
} from "./utils.js";

export type ServicesLibp2pNode = ServicesLibp2pCrabeDéfaut & {
  upnp: UPnPNAT;
  relay: CircuitRelayService;
};

export const obtOptionsLibp2pNode = async (
  config: ConfigOptionsLibp2p,
): Promise<Libp2pOptions<ServicesLibp2pNode>> => {
  const { clefPrivée, dossier, domaines, pairsParDéfaut } = config;

  // Ces librairies-ci ne peuvent pas être compilées pour l'environnement
  // navigateur. Nous devons donc les importer dynamiquement ici afin d'éviter
  // des problèmes de compilation pour le navigateur.
  const { tcp } = await import("@libp2p/tcp");
  const { mdns } = await import("@libp2p/mdns");

  const idPair = clefPrivée ? peerIdFromPrivateKey(clefPrivée) : undefined;

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
      announce:
        domaines?.length && idPair
          ? domaines
              .map((domaine) => [
                `/dns4/${domaine}/tcp/443/wss/p2p/${idPair.toString()}`,
                `/dns4/${domaine}/tcp/80/ws/p2p/${idPair.toString()}`,
              ])
              .flat()
          : undefined,
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
