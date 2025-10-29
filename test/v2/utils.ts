import { BaseDatabase, KeyValueDatabase } from "@orbitdb/core";
import { SetDatabaseType } from "@orbitdb/set-db";
import { FeedDatabaseType } from "@orbitdb/feed-db";
import { OrderedKeyValueDatabaseType } from "@orbitdb/ordered-keyvalue-db";
import { estContrôleurConstellation } from "@/v2/crabe/services/compte/accès/contrôleurConstellation.js";
import { attendreQue } from "./nébuleuse/utils/fonctions.js";
import { isBrowser } from "wherearewe";
import { dossierTempo } from "@constl/utils-tests";

export const journalifier = <T extends (...args: unknown[]) => unknown>(
  f: T,
  étiquette?: string,
): T => {
  return (...args) => {
    console.log(étiquette || "", args);
    return f(...args);
  };
};

export const attendreInvité = async (
  bd: BaseDatabase,
  idInvité: string,
): Promise<void> => {
  const accès = bd.access;
  if (!estContrôleurConstellation(accès))
    throw new Error(`Contrôleur d'accès non supporté : ${accès.type}`);

  return await attendreQue(() => accès.estAutorisé(idInvité));
};

export const peutÉcrire = async (
  bd:
    | KeyValueDatabase
    | SetDatabaseType
    | FeedDatabaseType
    | OrderedKeyValueDatabaseType,
): Promise<boolean> => {
  try {
    if (bd.type === "keyvalue" || bd.type === "ordered-keyvalue") {
      // Important d'avoir une clef unique pour éviter l'interférence entre les tests
      const CLEF = "test" + Math.random().toString();
      const VAL = 123;

      await bd.set(CLEF, VAL);
      const val = await bd.get(CLEF);

      await bd.del(CLEF);
      return val === VAL;
    } else if (bd.type === "feed") {
      const VAL = "test";

      await bd.add(VAL);
      const éléments = await bd.all();

      const autorisé = éléments.length === 1 && éléments[0].value === VAL;
      if (éléments.length === 1) {
        await bd.remove(éléments[0].hash);
      }
      return autorisé;
    } else if (bd.type === "set") {
      const VAL = "test";

      await bd.add(VAL);
      const éléments = await bd.all();

      const autorisé = éléments.size === 1 && éléments.has(VAL);
      await bd.del(VAL);

      return autorisé;
    } else {
      // @ts-expect-error bd.type n'a plus d'options
      throw new Error(`Type de BD ${bd.type} non supporté par ce test.`);
    }
  } catch (e) {
    if (e.toString().includes("is not allowed to write to the log")) {
      return false;
    }
    throw e;
  }
};

export const dossierTempoPropre = () => {
  if (isBrowser) window.localStorage.clear();
  return dossierTempo();
}