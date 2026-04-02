import { IDBDatastore } from "datastore-idb";
import { isElectronMain, isNode } from "wherearewe";
import type { ListenerSignature, TypedEmitter } from "tiny-typed-emitter";
import type { Oublier, Suivi } from "../types.js";
import type { Datastore } from "interface-datastore";

export const obtStockageDonnées = async (
  dossier: string,
): Promise<Datastore> => {
  if (isNode || isElectronMain) {
    // Cette librairie ne peut pas être compilée pour l'environnement
    // navigateur. Nous devons donc le'importer dynamiquement ici afin d'éviter
    // des problèmes de compilation sur navigateur.
    const { FsDatastore } = await import("datastore-fs");
    const stockage = new FsDatastore(dossier);
    await stockage.open();
    return stockage;
  } else {
    const stockage = new IDBDatastore(dossier);
    await stockage.open();
    return stockage;
  }
};

export const estUnePromesse = (x: unknown): x is Promise<void> => {
  return !!x && !!(x as Promise<void>).then && !!(x as Promise<void>).finally;
};

export const nulÀObjetVide = <T>(
  f: Suivi<T | Record<string, never>>,
): Suivi<T | null> => {
  return (x: T | null) => f(x === null ? {} : x);
};

export const appelerLorsque = <
  L extends ListenerSignature<L>,
  U extends keyof L,
>({
  émetteur,
  événement,
  f,
}: {
  émetteur: TypedEmitter<L>;
  événement: U;
  f: Suivi<Parameters<L[U]>[0]>;
}): Oublier => {
  const promesses = new Set<Promise<unknown>>();

  const fFinale = (...args: [Parameters<L[U]>]) => {
    const p = f(...args);
    if (estUnePromesse(p)) {
      promesses.add(p);
      p.finally(() => promesses.delete(p));
    }
    return p;
  };
  émetteur.on(événement, fFinale as L[U]);
  return async () => {
    émetteur.off(événement, fFinale as L[U]);
    await Promise.allSettled(promesses);
  };
};

// De https://advancedweb.hu/how-to-use-async-functions-with-array-filter-in-javascript/https://advancedweb.hu/how-to-use-async-functions-with-array-filter-in-javascript/
export const filtreAsync = async <T>(
  liste: T[],
  filtre: (x: T) => Promise<boolean>,
) => {
  const results = await Promise.all(liste.map(filtre));

  return liste.filter((_v, index) => results[index]);
};
