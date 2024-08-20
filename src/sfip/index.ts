import {
  isBrowser,
  isElectronMain,
  isElectronRenderer,
  isNode,
  isWebWorker,
} from "wherearewe";
import mergeOptions from "merge-options";

import type { GossipSub } from "@chainsafe/libp2p-gossipsub";
import { DefaultLibp2pServices, HeliaLibp2p, createHelia } from "helia";
import { LevelBlockstore } from "blockstore-level";
import { bitswap } from "@helia/block-brokers";
import { Libp2p, createLibp2p, type Libp2pOptions } from "libp2p";

import { obtOptionsLibp2pNode } from "./configNode.js";
import { obtOptionsLibp2pÉlectionPrincipal } from "./configÉlectronPrincipal.js";
import { obtOptionsLibp2pNavigateur } from "./configNavigateur.js";
import { obtOptionsLibp2pTravailleurWeb } from "./configTravailleur.js";

export type ServicesLibp2p = DefaultLibp2pServices & { pubsub: GossipSub };

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

export async function initSFIP({
  dossier,
  configLibp2p = {},
}: {
  dossier: string;
  configLibp2p?: Libp2pOptions;
}): Promise<HeliaLibp2p<Libp2p<ServicesLibp2p>>> {
  const config = await obtConfigLibp2pPlateforme();

  const libp2p = (await createLibp2p(
    mergeOptions(configLibp2p, {
      ...config,
    }),
  )) as Libp2p<DefaultLibp2pServices>;

  const stockageBloques = new LevelBlockstore(`${dossier}/blocks`);

  const optionsHelia = {
    blockstore: stockageBloques,
    libp2p,
    blockBrokers: [bitswap()],
  };

  return (await createHelia({ ...optionsHelia })) as HeliaLibp2p<
    Libp2p<ServicesLibp2p>
  >;
}
