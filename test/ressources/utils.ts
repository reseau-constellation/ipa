import { orbite } from "@constl/utils-tests";

import { ClientConstellation as ClientConstellationInterne } from "@/client.js";
import { isBrowser } from "wherearewe";
import { préparerOrbite } from "@/orbite.js";

export const générerClientsInternes = async ({
  n,
}: {
  n: number;
}): Promise<{
  clients: ClientConstellationInterne[];
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
      return await ClientConstellationInterne.créer({
        dossier: orbites[i].directory.split("/").slice(0, -1).join("/"),
        orbite: orbites[i],
      });
    }),
  );

  const fOublier = async () => {
    if (isBrowser) return; // Mystère et boule de gomme !!
    await Promise.all(clients.map((client) => client.fermer()));
    await Promise.all(fsOublier.map((f) => f()));
  };

  return { clients, fOublier };
};
