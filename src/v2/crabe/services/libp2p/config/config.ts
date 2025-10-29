import { PrivateKey } from "@libp2p/interface";
import { Libp2pOptions } from "libp2p";
import {
  isBrowser,
  isElectronMain,
  isElectronRenderer,
  isNode,
  isWebWorker,
} from "wherearewe";
import {
  ADRESSES_NŒUDS_RELAI_WS,
  SUJETS_PUBSUB_DÉCOUVERTE_PAIRS,
} from "./const.js";
import { obtOptionsLibp2pNavigateur } from "./navigateur.js";
import { obtOptionsLibp2pNode } from "./node.js";
import { ConfigOptionsLibp2p, ServicesLibp2pCrabeDéfaut } from "./utils.js";
import {
  obtOptionsLibp2pTravailleur,
  obtOptionsLibp2pÉlectronPrincipal,
} from "./index.js";

export type ConfigLibp2p = {
  dossier?: string;
  domaines?: string[];
  pairsParDéfaut?: string[];
  sujetsDécouvertePairsPubSub?: string[];
  clefPrivée?: PrivateKey;
};

export const obtenirOptionsLibp2p = (config: ConfigLibp2p = {}) => {
  return async ({
    dossier,
    clefPrivée,
  }: {
    dossier: string;
    clefPrivée?: PrivateKey;
  }): Promise<Libp2pOptions<ServicesLibp2pCrabeDéfaut>> => {
    if (isElectronRenderer)
      console.warn(
        "Utiliser dans le processus principal d'Électron pour une meilleure performance.",
      );
    const { domaines, pairsParDéfaut, sujetsDécouvertePairsPubSub } = config;

    const configOptions: ConfigOptionsLibp2p = {
      domaines,
      pairsParDéfaut: pairsParDéfaut ?? ADRESSES_NŒUDS_RELAI_WS,
      sujetsDécouvertePairsPubSub:
        sujetsDécouvertePairsPubSub ?? SUJETS_PUBSUB_DÉCOUVERTE_PAIRS,

      // Prioriser les valeurs de `config`
      dossier: config.dossier ?? dossier,
      clefPrivée: config.clefPrivée ?? clefPrivée,
    };

    if (isBrowser || isElectronRenderer) {
      return await obtOptionsLibp2pNavigateur(configOptions);
    } else if (isWebWorker) {
      return await obtOptionsLibp2pTravailleur(configOptions);
    } else if (isElectronMain) {
      return (await obtOptionsLibp2pÉlectronPrincipal(
        configOptions,
      )) as Libp2pOptions<ServicesLibp2pCrabeDéfaut>;
    } else if (isNode) {
      return (await obtOptionsLibp2pNode(
        configOptions,
      )) as Libp2pOptions<ServicesLibp2pCrabeDéfaut>;
    } else {
      console.warn(
        "Plateforme non reconnue. On utilisera la configuration navigateur.",
      );
      return await obtOptionsLibp2pNavigateur(configOptions);
    }
  };
};
