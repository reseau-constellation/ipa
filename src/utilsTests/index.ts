import { once } from "events";

import OrbitDB from "orbit-db";
import type Store from "orbit-db-store";
import type KeyValueStore from "orbit-db-kvstore";
import type FeedStore from "orbit-db-feedstore";

import Semaphore from "@chriscdn/promise-semaphore";

import type { default as ContrôleurConstellation } from "@/accès/cntrlConstellation.js";
import ClientConstellation from "@/client.js";

import type { statutDispositif } from "@/reseau.js";

export * as sfip from "@/utilsTests/sfip.js";
export * as attente from "@/utilsTests/attente.js";
export * as client from "@/utilsTests/client.js";

export const config = {
  patience: 10 * 1000,
  patienceInit: 60 * 1000,
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
    };
    const interval = setInterval(testAutorisé, 100);
    testAutorisé();
  });

export const clientConnectéÀ = (
  client1: ClientConstellation,
  client2: ClientConstellation
): Promise<void> => {
  const verrou = new Semaphore();
  return new Promise(async (résoudre) => {
    // eslint-disable-line no-async-promise-executor
    const fFinale = async (dispositifs: statutDispositif[]) => {
      const idBdCompte2 = await client2.obtIdCompte();
      const connecté = !!dispositifs.find(
        (d) => d.infoDispositif.idCompte === idBdCompte2
      );
      if (connecté) {
        await verrou.acquire("suivreConnexions");
        await fOublier();
        résoudre();
      }
    };
    await verrou.acquire("suivreConnexions");
    const fOublier = await client1.réseau!.suivreConnexionsDispositifs({
      f: fFinale,
    });
    verrou.release("suivreConnexions");
  });
};

export const clientsConnectés = async (
  client1: ClientConstellation,
  client2: ClientConstellation
): Promise<void> => {
  const client1ConnectéÀ2 = clientConnectéÀ(client1, client2);
  const client2ConnectéÀ1 = clientConnectéÀ(client2, client1);
  await Promise.all([client1ConnectéÀ2, client2ConnectéÀ1]);
  return;
};

export const attendreSync = async (bd: Store): Promise<void> => {
  const accès = bd.access as unknown as ContrôleurConstellation;
  await once(accès.bd!.events, "peer.exchanged");
};

export const peutÉcrire = async (
  bd: KeyValueStore<{test: number}> | FeedStore<string>,
  attendre?: OrbitDB
): Promise<boolean> => {
  if (attendre) {
    await attendreInvité(bd, attendre.identity.id);
  }

  try {
    if (bd.type === "keyvalue") {
      const CLEF = "test";
      const VAL = 123;

      await (bd as KeyValueStore<{test: number}>).set(CLEF, VAL);
      const val = bd.get(CLEF);

      await (bd as KeyValueStore<{test: number}>).del(CLEF);
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
