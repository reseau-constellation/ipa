import { orbite } from "@constl/utils-tests";

import { isBrowser } from "wherearewe";
import { OrbitDB } from "@orbitdb/core";
import { Libp2p } from "@libp2p/interface";
import { Constellation as ConstellationInterne } from "@/client.js";
import { préparerOrbite } from "@/orbite.js";
import { ServicesLibp2p } from "@/sfip";

export const générerClientsInternes = async ({
  n,
}: {
  n: number;
}): Promise<{
  clients: ConstellationInterne[];
  fOublier: () => Promise<void>;
}> => {
  préparerOrbite();

  const fsOublier: (() => Promise<void>)[] = [];

  // Nécessaire pour Playwright
  if (isBrowser) window.localStorage.clear();

  const { orbites, fOublier: fOublierOrbites } = await orbite.créerOrbiteTest({
    n,
  });
  fsOublier.push(fOublierOrbites);

  const clients = await Promise.all(
    [...Array(n).keys()].map(async (i) => {
      return await ConstellationInterne.créer({
        dossier: orbites[i].directory.split("/").slice(0, -1).join("/"),
        orbite: orbites[i] as OrbitDB<Libp2p<ServicesLibp2p>>,
      });
    }),
  );

  const fOublier = async () => {
    await Promise.all(clients.map((client) => client.fermer()));
    await Promise.all(fsOublier.map((f) => f()));
  };
  return { fOublier, clients };
};
