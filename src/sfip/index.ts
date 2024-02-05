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

export type ServicesLibp2p = { pubsub: GossipSub };

const obtConfigLibp2pPlateforme = async (): Promise<Libp2pOptions> => {
  let configPlateforme: Libp2pOptions;
  if (isBrowser || isElectronRenderer) {
    configPlateforme = (await import("@/sfip/configNavigateur.js"))
      .OptionsLibp2pNavigateur;
  } else if (isWebWorker) {
    configPlateforme = (await import("@/sfip/configTravailleur.js"))
      .OptionsLibp2pTravailleurWeb;
  } else if (isElectronMain) {
    configPlateforme = (await import("@/sfip/configÉlectronPrincipal.js"))
      .OptionsLibp2pÉlectionPrincipal;
  } else if (isNode) {
    configPlateforme = (await import("@/sfip/configNode.js")).OptionsLibp2pNode;
  } else {
    console.warn(
      "Plateforme non reconnue. On utilisera la configuration navigateur.",
    );
    configPlateforme = (await import("@/sfip/configNavigateur.js"))
      .OptionsLibp2pNavigateur;
  }
  return configPlateforme;
};

export default async function initSFIP(
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

  return await createHelia<Libp2p<ServicesLibp2p>>({ ...optionsHelia });
}
