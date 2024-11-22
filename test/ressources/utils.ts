import { orbite } from "@constl/utils-tests";

import { Constellation as ConstellationInterne } from "@/client.js";
import { préparerOrbite } from "@/orbite.js";
import { isBrowser } from "wherearewe";

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
        orbite: orbites[i],
      });
    }),
  );

  const fOublier = async () => {
    await Promise.all(clients.map((client) => client.fermer()));
    await Promise.all(fsOublier.map((f) => f()));
  };
  return { fOublier, clients };
};
