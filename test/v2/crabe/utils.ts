import path from "path";
import {
  ServicesLibp2pTest,
  dossierTempo,
  obtenirAdresseRelai,
  toutesConnectées,
} from "@constl/utils-tests";
import { NestedValueObject } from "@orbitdb/nested-db";
import { Crabe, ServicesCrabe, StructureCrabe } from "@/v2/crabe/crabe.js";
import {
  ConstructeursServicesNébuleuse,
  OptionsNébuleuse,
  ServicesNébuleuse,
} from "@/v2/nébuleuse/nébuleuse.js";
import { ServicesDonnées } from "@/v2/crabe/services/compte/compte.js";
import { ServicesLibp2pCrabe } from "@/v2/crabe/services/libp2p/libp2p.js";
import { ServiceLibp2pTest } from "./services/utils.js";
import type { Oublier } from "@/v2/crabe/types.js";

export class CrabeTest<
  T extends { [clef: string]: NestedValueObject } = Record<string, never>,
  S extends ServicesNébuleuse = ServicesNébuleuse,
> extends Crabe<T, S, ServicesLibp2pTest> {
  constructor({
    services,
    options,
  }: {
    services: ConstructeursServicesNébuleuse<
      ServicesDonnées<T, ServicesLibp2pTest>
    >;
    options: { dossier: string } & OptionsNébuleuse<
      ServicesDonnées<T, ServicesLibp2pTest> &
        ServicesCrabe<T & StructureCrabe, ServicesLibp2pTest>
    >;
  }) {
    super({
      services: {
        ...services,
        libp2p: ServiceLibp2pTest,
      } as ConstructeursServicesNébuleuse<
        ServicesDonnées<T, ServicesLibp2pTest>
      >,
      options,
    });
  }
}

export const connecterCrabes = async <
  T extends { [clef: string]: NestedValueObject } = Record<string, never>,
  S extends ServicesNébuleuse = ServicesNébuleuse,
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
>(
  crabes: Crabe<T, S, L>[],
) => {
  const libp2ps = await Promise.all(
    crabes.map(async (c) => await c.services.libp2p.libp2p()),
  );
  await toutesConnectées(libp2ps, { adresseRelai: obtenirAdresseRelai() });
};

export const créerCrabesTest = async <
  T extends { [clef: string]: NestedValueObject } = Record<string, never>,
>({
  n,
  services,
}: {
  n: number;
  services: ConstructeursServicesNébuleuse<
    ServicesDonnées<T, ServicesLibp2pTest>
  >;
}): Promise<{
  crabes: CrabeTest<T>[];
  fermer: Oublier;
}> => {
  const { dossier, effacer } = await dossierTempo();

  const crabes: CrabeTest<T>[] = [];

  for (const i in [...Array(n).entries()]) {
    const crabe = new CrabeTest<T>({
      services: services as ConstructeursServicesNébuleuse<
        ServicesDonnées<T, ServicesLibp2pTest>
      >,
      options: { dossier: path.join(dossier, i) },
    });
    crabes.push(crabe);
  }

  await Promise.all(crabes.map((c) => c.démarrer()));

  await connecterCrabes(crabes);

  const fermer = async () => {
    await Promise.all(crabes.map((c) => c.fermer()));
    effacer();
  };

  return {
    crabes,
    fermer,
  };
};
