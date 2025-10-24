import { peerIdFromString } from "@libp2p/peer-id";
import { multiaddr } from "@multiformats/multiaddr";
import { ServiceFactoryMap } from "libp2p";
import {
  GossipSub,
  GossipSubComponents,
  gossipsub,
} from "@chainsafe/libp2p-gossipsub";
import { autoNAT } from "@libp2p/autonat";
import { dcutr } from "@libp2p/dcutr";
import { IdentifyPush, identify, identifyPush } from "@libp2p/identify";
import { Ping, ping } from "@libp2p/ping";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { bootstrap } from "@libp2p/bootstrap";
import { Reconnecteur, reconnecteur } from "../reconnecteur.js";
import { ServicesLibp2pCrabe } from "../libp2p.js";
import type { PrivateKey } from "@libp2p/interface";
import type { AddrInfo } from "@chainsafe/libp2p-gossipsub/types";

export interface ConfigOptionsLibp2p {
  dossier: string;
  pairsParDéfaut?: string[];
  sujetsDécouvertePairsPubSub?: string[];
  clefPrivée?: PrivateKey;
  domaines?: string[];
}

// Service clef privée
export interface ComposantesServiceClefPrivée {
  privateKey: PrivateKey;
}

export class ServiceClefPrivée {
  privateKey: PrivateKey;

  constructor(components: ComposantesServiceClefPrivée) {
    this.privateKey = components.privateKey;
  }

  obtenirClef(): PrivateKey {
    return this.privateKey;
  }
}

// Fonctions utilitaires
export const résoudreInfoAdresses = (adresses: string[]): AddrInfo[] => {
  const infos: AddrInfo[] = [];
  for (const adresse of adresses) {
    const ma = multiaddr(adresse);
    const idPair = ma.getPeerId();
    if (!idPair) continue;
    const info: AddrInfo = infos.find((i) => i.id.toString() === idPair) || {
      id: peerIdFromString(idPair),
      addrs: [],
    };
    info.addrs.push(ma);
  }
  return infos;
};

export const scoreAppli = (adressesRelai: string[]) => (p: string) => {
  if (adressesRelai.map((adr) => multiaddr(adr).getPeerId()).includes(p)) {
    return 150;
  }

  return 0;
};

const optionsIdentify = {
  maxMessageSize: 1e6,
  maxInboundStreams: 50,
  maxOutboundStreams: 50,
};

// https://github.com/libp2p/specs/blob/master/pubsub/gossipsub/gossipsub-v1.1.md#recommendations-for-network-operators

export type ServicesLibp2pCrabeDéfaut = ServicesLibp2pCrabe & {
  ping: Ping;
  identifyPush: IdentifyPush;
  reconnecteur: Reconnecteur;
};

export const servicesDéfaut = ({
  pairsParDéfaut,
}: {
  pairsParDéfaut?: string[];
}): ServiceFactoryMap<ServicesLibp2pCrabeDéfaut> => {
  const services = {
    ping: ping(),
    identify: identify(optionsIdentify),
    identifyPush: identifyPush(optionsIdentify),
    autoNAT: autoNAT(),
    dcutr: dcutr(),
    reconnecteur: reconnecteur({
      liste: pairsParDéfaut || [],
    }),
    pubsub: gossipsub({
      allowPublishToZeroTopicPeers: true,
      runOnLimitedConnection: true,
      canRelayMessage: true,
      directPeers: résoudreInfoAdresses(pairsParDéfaut || []),
      scoreParams: {
        appSpecificScore: scoreAppli(pairsParDéfaut || []),
      },
      scoreThresholds: {
        acceptPXThreshold: 100,
      },
    }) as (components: GossipSubComponents) => GossipSub, // Erreur de type dans @chainsafe/pubsub
    obtClefPrivée: (components: ComposantesServiceClefPrivée) =>
      new ServiceClefPrivée(components),
  };
  return services;
};

export const découvertePairs = (config: ConfigOptionsLibp2p) => {
  const découverte = [
    bootstrap({
      list: config.pairsParDéfaut || [],
      timeout: 0,
    }),
    pubsubPeerDiscovery({
      interval: 1000,
      topics: config.sujetsDécouvertePairsPubSub, // par défaut : ['_peer-discovery._p2p._pubsub']
      listenOnly: false,
    }),
  ];
  return découverte;
};
