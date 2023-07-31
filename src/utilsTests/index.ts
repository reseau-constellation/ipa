import { once } from "events";

import OrbitDB from "orbit-db";
import type Store from "orbit-db-store";
import type KeyValueStore from "orbit-db-kvstore";
import type FeedStore from "orbit-db-feedstore";

import type { default as ContrôleurConstellation } from "@/accès/cntrlConstellation.js";
import ClientConstellation from "@/client.js";

import type { statutDispositif } from "@/reseau.js";
import { AttendreRésultat } from "@/utilsTests/attente.js";

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

export const clientConnectéÀ = async (
  client1: ClientConstellation,
  client2: ClientConstellation
): Promise<void> => {
  const dispositifsConnectés = new AttendreRésultat<statutDispositif[]>();
  const idCompte2 = await client2.obtIdCompte();

  const fOublier = await client1.réseau!.suivreConnexionsDispositifs({
    f: dispositifs => dispositifsConnectés.mettreÀJour(dispositifs),
  });
  await dispositifsConnectés.attendreQue(dispositifs=>{
    return !!dispositifs.find(
      (d) => d.infoDispositif.idCompte === idCompte2
    );
  })
  await fOublier();
  return;
};

export const clientsConnectés = async (
  ...clients: ClientConstellation[]
): Promise<void> => {
  if (clients.length < 2) return;
  const promesses: Promise<void>[] = []
  for (let i = 1; i < clients.length; i++) {
    for (let j = 0; j < i; j++) {
      promesses.push(clientConnectéÀ(clients[i], clients[j]));
      promesses.push(clientConnectéÀ(clients[j], clients[i]));
    };
  }
  await Promise.all(promesses);
  return;
};

export const attendreSync = async (bd: Store): Promise<void> => {
  const accès = bd.access as unknown as ContrôleurConstellation;
  await once(accès.bd!.events, "peer.exchanged");
};

export const peutÉcrire = async (
  bd: KeyValueStore<{ test: number }> | FeedStore<string>,
  attendre?: OrbitDB
): Promise<boolean> => {
  if (attendre) {
    await attendreInvité(bd, attendre.identity.id);
  }

  try {
    if (bd.type === "keyvalue") {
      const CLEF = "test";
      const VAL = 123;

      await (bd as KeyValueStore<{ test: number }>).set(CLEF, VAL);
      const val = bd.get(CLEF);

      await (bd as KeyValueStore<{ test: number }>).del(CLEF);
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
