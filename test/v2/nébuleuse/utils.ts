import path from "path";
import { obtenirAdresseRelai, toutesConnectées } from "@constl/utils-tests";
import { Nébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import { dossierTempoPropre } from "../utils.js";
import { ServiceLibp2pTest } from "./services/utils.js";
import type { ServicesLibp2pTest } from "@constl/utils-tests";
import type { NestedValueObject } from "@orbitdb/nested-db";
import type {
  ServicesNébuleuse,
  StructureNébuleuse,
} from "@/v2/nébuleuse/nébuleuse.js";
import type {
  ConstructeursServicesAppli,
  OptionsAppli,
  ServiceAppli,
  ServicesAppli,
} from "@/v2/appli/appli.js";
import type { ServicesDonnées } from "@/v2/nébuleuse/services/compte/compte.js";
import type { ServicesLibp2pNébuleuse } from "@/v2/nébuleuse/services/libp2p/libp2p.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";

export type ConstructeurServicesNébuleuse<
  T extends ServicesAppli,
  A extends ServicesAppli = {
    [clef: string]: ServiceAppli<typeof clef>;
  },
> = ConstructeursServicesAppli<T, A & ServicesNébuleuse>;

export class NébuleuseTest<
  T extends { [clef: string]: NestedValueObject } = Record<string, never>,
  S extends ServicesAppli = ServicesAppli,
> extends Nébuleuse<T, S, ServicesLibp2pTest> {
  constructor({
    services,
    options,
  }: {
    services: ConstructeursServicesAppli<
      ServicesDonnées<T, ServicesLibp2pTest> & S
    >;
    options: { dossier: string } & OptionsAppli<
      ServicesDonnées<T, ServicesLibp2pTest> &
        S &
        ServicesNébuleuse<T & StructureNébuleuse, ServicesLibp2pTest>
    >;
  }) {
    super({
      services: {
        ...services,
        libp2p: ServiceLibp2pTest,
      },
      options,
    });
  }
}

export const connecterNébuleuses = async <
  T extends { [clef: string]: NestedValueObject } = Record<string, never>,
  S extends ServicesAppli = ServicesAppli,
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
>(
  nébuleuses: Nébuleuse<T, S, L>[],
) => {
  const libp2ps = await Promise.all(
    nébuleuses.map(async (c) => await c.services.libp2p.libp2p()),
  );
  await toutesConnectées(libp2ps, { adresseRelai: obtenirAdresseRelai() });
};

export const créerNébuleusesTest = async <
  T extends { [clef: string]: NestedValueObject } = Record<string, never>,
  S extends ServicesAppli = ServicesAppli,
>({
  n,
  services = {},
  dossier,
}: {
  n: number;
  services?: ConstructeursServicesAppli<
    ServicesDonnées<T, ServicesLibp2pTest> & S
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
      options: { dossier: path.join(dossier, i) },
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
