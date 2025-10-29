import { IDBDatastore } from "datastore-idb";
import { isElectronMain, isNode } from "wherearewe";
import { ListenerSignature, TypedEmitter } from "tiny-typed-emitter";
import { Oublier, Suivi } from "../types.js";
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
