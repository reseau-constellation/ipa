import { DagCborEncodable } from "@orbitdb/core";
import {
  NestedMapToObject,
  NestedValueMap,
  toObject,
} from "@orbitdb/nested-db";
import { AbortError } from "p-retry";
import { PartielRécursif } from "../types.js";

const attendre = (t: number, signal: AbortSignal): Promise<void> => {
  return new Promise<void>((résoudre) => {
    const terminer = () => {
      clearInterval(chrono);
      signal.removeEventListener("abort", terminer);
      résoudre();
    };
    const chrono = setTimeout(terminer, t);
    signal.addEventListener("abort", terminer);
  });
};

const pSignal = async (signal: AbortSignal): Promise<never> => {
  if (signal.aborted) throw new AbortError(Error("Signal avorté"));
  return new Promise<never>((_résoudre, rejeter) => {
    const lorsquAvorté = () => {
      signal.removeEventListener("abort", lorsquAvorté);
      rejeter();
    };
    signal.addEventListener("abort", lorsquAvorté);
  });
};

export const réessayer = async <T>(
  f: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> => {
  let avant = Date.now();
  const _interne = async ({
    f,
    signal,
    n,
  }: {
    f: () => Promise<T>;
    signal: AbortSignal;
    n: number;
  }): Promise<T> => {
    try {
      avant = Date.now();
      return await Promise.race([f(), pSignal(signal)]);
    } catch (e) {
      if (signal.aborted) throw new AbortError(Error("Signal avorté"));
      console.log(e);
      n++;
      const maintenant = Date.now();
      const tempsÀAttendre = n * 1000 - (maintenant - avant);
      if (tempsÀAttendre > 0) {
        await attendre(tempsÀAttendre, signal);

        if (signal.aborted) throw new AbortError(Error("Signal avorté"));
      }
      return await _interne({ f, signal, n });
    }
  };
  return await _interne({ f, signal, n: 0 });
};

export const mapÀObjet = <
  T extends Map<
    string,
    DagCborEncodable | PartielRécursif<NestedValueMap> | undefined
  >,
>(
  x: T | undefined,
): NestedMapToObject<T> | undefined => {
  if (x === undefined) return undefined;
  return toObject(x);
};
