import {
  isBrowser,
  isElectronMain,
  isElectronRenderer,
  isNode,
  isWebWorker,
} from "wherearewe";
import { Helia, createHelia } from "helia";
import { LevelBlockstore } from "blockstore-level";
import { bitswap } from "@helia/block-brokers";

import { createLibp2p, type Libp2pOptions } from "libp2p";
import type { GossipSub } from "@chainsafe/libp2p-gossipsub";
import type { Libp2p } from "@libp2p/interface";

import { obtOptionsLibp2pNode } from "./configNode.js";
import { obtOptionsLibp2pÉlectionPrincipal } from "./configÉlectronPrincipal.js";
import { obtOptionsLibp2pNavigateur } from "./configNavigateur.js";
import { obtOptionsLibp2pTravailleurWeb } from "./configTravailleur.js";
import { multiaddr } from "@multiformats/multiaddr";
import { ADRESSES_NŒUDS_RELAI } from "./const.js";

export type ServicesLibp2p = { pubsub: GossipSub };

const obtConfigLibp2pPlateforme = async (): Promise<Libp2pOptions> => {
  let configPlateforme: Libp2pOptions;
  if (isBrowser || isElectronRenderer) {
    // À faire - migrer vers travailleur ?
    configPlateforme = await obtOptionsLibp2pNavigateur();
  } else if (isWebWorker) {
    configPlateforme = await obtOptionsLibp2pTravailleurWeb();
  } else if (isElectronMain) {
    configPlateforme = await obtOptionsLibp2pÉlectionPrincipal();
  } else if (isNode) {
    configPlateforme = await obtOptionsLibp2pNode();
  } else {
    console.warn(
      "Plateforme non reconnue. On utilisera la configuration navigateur.",
    );
    configPlateforme = await obtOptionsLibp2pNavigateur();
  }
  return configPlateforme;
};

export async function initSFIP(
  dossier: string,
): Promise<Helia<Libp2p<ServicesLibp2p>>> {
  const config = await obtConfigLibp2pPlateforme();

  const libp2p = (await createLibp2p({
    ...config,
  })) as unknown as Libp2p<ServicesLibp2p>;

  const stockageBloques = new LevelBlockstore(`${dossier}/blocks`);

  const optionsHelia = {
    blockstore: stockageBloques,
    libp2p,
    blockBrokers: [bitswap()],
  };

  const hélia = await createHelia<Libp2p<ServicesLibp2p>>({ ...optionsHelia });

  // À faire : configuer la connection automatique avec bootstrap ?
  for (const adresse of ADRESSES_NŒUDS_RELAI) {
    try {
      await hélia.libp2p.dial(
        multiaddr(adresse),
      );
    } catch {
      // Rien à faire
    }
  }
  return hélia;
}
