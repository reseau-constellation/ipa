import { IDBDatastore } from "datastore-idb";
import { isElectronMain, isNode } from "wherearewe";
import { randomBytes } from "@noble/hashes/utils.js";
import bs58 from "bs58";

import { base64 } from "@hexagon/base64";
import { sha256 } from "js-sha256";
import { faisRien } from "@constl/utils-ipa";
import { TypedEmitter } from "tiny-typed-emitter";
import type { ListenerSignature } from "tiny-typed-emitter";
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
  événement: U | U[];
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

  const listeÉvénements = Array.isArray(événement) ? événement : [événement];

  listeÉvénements.forEach((é) => émetteur.on(é, fFinale as L[U]));
  return async () => {
    listeÉvénements.forEach((é) => émetteur.off(é, fFinale as L[U]));
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

export const combinerConfiances = (scores: number[]): number => {
  const positives = scores.filter((c) => c >= 0);
  const négatives = scores.filter((c) => c < 0);

  const négatif =
    1 - négatives.map((x) => 1 + x).reduce((total, c) => c * total, 1);
  const positif =
    1 - positives.map((x) => 1 - x).reduce((total, c) => c * total, 1);

  return positif - négatif;
};

export const générerCodeSecret = (): string =>
  bs58.encode(randomBytes(6 * 3)).slice(0, 6);

export const obtEmpreinteCode = ({
  codeSecret,
  identifiant,
}: {
  codeSecret: string;
  identifiant: string;
}): string => base64.fromString(sha256(codeSecret + identifiant));

export const vérifierProfondeur = (p: number): void => {
  if (p < 0) throw new Error("La profondeur ne peut pas être négative");

  if (Math.round(p) !== p)
    throw new Error("La profondeur doit être un nombre entier");
};

export type FonctionRésolveur<T, S> = (
  args: T & { f: Suivi<S> },
) => Promise<Oublier>;

export type Résolveur<T, S> = FonctionRésolveur<T, S> & {
  fermer: () => Promise<void>;
};

export const générerRésolveur = <T, S>(
  f: FonctionRésolveur<T, S>,
): Résolveur<T, S> => {
  const oublis = new Set<Oublier>();

  let fermé = false;
  let n = 0;
  const événements = new TypedEmitter<{ terminé: (n: number) => void }>();

  const fermer = async () => {
    fermé = true;
    await new Promise<void>((compléter) => {
      événements.on("terminé", () => {
        if (n === 0) compléter();
      });
      if (n === 0) compléter();
    });

    await Promise.allSettled(oublis.values().map((f) => f()));
  };
  const fFinale = async (...args: Parameters<FonctionRésolveur<T, S>>) => {
    if (fermé) return faisRien;
    n++;
    const oublier = await f(...args);
    oublis.add(oublier);
    n--;
    événements.emit("terminé", n);

    return async () => {
      oublier();
      oublis.delete(oublier);
    };
  };
  return Object.assign(fFinale, { fermer });
};
