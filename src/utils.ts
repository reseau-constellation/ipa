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
