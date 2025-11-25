import {
  OptionsDéfautLibp2pNavigateur,
  OptionsDéfautLibp2pNode,
  obtenirAdresseRelai,
} from "@constl/utils-tests";
import { isBrowser, isElectronRenderer, isWebWorker } from "wherearewe";
import { ServiceLibp2p } from "@/v2/crabe/index.js";
import {
  obtenirOptionsLibp2p,
} from "@/v2/crabe/services/libp2p/config/config.js";
import type {
  ServicesLibp2pTest} from "@constl/utils-tests";
import type { PrivateKey } from "@libp2p/interface";
import type { Libp2pOptions } from "libp2p";
import type {
  ServicesLibp2pCrabe,
  ServicesNécessairesLibp2p,
} from "@/v2/crabe/services/libp2p/libp2p.js";
import type { Nébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import type {
  ConfigLibp2p} from "@/v2/crabe/services/libp2p/config/config.js";

export const obtenirOptionsLibp2pLocal = (config: ConfigLibp2p = {}) => {
  return obtenirOptionsLibp2p({
    ...config,
    pairsParDéfaut: [obtenirAdresseRelai()],
  });
};

export const obtenirOptionsLibp2pTest = (
  config: Omit<
    ConfigLibp2p,
    "pairsParDéfaut" | "domaines" | "sujetsDécouvertePairsPubSub" | "dossier"
  > = {},
) => {
  return async ({
    clefPrivée,
  }: {
    clefPrivée?: PrivateKey;
  }): Promise<Libp2pOptions<ServicesLibp2pCrabe>> => {
    clefPrivée = config.clefPrivée ?? clefPrivée;

    const options =
      isBrowser || isElectronRenderer || isWebWorker
        ? OptionsDéfautLibp2pNavigateur()
        : OptionsDéfautLibp2pNode();
    if (clefPrivée) options.privateKey = clefPrivée;
    return options;
  };
};

export class ServiceLibp2pTest extends ServiceLibp2p<ServicesLibp2pTest> {
  constructor({
    nébuleuse,
  }: {
    nébuleuse: Nébuleuse<ServicesNécessairesLibp2p<ServicesLibp2pTest>>;
  }) {
    super({
      nébuleuse,
    });
    this.options.libp2p = obtenirOptionsLibp2pTest();
  }
}
