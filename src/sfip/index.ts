import mergeOptions from "merge-options";
import {
  isBrowser,
  isElectronMain,
  isElectronRenderer,
  isNode,
  isWebWorker,
} from "wherearewe";

import { bitswap } from "@helia/block-brokers";
import { IDBBlockstore } from "blockstore-idb";
import { IDBDatastore } from "datastore-idb";
import {
  DefaultLibp2pServices,
  HeliaInit,
  HeliaLibp2p,
  createHelia,
} from "helia";
import { Libp2p, createLibp2p, type Libp2pOptions } from "libp2p";

import { obtOptionsLibp2pNavigateur } from "./configNavigateur.js";
import { obtOptionsLibp2pNode } from "./configNode.js";
import { obtOptionsLibp2pTravailleurWeb } from "./configTravailleur.js";
import { obtOptionsLibp2pÉlectionPrincipal } from "./configÉlectronPrincipal.js";
import * as consts from "./const.js";
import type { GossipSub } from "@chainsafe/libp2p-gossipsub";
import type { PrivateKey } from "@libp2p/interface";

export type ServicesLibp2p = DefaultLibp2pServices & { pubsub: GossipSub; obtClefPrivée: ServiceClefPrivée};

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

interface ComposantesServiceClefPrivée {
  privateKey: PrivateKey;
}

class ServiceClefPrivée {
  private privateKey: PrivateKey;

  constructor(components: ComposantesServiceClefPrivée) {
    this.privateKey = components.privateKey;
  }

  obtenirClef(): PrivateKey {
    return this.privateKey;
  }
}

export async function initSFIP({
  dossier,
  clefPrivée,
  configLibp2p = {},
}: {
  dossier: string;
  clefPrivée?: PrivateKey;
  configLibp2p?: Libp2pOptions;
}): Promise<HeliaLibp2p<Libp2p<ServicesLibp2p>>> {
  const configParDéfaut = await obtConfigLibp2pPlateforme();

  configParDéfaut.privateKey = clefPrivée;
  configParDéfaut.services = configParDéfaut.services || {};
  configParDéfaut.services.obtClefPrivée = (components: ComposantesServiceClefPrivée) =>
    new ServiceClefPrivée(components);

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
  const dossierDonnées = `${dossier}/données`;
  const dossierBloques = `${dossier}/blocks`;

  // Importer FsBlockstore et FsDatastore dynamiquement pour éviter les erreurs de compilation sur le navigateur
  const stockageBloques =
    isNode || isElectronMain
      ? new (await import("blockstore-fs")).FsBlockstore(dossierBloques)
      : new IDBBlockstore(dossierBloques);
  const stockageDonnées =
    isNode || isElectronMain
      ? new (await import("datastore-fs")).FsDatastore(dossierDonnées)
      : new IDBDatastore(dossierDonnées);

  // Ouverture manuelle requise pour une drôle de raison pour l'instant.
  if (!(isNode || isElectronMain)) {
    await stockageBloques.open();
    await stockageDonnées.open();
  }

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
  consts,
  obtOptionsLibp2pNavigateur,
  obtOptionsLibp2pNode,
  obtOptionsLibp2pTravailleurWeb,
  obtOptionsLibp2pÉlectionPrincipal,
};
