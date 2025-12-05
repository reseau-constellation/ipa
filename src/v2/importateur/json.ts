export type ClefsExtractionNonNul = (string | number)[];
export type ClefsExtraction = (string | number | -1)[];

export type ValsJSON =
  | number
  | string
  | boolean
  | ValsJSON[]
  | { [key: string]: ValsJSON };

export type ÉlémentDicJSON = { [key: string]: ValsJSON };
export type ÉlémentListeJSON = ValsJSON[];
export type ÉlémentJSON = ÉlémentDicJSON | ÉlémentListeJSON;
export type DonnéesJSON = ÉlémentJSON | ÉlémentJSON[];

const estUnDic = (x: unknown): boolean =>
  typeof x === "object" && !Array.isArray(x);
const estUneListe = (x: unknown): boolean => Array.isArray(x);

const extraireBranches = (
  données: DonnéesJSON,
  clefs: ClefsExtractionNonNul,
) => {
  let branches: ÉlémentListeJSON;

  if (!clefs.length) {
    branches = estUnDic(données)
      ? Object.values(données)
      : (données as ÉlémentListeJSON);
    return { base: {}, branches };
  }
  const avantDernière = extraireDonnées(
    données,
    clefs.slice(0, clefs.length - 1),
  );
  const dernièreClef = clefs[clefs.length - 1];
  let conteneurBranches: ÉlémentJSON;

  if (typeof dernièreClef === "number") {
    if (estUneListe(avantDernière)) {
      const x = (avantDernière as ÉlémentListeJSON)[dernièreClef];
      if (typeof x !== "object") throw new Error(x.toString());
      conteneurBranches = x;
      delete (avantDernière as ÉlémentListeJSON)[dernièreClef];
    } else {
      throw new Error(`${dernièreClef} ne peut pas indexer une liste.`);
    }
  } else if (typeof dernièreClef === "string") {
    if (estUnDic(avantDernière)) {
      const x = (avantDernière as ÉlémentDicJSON)[dernièreClef];
      if (typeof x !== "object") throw new Error(x.toString());
      conteneurBranches = x;
      delete (avantDernière as ÉlémentDicJSON)[dernièreClef];
    } else {
      throw new Error(`${dernièreClef} ne peut pas indexer un objet.`);
    }
  } else {
    throw new Error(`${dernièreClef} n'est pas une clef valide.`);
  }

  if (estUnDic(conteneurBranches)) {
    branches = Object.values(conteneurBranches);
  } else if (estUneListe(conteneurBranches)) {
    branches = conteneurBranches as ÉlémentListeJSON;
  } else {
    throw Error(JSON.stringify(conteneurBranches));
  }

  return { base: données, branches };
};

const injecterBranche = (
  base: ÉlémentJSON,
  clefs: ClefsExtractionNonNul,
  branche: ValsJSON,
) => {
  if (!clefs.length) {
    Object.assign(base, branche);
  } else {
    const clefsSaufLaDernière = clefs.slice(1, clefs.length);
    const avantDernière = extraireDonnées(base, clefsSaufLaDernière);
    const dernièreClef = clefs[clefs.length - 1];

    if (typeof dernièreClef === "number") {
      if (estUneListe(avantDernière)) {
        (avantDernière as ÉlémentListeJSON)[dernièreClef] = branche;
      } else {
        throw new Error(`${dernièreClef} ne peut pas indexer une liste.`);
      }
    } else if (typeof dernièreClef === "string") {
      if (estUnDic(avantDernière)) {
        (avantDernière as ÉlémentDicJSON)[dernièreClef] = branche;
      } else {
        throw new Error(`${dernièreClef} ne peut pas indexer un objet.`);
      }
    } else {
      throw new Error(`${dernièreClef} n'est pas une clef valide.`);
    }
  }
};

export const aplatirDonnées = (
  données: DonnéesJSON,
  clefs: ClefsExtraction = [],
  _base?: DonnéesJSON,
  _élémentsFinaux: ÉlémentJSON[] = [],
): ÉlémentJSON[] => {
  if (clefs[clefs.length - 1] !== -1) clefs.push(-1);

  const iNull = clefs.indexOf(-1);
  const clefsAvant = clefs.slice(0, iNull);
  const clefsAprès = clefs.slice(iNull + 1, clefs.length);

  const { base, branches } = extraireBranches(
    données,
    clefsAvant as ClefsExtractionNonNul,
  );

  for (const branche of branches) {
    if (typeof branche !== "object") throw new Error(branche.toString());

    const copieBase = structuredClone(base);
    injecterBranche(copieBase, clefsAvant as ClefsExtractionNonNul, branche);
    if (clefsAprès.length) {
      aplatirDonnées(branche, clefsAprès, copieBase, _élémentsFinaux);
    } else {
      _élémentsFinaux.push(copieBase);
    }
  }
  return _élémentsFinaux;
};

export const extraireDonnées = (
  données: DonnéesJSON,
  clefs: ClefsExtraction,
): ValsJSON => {
  let donnéesFinales: ValsJSON = données;
  for (const c of clefs) {
    if (typeof c === "number") {
      if (estUneListe(donnéesFinales)) {
        donnéesFinales = (donnéesFinales as ÉlémentListeJSON)[c];
      } else {
        throw new Error(`${c} ne peut pas indexer une liste.`);
      }
    } else if (typeof c === "string") {
      if (estUnDic(donnéesFinales)) {
        donnéesFinales = (donnéesFinales as ÉlémentDicJSON)[c];
      } else {
        throw new Error(`${c} ne peut pas indexer un objet.`);
      }
    } else {
      throw new Error(`Clef de type non indexable : ${c}`); // eslint-disable-line no-irregular-whitespace
    }
  }
  return donnéesFinales;
};

export class ImportateurDonnéesJSON {
  // Exemple: https://coordinates.native-land.ca/indigenousLanguageson
  donnéesJSON: DonnéesJSON;

  constructor(données: DonnéesJSON) {
    this.donnéesJSON = données;
  }

  obtDonnées(
    clefsRacine: ClefsExtraction,
    clefsÉléments: ClefsExtraction,
    cols: { [key: string]: ClefsExtraction },
  ): ÉlémentDicJSON[] {
    let données: ÉlémentDicJSON[] = [];

    let racineDonnéesJSON = extraireDonnées(this.donnéesJSON, clefsRacine);
    if (typeof racineDonnéesJSON !== "object") {
      throw new Error(
        `Type de données erroné : ${racineDonnéesJSON.toString()}`, // eslint-disable-line no-irregular-whitespace
      );
    }

    racineDonnéesJSON = aplatirDonnées(
      racineDonnéesJSON as ÉlémentListeJSON | ÉlémentDicJSON,
      clefsÉléments,
    );

    for (const élémentJSON of racineDonnéesJSON) {
      if (typeof élémentJSON !== "object")
        throw new Error(`ÉlémentJSON de type non supporté : ${élémentJSON}`); // eslint-disable-line no-irregular-whitespace
      const ÉlémentJSON = Object.fromEntries(
        Object.keys(cols)
          .map((c) => {
            const clefs = cols[c];
            let val: ValsJSON | undefined;
            try {
              val = extraireDonnées(élémentJSON, clefs);
            } catch {
              val = undefined;
            }

            return [c, val];
          })
          .filter((x) => x[1] !== undefined),
      );
      données = [ÉlémentJSON, ...données];
    }

    return données;
  }
}
