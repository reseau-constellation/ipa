import { Controller } from "ipfsd-ctl/src/types";
import { connectPeers } from "orbit-db-test-utils";
import { startIpfs, stopIpfs, config } from "./sfipTest";

import { once } from "events";
import rmrf from "rimraf";
import { v4 as uuidv4 } from "uuid";
import OrbitDB from "orbit-db";
import Store from "orbit-db-store";
import KeyValueStore from "orbit-db-kvstore";
import FeedStore from "orbit-db-feedstore";

import ContrôleurConstellation from "@/accès/cntrlConstellation";
import ClientConstellation from "@/client";
import { schémaFonctionOublier } from "@/utils";
const générerProxyProc = import("@/proxy/ipaProc");
const générerProxyTravailleur = import("@/proxy/ipaTravailleur");

const attendreInvité = (bd: Store, idInvité: string): Promise<void> =>
  new Promise<void>((resolve) => {
    const interval = setInterval(async () => {
      const autorisé = await (bd.access as ContrôleurConstellation).estAutorisé(
        idInvité
      );
      if (autorisé) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });

export const attendreSync = async (bd: Store): Promise<void> => {
  const accès = bd.access as ContrôleurConstellation;
  await once(accès.bd!.events, "peer.exchanged");
};

export const attendreRésultat = async (
  dic: { [key: string]: unknown },
  clef: string,
  valDésirée?: unknown
): Promise<void> => {
  if (valDésirée === undefined) {
    valDésirée = (x: unknown) => x !== undefined;
  }
  return new Promise((résoudre) => {
    const interval = setInterval(() => {
      const val = dic[clef];
      let prêt = false;
      if (typeof valDésirée === "function") {
        prêt = valDésirée(val);
      } else {
        prêt = val === valDésirée;
      }
      if (prêt) {
        clearInterval(interval);
        résoudre();
      }
    }, 10);
  });
};

export const peutÉcrire = async (
  bd: KeyValueStore<number> | FeedStore<string>,
  attendre?: OrbitDB
): Promise<boolean> => {
  if (attendre) {
    await attendreInvité(bd, attendre.identity.id);
  }

  try {
    if (bd.type === "keyvalue") {
      const CLEF = "test";
      const VAL = 123;

      await (bd as KeyValueStore<number>).set(CLEF, VAL);
      const val = bd.get(CLEF);

      await (bd as KeyValueStore<number>).del(CLEF);
      return val === VAL;
    } else if (bd.type === "feed") {
      const VAL = "test";

      await (bd as FeedStore<string>).add(VAL);
      const éléments = (bd as FeedStore<string>).iterator({ limit: -1 }).collect();

      const autorisé =
        éléments.length === 1 && éléments[0].payload.value === VAL;
      if (éléments.length === 1) {
        await (bd as FeedStore<string>).remove(éléments[0].hash);
      }
      return autorisé;
    } else {
      throw new Error(`Type de BD ${bd.type} non supporté par ce test.`);
    }
  } catch {
    return false;
  }
};

export const générerOrbites = async (
  n = 1,
  API: string
): Promise<{ orbites: OrbitDB[]; fOublier: () => Promise<void> }> => {
  const ipfsds: Controller[] = [];
  const ipfss: Controller["api"][] = [];
  const orbites: OrbitDB[] = [];

  const racineDossierOrbite = "./tests/_temp/" + uuidv4();

  rmrf.sync(racineDossierOrbite);

  for (const i in [...Array(n).keys()]) {
    const racineDossier = `${racineDossierOrbite}/sfip_${i}`;
    const ipfsd = await startIpfs(API, config.daemon1);
    const ipfs = ipfsd.api;
    const orbite = await OrbitDB.createInstance(ipfs, {
      directory: racineDossier,
    });

    for (const ip of ipfss) {
      await connectPeers(ipfs, ip);
    }

    ipfsds.push(ipfsd);
    ipfss.push(ipfs);
    orbites.push(orbite);
  }
  const fOublier = async () => {
    await Promise.all(
      orbites.map(async (orbite) => {
        await orbite.stop();
      })
    );
    await Promise.all(
      ipfsds.map(async (ipfsd) => {
        await stopIpfs(ipfsd);
      })
    );
    rmrf.sync(racineDossierOrbite);
  };
  return { orbites, fOublier };
};

type typeClient = "directe" | "proc" | "travailleur";

export const générerClients = async (
  n = 1,
  API: string,
  type: typeClient = "directe"
): Promise<{
  clients: ClientConstellation[];
  fOublier: () => Promise<void>;
}> => {
  const clients: ClientConstellation[] = [];
  const fsOublier: schémaFonctionOublier[] = [];

  for (const i in [...Array(n).keys()]) {
    let client: ClientConstellation;
    switch (type) {
      case "directe": {
        const { orbites, fOublier: fOublierOrbites } = await générerOrbites(
          n,
          API
        );
        fsOublier.push(fOublierOrbites);

        client = await ClientConstellation.créer(
          { orbite: orbites[i] }
        );
        break;
      }

      case "proc": {
        const { orbites, fOublier: fOublierOrbites } = await générerOrbites(
          n,
          API
        );
        fsOublier.push(fOublierOrbites);
        client = (await générerProxyProc).default({orbite: orbites[i]}, true);
        break;
      }

      case "travailleur":
        client = (await générerProxyTravailleur).default(undefined, undefined, true);
        break;

      default:
        throw new Error(type);
    }
    clients.push(client);
  }

  const fOublier = async () => {
    await Promise.all(
      clients.map(async (client) => {
        await client.fermer();
      })
    );
    fsOublier.forEach((f) => f());
  };
  return { fOublier, clients };
};

export const typesClients: typeClient[] = process.env.TOUS
  ? ["directe", "proc"]
  : ["directe"];
