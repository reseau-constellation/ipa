import {
  isBrowser,
  isElectronMain,
  isElectronRenderer,
  isNode,
  isWebWorker,
} from "wherearewe";
import mergeOptions from "merge-options";

import type { GossipSub } from "@chainsafe/libp2p-gossipsub";
import { DefaultLibp2pServices, HeliaInit, HeliaLibp2p, createHelia } from "helia";
import { LevelDatastore } from 'datastore-level'
import { LevelBlockstore } from "blockstore-level";
import { bitswap } from "@helia/block-brokers";
import { Libp2p, createLibp2p, type Libp2pOptions } from "libp2p";

import { obtOptionsLibp2pNode } from "./configNode.js";
import { obtOptionsLibp2pÉlectionPrincipal } from "./configÉlectronPrincipal.js";
import { obtOptionsLibp2pNavigateur } from "./configNavigateur.js";
import { obtOptionsLibp2pTravailleurWeb } from "./configTravailleur.js";
import * as consts from "./const.js";

export type ServicesLibp2p = DefaultLibp2pServices & { pubsub: GossipSub };

export const obtConfigLibp2pPlateforme = async (): Promise<Libp2pOptions> => {
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
  const configParDéfaut = await obtConfigLibp2pPlateforme();

  const libp2p = (await createLibp2p(
    mergeOptions(configParDéfaut, configLibp2p),
  )) as Libp2p<DefaultLibp2pServices>;

  // À faire : créer un gestionnaire de pairs plus idiomatique et efficace
  libp2p.addEventListener("peer:discovery", async (x) => {
    try {
      await libp2p.dial(x.detail.id);
    } catch {
      // Tant pis...
    }
  });
  const stockageBloques = new LevelBlockstore(`${dossier}/blocks`);
  const stockageDonnées = new LevelDatastore(`${dossier}/données`);

  const optionsHelia: HeliaInit = {
    blockstore: stockageBloques,
    datastore: stockageDonnées,
    libp2p,
    blockBrokers: [bitswap()],
  };

  return (await createHelia({ ...optionsHelia })) as HeliaLibp2p<
    Libp2p<ServicesLibp2p>
  >;
}

export {
  obtOptionsLibp2pNavigateur,
  obtOptionsLibp2pNode,
  obtOptionsLibp2pÉlectionPrincipal,
  obtOptionsLibp2pTravailleurWeb,
  consts,
};
