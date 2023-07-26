import OrbitDB from "orbit-db";
import { connectPeers } from "@/utilsTests/orbitDbTestUtils.js";
import { initierSFIP, arrêterSFIP } from "@/utilsTests/sfip.js";
import générerMandataireProc from "@/mandataire/ipaProc.js";
import générerMandataireTravailleur from "@/mandataire/ipaTravailleur.js";
import type { IPFS } from "ipfs-core";
import { ClientConstellation } from "@/client.js";
import { dossierTempoTests } from "@/utilsTests/dossiers.js";
import { isBrowser } from "wherearewe";
import { clientsConnectés } from "@/utilsTests/index.js";

export const générerOrbites = async (
  n = 1
): Promise<{ orbites: OrbitDB[]; fOublier: () => Promise<void> }> => {
  const sfips: IPFS[] = [];
  const orbites: OrbitDB[] = [];

  const {
    dossier: racineDossierOrbite,
    fEffacer: fEffacerRacineDossierOrbite,
  } = await dossierTempoTests();

  fEffacerRacineDossierOrbite();

  const _générer = async (i: number): Promise<void> => {
    const racineDossier = `${racineDossierOrbite}/${i}`;
    const sfip = await initierSFIP(`${racineDossier}/sfip`);
    const orbite = await OrbitDB.createInstance(sfip, {
      directory: `${racineDossier}/orbite`,
    });

    for (const ip of sfips) {
      await connectPeers(sfip, ip);
    }

    sfips.push(sfip);
    orbites.push(orbite);
  };

  await Promise.all([...Array(n).keys()].map((i) => _générer(i)));

  const fOublier = async () => {
    await Promise.all(
      orbites.map(async (orbite) => {
        await orbite.stop();
      })
    );

    await Promise.all(
      sfips.map(async (d) => {
        await arrêterSFIP(d);
      })
    );

    fEffacerRacineDossierOrbite();
  };
  return { orbites, fOublier };
};

export type typeClient = "directe" | "proc" | "travailleur";

export const générerClients = async (
  n = 1,
  type: typeClient = "directe"
): Promise<{
  clients: ClientConstellation[];
  fOublier: () => Promise<void>;
}> => {
  const clients: ClientConstellation[] = [];
  const fsOublier: (() => Promise<void>)[] = [];
  // Nécessaire pour Playwright
  if (isBrowser) window.localStorage.clear();

  if (type === "directe" || type == "proc") {
    const { orbites, fOublier: fOublierOrbites } = await générerOrbites(n);
    fsOublier.push(fOublierOrbites);

    for (const i in [...Array(n).keys()]) {
      let client: ClientConstellation;
      switch (type) {
        case "directe": {
          client = await ClientConstellation.créer({
            orbite: orbites[i],
          });
          break;
        }

        case "proc": {
          client = générerMandataireProc({
            orbite: orbites[i],
          }) as unknown as ClientConstellation;
          break;
        }

        default:
          throw new Error(type);
      }
      clients.push(client);
    }
  } else if (type === "travailleur") {
    let client: ClientConstellation;
    for (const i in [...Array(n).keys()]) {
      client = générerMandataireTravailleur({
        orbite: { dossier: String(i) },
      }) as unknown as ClientConstellation;
      clients.push(client);
    }
  } else {
    throw new Error(type);
  }
  // await clientsConnectés(...clients)

  const fOublier = async () => {
    if (isBrowser) return;  // Mystère et boule de gomme !!
    await Promise.all(clients.map((client) => client.fermer()));
    await Promise.all(fsOublier.map((f) => f()));
  };
  return { fOublier, clients };
};

export const typesClients: typeClient[] =
  process.env.MANDATAIRE === "TOUS"
    ? ["directe", "proc"]
    : process.env.MANDATAIRE === "PROC"
    ? ["proc"]
    : ["directe"];
