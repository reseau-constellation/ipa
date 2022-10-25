import { Controller } from "ipfsd-ctl";
import { connectPeers } from "@/utilsTests/orbitDbTestUtils.js";
import { initierSFIP, arrêterSFIP } from "@/utilsTests/sfipTest.js";

import { once } from "events";
import path from "path";
import rmrf from "rimraf";
import { v4 as uuidv4 } from "uuid";
import OrbitDB from "orbit-db";
import Store from "orbit-db-store";
import KeyValueStore from "orbit-db-kvstore";
import FeedStore from "orbit-db-feedstore";
import fs from "fs";
import Semaphore from "@chriscdn/promise-semaphore";

import ContrôleurConstellation from "@/accès/cntrlConstellation.js";
import ClientConstellation from "@/client.js";
import générerProxyProc from "@/proxy/ipaProc.js";
import générerProxyTravailleur from "@/proxy/ipaTravailleur.js";
import { statutDispositif } from "@/reseau.js"

export * from "@/utilsTests/sfipTest.js";

export const dirRessourcesTests = (): string => {
  return path.resolve(path.dirname(""), "src", "utilsTests", "ressources");
};

export const dirTempoTests = (): string => {
  return path.resolve(path.dirname(""), "src", "utilsTests", "_tempo");
};

export const obtDirTempoPourTest = (nom?: string): string => {
  return path.resolve(dirTempoTests(), (nom || "") + uuidv4());
};

const attendreInvité = (bd: Store, idInvité: string): Promise<void> =>
  new Promise<void>((resolve) => {
    const testAutorisé = async () => {
      const autorisé = await (
        bd.access as unknown as ContrôleurConstellation
      ).estAutorisé(idInvité);
      if (autorisé) {
        clearInterval(interval);
        resolve();
      }
    }
    const interval = setInterval(testAutorisé, 100);
    testAutorisé();
  });

export const clientConnectéÀ = (client1: ClientConstellation, client2: ClientConstellation): Promise<void> => {
  const verrou = new Semaphore()
  return new Promise( async résoudre => {
    const fFinale = async (dispositifs: statutDispositif[]) => {
      const connecté = !!dispositifs.find(d=>d.infoDispositif.idCompte === client2.idBdCompte);
      if (connecté) {
        console.log(`Client ${client1.idBdCompte} est connecté à ${client2.idBdCompte}`)
        console.log("On attend le verrou")
        await verrou.acquire("suivreConnexions");
        console.log("Verrou obtenu")
        fOublier();
        résoudre();
      }
    }
    await verrou.acquire("suivreConnexions");
    const fOublier = await client1.réseau!.suivreConnexionsDispositifs({ f: fFinale });
    verrou.release("suivreConnexions")
    console.log("verrou relâché")

  })
}

export const clientsConnectés = async (client1: ClientConstellation, client2: ClientConstellation): Promise<void> => {
  const client1ConnectéÀ2 = clientConnectéÀ(client1, client2);
  const client2ConnectéÀ1 = clientConnectéÀ(client2, client1);
  await Promise.all([client1ConnectéÀ2, client2ConnectéÀ1])
  return
}

export const attendreSync = async (bd: Store): Promise<void> => {
  const accès = bd.access as unknown as ContrôleurConstellation;
  await once(accès.bd!.events, "peer.exchanged");
};

export const attendreQue = async (
  f: () => boolean
): Promise<void> => {
  return new Promise((résoudre) => {
    const vérifierPrêt = () => {
      if (f()) {
        clearInterval(interval);
        résoudre();
      }
    };
    const interval = setInterval(vérifierPrêt, 10);
    vérifierPrêt();
  });
}

export const attendreRésultat = async <
  T extends Record<string, unknown>,
  K extends keyof T
>(
  dic: T,
  clef: K,
  valDésirée?: ((x?: T[K]) => boolean) | T[K]
): Promise<void> => {
  if (valDésirée === undefined) {
    valDésirée = (x?: T[K]) => x !== undefined;
  }
  return new Promise((résoudre) => {
    const vérifierPrêt = () => {
      const val = dic[clef];
      let prêt = false;
      if (typeof valDésirée === "function") {
        prêt = (valDésirée as (x?: T[K]) => boolean)(val);
      } else {
        prêt = val === valDésirée;
      }
      if (prêt) {
        clearInterval(interval);
        résoudre();
      }
    };
    const interval = setInterval(vérifierPrêt, 10);
    vérifierPrêt();
  });
};

export const attendreFichierExiste = async (fichier: string): Promise<void> => {
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

export const attendreFichierModifié = async (
  fichier: string,
  tempsAvant: number
): Promise<void> => {
  await attendreFichierExiste(fichier);

  return new Promise((résoudre) => {
    const interval = setInterval(() => {
      const { mtime } = fs.statSync(fichier);
      const prêt = mtime.getTime() > tempsAvant;
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
  n = 1
): Promise<{ orbites: OrbitDB[]; fOublier: () => Promise<void> }> => {
  const dssfip: Controller[] = [];
  const sfips: Controller["api"][] = [];
  const orbites: OrbitDB[] = [];

  const racineDossierOrbite = obtDirTempoPourTest("orbite");

  rmrf.sync(racineDossierOrbite);

  for (const i in [...Array(n).keys()]) {
    const racineDossier = `${racineDossierOrbite}/sfip_${i}`;
    const dsfip = await initierSFIP(racineDossier);
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
      dssfip.map(async (d) => {
        await arrêterSFIP(d);
      })
    );
    rmrf.sync(racineDossierOrbite);
  };
  return { orbites, fOublier };
};

type typeClient = "directe" | "proc" | "travailleur";

export const générerClients = async (
  n = 1,
  type: typeClient = "directe"
): Promise<{
  clients: ClientConstellation[];
  fOublier: () => Promise<void>;
}> => {
  const clients: ClientConstellation[] = [];
  const fsOublier: (() => Promise<void>)[] = [];

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
          client = générerProxyProc({ orbite: orbites[i] });
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
      client = générerProxyTravailleur({ orbite: { dossier: String(i) } });
      clients.push(client);
    }
  } else {
    throw new Error(type);
  }

  const fOublier = async () => {
    await Promise.all(clients.map((client) => client.fermer()));
    await Promise.all(fsOublier.map((f) => f()));
  };
  return { fOublier, clients };
};

export const typesClients: typeClient[] = process.env.TOUS
  ? ["directe", "proc"]
  : ["directe"];
