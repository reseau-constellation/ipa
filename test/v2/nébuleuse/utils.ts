import path from "path";
import { obtenirAdresseRelai, toutesConnectées } from "@constl/utils-tests";
import { Nébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import { dossierTempoPropre } from "../utils.js";
import { ServiceLibp2pTest } from "./services/utils.js";
import type { Libp2p } from "libp2p";
import type { ServicesLibp2pTest } from "@constl/utils-tests";
import type { NestedValue } from "@orbitdb/nested-db";
import type {
  ServicesNébuleuse,
  StructureNébuleuse,
} from "@/v2/nébuleuse/nébuleuse.js";
import type {
  ConstructeursServicesAppli,
  OptionsAppli,
  ServicesAppli,
} from "@/v2/nébuleuse/appli/appli.js";
import type { ServicesDonnées } from "@/v2/nébuleuse/services/compte/compte.js";
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
      S & ServicesDonnées<T, ServicesLibp2pTest>,
      ServicesNébuleuse<T & StructureNébuleuse, ServicesLibp2pTest>
    >;
    options?: Partial<
      OptionsAppli<
        S & ServicesNébuleuse<StructureNébuleuse & T, ServicesLibp2pTest>
      >
    >;
  }) {
    super({
      services: {
        ...(services || {}),
        libp2p: ServiceLibp2pTest,
      } as ConstructeursServicesAppli<
        S &
          ServicesDonnées<T, ServicesLibp2pTest> & {
            libp2p?: ServiceLibp2pTest;
          }
      >,
      options,
    });
  }
}

export const connecterNébuleuses = async <
  T extends { [clef: string]: NestedValue } = Record<string, never>,
  S extends ServicesAppli = ServicesAppli,
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
>(
  nébuleuses: Nébuleuse<T, S, L>[],
) => {
  const libp2ps: Libp2p<L>[] = await Promise.all(
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
  dossier,
}: {
  n: number;
  services?: ConstructeursServicesAppli<
    S & ServicesDonnées<T, ServicesLibp2pTest>,
    ServicesNébuleuse<T & StructureNébuleuse, ServicesLibp2pTest>
  >;
  dossier?: string;
}): Promise<{
  nébuleuses: NébuleuseTest<T, S>[];
  fermer: Oublier;
}> => {
  let effacer: () => void;
  if (!dossier) ({ dossier, effacer } = await dossierTempoPropre());
  else effacer = () => {};

  const nébuleuses: NébuleuseTest<T, S>[] = [];

  for (const i in [...Array(n).entries()]) {
    const nébuleuse = new NébuleuseTest<T, S>({
      services,
      options: { services: { dossier: { dossier: path.join(dossier, i) } } },
    });
    nébuleuses.push(nébuleuse);
  }

  await Promise.all(nébuleuses.map((c) => c.démarrer()));

  await connecterNébuleuses(nébuleuses);

  const fermer = async () => {
    await Promise.allSettled(nébuleuses.map((c) => c.fermer()));
    effacer();
  };

  return {
    nébuleuses,
    fermer,
  };
};
