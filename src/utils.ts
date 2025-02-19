import { AbortError } from "@libp2p/interface";
import { élémentsBd } from "./types";

export const effacerPropriétésNonDéfinies = <
  T extends { [clef: string]: élémentsBd | undefined },
>(
  objet: T,
) => {
  return Object.fromEntries(
    Object.entries(objet).filter(([_clef, val]) => val !== undefined),
  ) as { [clef in keyof T]: T[clef] extends undefined ? never : T[clef] };
};

export const réessayer = async <T>({
  f,
  signal,
}: {
  f: () => Promise<T>;
  signal: AbortSignal;
}): Promise<T> => {
  try {
    return await f();
  } catch {
    if (signal.aborted) throw new AbortError();
    else return await réessayer({ f, signal });
  }
};
