import { toUnicode } from "punycode-esm";
import { AbortError } from "p-retry";
import { multiaddr } from "@multiformats/multiaddr";
import deepEqual from "fast-deep-equal";
import type { Suivi } from "./types.js";
import type { Multiaddr } from "@multiformats/multiaddr";

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

export const pSignal = async (signal: AbortSignal): Promise<never> => {
  if (signal.aborted) throw new AbortError(Error("Signal déjà avorté"));
  return new Promise<never>((_résoudre, rejeter) => {
    const lorsquAvorté = () => {
      signal.removeEventListener("abort", lorsquAvorté);
      rejeter("Signal avorté");
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
    n,
  }: {
    f: () => Promise<T>;
    n: number;
  }): Promise<T> => {
    try {
      avant = Date.now();
      return await Promise.race([f(), pSignal(signal)]);
    } catch (e) {
      if (signal.aborted || estErreurAvortée(e as Error))
        throw new AbortError(Error("Signal avorté"));
      n++;
      const maintenant = Date.now();
      const tempsÀAttendre = n * 1000 + (maintenant - avant);
      if (tempsÀAttendre > 0) {
        await attendre(tempsÀAttendre, signal);

        if (signal.aborted) throw new AbortError(Error("Signal avorté"));
      }
      return await _interne({ f, n });
    }
  };
  return await _interne({ f, n: 0 });
};

export const dépunicodifier = (ma: Multiaddr): Multiaddr => {
  const composantes = ma.getComponents();
  const composantesDépunicodifiées = composantes.map((c) =>
    c.name.startsWith("dns") && c.value
      ? { ...c, value: toUnicode(c.value) }
      : c,
  );
  return multiaddr(composantesDépunicodifiées);
};

export const stabiliser =
  (n = 100) =>
  <T>(f: Suivi<T>): Suivi<T> => {
    let déjàAppellée = false;
    let val: T | undefined = undefined;
    let dernierT = 0;
    let annulerRebours: () => void = () => {};

    return async (v: T) => {
      if (déjàAppellée && deepEqual(v, val)) return;

      annulerRebours();
      déjàAppellée = true;
      val = v;
      dernierT = Date.now();

      const crono = setTimeout(async () => await f(v), n);
      annulerRebours = () => {
        if (dernierT) {
          const dif = Date.now() - dernierT;
          n += dif * 0.5;
        }
        clearTimeout(crono);
      };
    };
  };

export const estErreurAvortée = (erreur?: Error): boolean => {
  if (erreur instanceof AggregateError) {
    return erreur.errors.some((e) => estErreurAvortée(e));
  }
  return erreur?.toString()?.includes("AbortError") ?? false;
};
