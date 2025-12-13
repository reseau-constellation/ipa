import path from "path";
import { ServiceLibp2p, ServiceStockage } from "@/v2/nébuleuse/index.js";
import { Appli } from "@/v2/appli/appli.js";
import { dossierTempoPropre } from "../../utils.js";
import { obtenirOptionsLibp2pTest } from "../../nébuleuse/services/utils.js";
import type { ServicesLibp2pTest } from "@constl/utils-tests";
import type {
  ConstructeursServicesAppli,
  OptionsAppli,
  ServicesAppli,
} from "@/v2/appli/appli.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";
import type { ServicesNécessairesLibp2p } from "@/v2/nébuleuse/services/libp2p/libp2p.js";

export const créerApplisTest = async <T extends ServicesAppli>({
  n,
  services,
}: {
  n: number;
  services: ConstructeursServicesAppli<T>;
}): Promise<{
  applis: Appli<T & ServicesNécessairesLibp2p<ServicesLibp2pTest>>[];
  fermer: Oublier;
}> => {
  const { dossier, effacer } = await dossierTempoPropre();

  const applis: Appli<
    T & ServicesNécessairesLibp2p<ServicesLibp2pTest>
  >[] = [];

  for (const i in [...Array(n).entries()]) {
    const appli = new Appli<
      T & ServicesNécessairesLibp2p<ServicesLibp2pTest>
    >({
      services: {
        ...services,
        libp2p: ServiceLibp2p<ServicesLibp2pTest>,
        stockage: ServiceStockage,
      } as ConstructeursServicesAppli<
        T & ServicesNécessairesLibp2p<ServicesLibp2pTest>
      >,
      options: {
        dossier: path.join(dossier, i),
        services: {
          libp2p: {
            libp2p: obtenirOptionsLibp2pTest(),
          },
        },
      } as OptionsAppli<T & ServicesNécessairesLibp2p<ServicesLibp2pTest>>,
    });
    applis.push(appli);
  }
  await Promise.all(applis.map((n) => n.démarrer()));

  const fermer = async () => {
    await Promise.all(applis.map((n) => n.fermer()));
    effacer();
  };

  return { applis, fermer };
};
