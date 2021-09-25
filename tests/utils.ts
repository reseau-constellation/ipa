import { Controller } from "ipfsd-ctl/src/types";
import { connectPeers } from "orbit-db-test-utils";
import { startIpfs, stopIpfs, config } from "./sfipTest";

import { once } from "events";
import rmrf from "rimraf";
import { v4 as uuidv4 } from "uuid";
import OrbitDB, { Store, KeyValueStore, FeedStore } from "orbit-db";

import ContrôleurConstellation from "@/accès/cntrlConstellation";
import ClientConstellation from "@/client";

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
  const accès: ContrôleurConstellation = bd.access;
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
  bd: KeyValueStore | FeedStore,
  attendre?: OrbitDB
): Promise<boolean> => {
  if (attendre) {
    await attendreInvité(bd, attendre.identity.id);
  }

  try {
    if (bd.type === "keyvalue") {
      const CLEF = "test";
      const VAL = 123;

      await (bd as KeyValueStore).set(CLEF, VAL);
      const val = await bd.get(CLEF);

      await (bd as KeyValueStore).del(CLEF);
      return val === VAL;
    } else if (bd.type === "feed") {
      const VAL = "test";

      await (bd as FeedStore).add(VAL);
      const éléments = (bd as FeedStore).iterator({ limit: -1 }).collect();

      const autorisé =
        éléments.length === 1 && éléments[0].payload.value === VAL;
      if (éléments.length === 1)
        await (bd as FeedStore).remove(éléments[0].hash);
      return autorisé;
    } else {
      throw new Error(`Type de BD ${bd.type} non supporté par ce test.`);
    }
  } catch {
    return false;
  }
};

export const fermerBd = async (bd: Store): Promise<void> => {
  await bd.close();
  await bd.access.close();
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

export const générerClients = async (
  n = 1,
  API: string
): Promise<{
  clients: ClientConstellation[];
  fOublier: () => Promise<void>;
}> => {
  const clients: ClientConstellation[] = [];

  const { orbites, fOublier: fOublierOrbites } = await générerOrbites(n, API);
  for (const i in [...Array(n).keys()]) {
    const client = await ClientConstellation.créer(
      undefined,
      undefined,
      orbites[i]
    );
    clients.push(client);
  }

  const fOublier = async () => {
    await Promise.all(
      clients.map(async (client) => {
        await client.fermer();
      })
    );
    fOublierOrbites();
  };
  return { fOublier, clients };
};
