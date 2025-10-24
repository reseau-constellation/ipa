import { ServicesLibp2pTest, dossierTempo } from "@constl/utils-tests";
import { ServiceLibp2p, ServiceStockage } from "@/v2/crabe/index.js";
import {
  ConstructeursServicesNébuleuse,
  Nébuleuse,
  OptionsNébuleuse,
  ServicesNébuleuse,
} from "@/v2/nébuleuse/nébuleuse.js";
import { Oublier } from "@/v2/crabe/types.js";
import { ServicesNécessairesLibp2p } from "@/v2/crabe/services/libp2p/libp2p.js";
import { obtenirOptionsLibp2pTest } from "./../../crabe/services/utils.js";

export const créerNébuleusesTest = async <T extends ServicesNébuleuse>({
  n,
  services,
}: {
  n: number;
  services: ConstructeursServicesNébuleuse<T>;
}): Promise<{
  nébuleuses: Nébuleuse<T & ServicesNécessairesLibp2p<ServicesLibp2pTest>>[];
  fermer: Oublier;
}> => {
  const { dossier, effacer } = await dossierTempo();

  const nébuleuses: Nébuleuse<
    T & ServicesNécessairesLibp2p<ServicesLibp2pTest>
  >[] = [];

  for (const _ in Array(n).entries) {
    const nébuleuse = new Nébuleuse<
      T & ServicesNécessairesLibp2p<ServicesLibp2pTest>
    >({
      services: {
        ...services,
        libp2p: ServiceLibp2p<ServicesLibp2pTest>,
        stockage: ServiceStockage,
      } as ConstructeursServicesNébuleuse<
        T & ServicesNécessairesLibp2p<ServicesLibp2pTest>
      >,
      options: {
        dossier,
        services: {
          libp2p: {
            libp2p: obtenirOptionsLibp2pTest(),
          },
        },
      } as OptionsNébuleuse<T & ServicesNécessairesLibp2p<ServicesLibp2pTest>>,
    });
    nébuleuses.push(nébuleuse);
  }
  await Promise.all(nébuleuses.map((n) => n.démarrer()));

  const fermer = async () => {
    await Promise.all(nébuleuses.map((n) => n.fermer()));
    effacer();
  };

  return { nébuleuses, fermer };
};
