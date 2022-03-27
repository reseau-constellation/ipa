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
import fs from "fs";

import ContrôleurConstellation from "@/accès/cntrlConstellation";
import ClientConstellation from "@/client";
import { schémaFonctionOublier } from "@/utils";
import générerProxyProc from "@/proxy/ipaProc";
import générerProxyTravailleur from "@/proxy/ipaTravailleur";

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
  clef: keyof typeof dic,
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

export const attendreFichierExiste = async (
  fichier: string,
): Promise<void> => {
  return new Promise((résoudre) => {
    const interval = setInterval(() => {
      const prêt = fs.existsSync(fichier);
      if (prêt) {
        clearInterval(interval);
        résoudre();
      }
    }, 10);
    if (fs.existsSync(fichier)) résoudre();
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
      const éléments = (bd as FeedStore<string>)
        .iterator({ limit: -1 })
        .collect();

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
  const dssfip: Controller[] = [];
  const sfips: Controller["api"][] = [];
  const orbites: OrbitDB[] = [];

  const racineDossierOrbite = "./tests/_temp/" + uuidv4();

  rmrf.sync(racineDossierOrbite);

  for (const i in [...Array(n).keys()]) {
    const racineDossier = `${racineDossierOrbite}/sfip_${i}`;
    const dsfip = await startIpfs(API, config.daemon1);
    const sfip = dsfip.api;
    const orbite = await OrbitDB.createInstance(sfip, {
      directory: racineDossier,
    });

    for (const ip of sfips) {
      await connectPeers(sfip, ip);
    }

    dssfip.push(dsfip);
    sfips.push(sfip);
    orbites.push(orbite);
  }
  const fOublier = async () => {
    await Promise.all(
      orbites.map(async (orbite) => {
        await orbite.stop();
      })
    );
    await Promise.all(
      dssfip.map(async (dssfip) => {
        await stopIpfs(dssfip);
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

  if (type === "directe" || type == "proc") {
    const { orbites, fOublier: fOublierOrbites } = await générerOrbites(n, API);
    for (const i in [...Array(n).keys()]) {
      let client: ClientConstellation;
      switch (type) {
        case "directe": {
          fsOublier.push(fOublierOrbites);
          client = await ClientConstellation.créer({ orbite: orbites[i] });
          break;
        }

        case "proc": {
          fsOublier.push(fOublierOrbites);
          client = générerProxyProc({ orbite: orbites[i] }, true);
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
      client = générerProxyTravailleur(
        { orbite: { dossier: String(i) } },
        true
      );
      clients.push(client);
    }
  } else {
    throw new Error(type);
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
