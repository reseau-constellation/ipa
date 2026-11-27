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
} from "./const.ts";
import { obtOptionsLibp2pNavigateur } from "./navigateur.ts";
import { obtOptionsLibp2pNode } from "./node.ts";
import {
  obtOptionsLibp2pTravailleur,
  obtOptionsLibp2pÉlectronPrincipal,
} from "./index.ts";
import type {
  ConfigOptionsLibp2p,
  ServicesLibp2pNébuleuseDéfaut,
} from "./utils.ts";
import type { Libp2pOptions } from "libp2p";
import type { PrivateKey } from "@libp2p/interface";
import type {
  ConfigLibp2p,
  GénérateurOptionsLibp2p,
} from "@constl/interface/libp2p";

export const obtenirOptionsLibp2p = (
  config: ConfigLibp2p = {},
): GénérateurOptionsLibp2p<ServicesLibp2pNébuleuseDéfaut> => {
  return async ({
    dossier,
    clefPrivée,
    mode,
  }: {
    dossier: string;
    clefPrivée?: PrivateKey;
    mode: "dév" | "prod";
  }): Promise<Libp2pOptions<ServicesLibp2pNébuleuseDéfaut>> => {
    if (isElectronRenderer)
      console.warn(
        "Utiliser dans le processus principal d'Électron pour une meilleure performance.",
      );
    const { domaines, pairsParDéfaut, sujetsDécouvertePairsPubSub } = config;

    const configOptions: ConfigOptionsLibp2p = {
      domaines,
      mode,
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
      )) as Libp2pOptions<ServicesLibp2pNébuleuseDéfaut>;
    } else if (isNode) {
      return (await obtOptionsLibp2pNode(
        configOptions,
      )) as Libp2pOptions<ServicesLibp2pNébuleuseDéfaut>;
    } else {
      console.warn(
        "Plateforme non reconnue. On utilisera la configuration navigateur.",
      );
      return await obtOptionsLibp2pNavigateur(configOptions);
    }
  };
};
