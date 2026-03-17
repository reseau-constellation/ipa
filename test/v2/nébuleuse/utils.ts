import path from "path";
import { obtenirAdresseRelai, toutesConnectées } from "@constl/utils-tests";
import { merge } from "ts-deepmerge";
import { Nébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import { dossierTempoPropre } from "../utils.js";
import { serviceLibp2pTest } from "./services/utils.js";
import type { ServiceLibp2pTest } from "./services/utils.js";
import type { Libp2p } from "libp2p";
import type { ServicesLibp2pTest } from "@constl/utils-tests";
import type { NestedValue } from "@orbitdb/nested-db";
import type {
  OptionsNébuleuse,
  ServicesNébuleuse,
  StructureNébuleuse,
} from "@/v2/nébuleuse/nébuleuse.js";
import type {
  ConstructeursServicesAppli,
  ServicesAppli,
} from "@/v2/nébuleuse/appli/appli.js";

import type { ServicesLibp2pNébuleuse } from "@/v2/nébuleuse/services/libp2p/libp2p.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";

export class NébuleuseTest<
  T extends { [clef: string]: NestedValue } = Record<string, never>,
  S extends ServicesAppli = ServicesAppli,
> extends Nébuleuse<T, S, ServicesLibp2pTest> {
  constructor({
    services,
    options,
  }: {
    services?: ConstructeursServicesAppli<
      S,
      ServicesNébuleuse<T & StructureNébuleuse>
    >;
    options?: Omit<OptionsNébuleuse<T, ServicesLibp2pTest>, "libp2p">;
  }) {
    super({
      services: {
        ...(services || {}),
        libp2p: serviceLibp2pTest(),
      } as ConstructeursServicesAppli<
        S & {
          libp2p?: ServiceLibp2pTest;
        }
      >,
      options,
    });
  }
}

export const connecterNébuleuses = async <
  T extends { [clef: string]: NestedValue },
  S extends ServicesAppli = ServicesAppli,
>(
  nébuleuses: Nébuleuse<T, S>[],
) => {
  const libp2ps: Libp2p<ServicesLibp2pNébuleuse>[] = await Promise.all(
    nébuleuses.map(async (c) => await c.services.libp2p.libp2p()),
  );
  await toutesConnectées(libp2ps, { adresseRelai: obtenirAdresseRelai() });
};

export const créerNébuleusesTest = async <
  T extends { [clef: string]: NestedValue } = Record<string, never>,
  S extends ServicesAppli = ServicesAppli,
>({
  n,
  services,
  options,
}: {
  n: number;
  services?: ConstructeursServicesAppli<
    S,
    ServicesNébuleuse<T & StructureNébuleuse>
  >;
  options?: Omit<OptionsNébuleuse<T, ServicesLibp2pTest>, "libp2p"> | undefined;
}): Promise<{
  nébuleuses: NébuleuseTest<T, S>[];
  fermer: Oublier;
}> => {
  options ??= {};
  options.services ??= {};

  let dossierBase: string;
  let effacer: () => void;
  if (!options.services.dossier?.dossier) {
    ({ dossier: dossierBase, effacer } = await dossierTempoPropre());
  } else {
    dossierBase = options.services.dossier.dossier;
    effacer = () => {};
  }

  const nébuleuses: NébuleuseTest<T, S>[] = [];

  for (const i in [...Array(n).entries()]) {
    const dossier = path.join(dossierBase, String(i));
    const nébuleuse = new NébuleuseTest<T, S>({
      services,
      options: merge({}, options, { services: { dossier: { dossier } } }),
    });
    nébuleuses.push(nébuleuse);
  }

  await Promise.all(nébuleuses.map((c) => c.démarrer()));

  await connecterNébuleuses(nébuleuses);

  const fermer = async () => {
    await Promise.allSettled(nébuleuses.map((c) => c.fermer()));
    effacer?.();
  };

  return {
    nébuleuses,
    fermer,
  };
};
