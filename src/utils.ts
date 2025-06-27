import {toUnicode} from "punycode";
import { TypedEmitter } from "tiny-typed-emitter";
import type { ListenerSignature } from "tiny-typed-emitter";
import type { schémaFonctionOublier, schémaFonctionSuivi } from "./types.js";
import { multiaddr, type Multiaddr } from "@multiformats/multiaddr";

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
  f: schémaFonctionSuivi<Parameters<L[U]>>;
}): schémaFonctionOublier => {
  const promesses = new Set<Promise<unknown>>();
  // @ts-expect-error à voir
  const fFinale: L[U] = (...args) => {
    const p = f(...(args as [Parameters<L[U]>]));
    if (estUnePromesse(p)) {
      promesses.add(p);
      p.finally(() => promesses.delete(p));
    }
    return p;
  };
  émetteur.on(événement, fFinale);
  return async () => {
    émetteur.off(événement, fFinale);
    await Promise.allSettled(promesses);
  };
};

export const dépunicodifier = (ma: Multiaddr): Multiaddr  => {
  const composantes = ma.getComponents();
  const composantesDépunicodifiées = composantes.map(c=>c.name.startsWith("dns") && c.value ? ({...c,  value: toUnicode(c.value)}) : c)
  return multiaddr(composantesDépunicodifiées)
}