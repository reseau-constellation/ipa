export type valsJSON =
  | number
  | string
  | boolean
  | valsJSON[]
  | { [key: string]: valsJSON };

export type élémentDic = { [key: string]: valsJSON };
export type élémentListe = valsJSON[];
export type élément = élémentDic | élémentListe;
export type DonnéesJSON = élément | élément[];

const copieProfonde = (données: DonnéesJSON) => {
  return JSON.parse(JSON.stringify(données));
};

const estUnDic = (x: unknown): boolean =>
  typeof x === "object" && !Array.isArray(x);
const estUneListe = (x: unknown): boolean => Array.isArray(x);

const extraireBranches = (
  données: DonnéesJSON,
  clefs: clefsExtractionNonNul,
) => {
  let branches: élémentListe;

  if (!clefs.length) {
    branches = estUnDic(données)
      ? Object.values(données)
      : (données as élémentListe);
    return { base: {}, branches };
  }
  const avantDernière = extraireDonnées(
    données,
    clefs.slice(0, clefs.length - 1),
  );
  const dernièreClef = clefs[clefs.length - 1];
  let conteneurBranches: élément;

  if (typeof dernièreClef === "number") {
    if (estUneListe(avantDernière)) {
      const x = (avantDernière as élémentListe)[dernièreClef];
      if (typeof x !== "object") throw new Error(x.toString());
      conteneurBranches = x;
      delete (avantDernière as élémentListe)[dernièreClef];
    } else {
      throw new Error(`${dernièreClef} ne peut pas indexer une liste.`);
    }
  } else if (typeof dernièreClef === "string") {
    if (estUnDic(avantDernière)) {
      const x = (avantDernière as élémentDic)[dernièreClef];
      if (typeof x !== "object") throw new Error(x.toString());
      conteneurBranches = x;
      delete (avantDernière as élémentDic)[dernièreClef];
    } else {
      throw new Error(`${dernièreClef} ne peut pas indexer un objet.`);
    }
  } else {
    throw new Error(`${dernièreClef} n'est pas une clef valide.`);
  }

  if (estUnDic(conteneurBranches)) {
    branches = Object.values(conteneurBranches);
  } else if (estUneListe(conteneurBranches)) {
    branches = conteneurBranches as élémentListe;
  } else {
    throw Error(JSON.stringify(conteneurBranches));
  }

  return { base: données, branches };
};

const injecterBranche = (
  base: élément,
  clefs: clefsExtractionNonNul,
  branche: valsJSON,
) => {
  if (!clefs.length) {
    Object.assign(base, branche);
  } else {
    const clefsSaufLaDernière = clefs.slice(1, clefs.length);
    const avantDernière = extraireDonnées(base, clefsSaufLaDernière);
    const dernièreClef = clefs[clefs.length - 1];

    if (typeof dernièreClef === "number") {
      if (estUneListe(avantDernière)) {
        (avantDernière as élémentListe)[dernièreClef] = branche;
      } else {
        throw new Error(`${dernièreClef} ne peut pas indexer une liste.`);
      }
    } else if (typeof dernièreClef === "string") {
      if (estUnDic(avantDernière)) {
        (avantDernière as élémentDic)[dernièreClef] = branche;
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
  clefs: clefsExtraction = [],
  _base?: DonnéesJSON,
  _élémentsFinaux: élément[] = [],
): élément[] => {
  if (clefs[clefs.length - 1] !== -1) clefs.push(-1);

  const iNull = clefs.indexOf(-1);
  const clefsAvant = clefs.slice(0, iNull);
  const clefsAprès = clefs.slice(iNull + 1, clefs.length);

  const { base, branches } = extraireBranches(
    données,
    clefsAvant as clefsExtractionNonNul,
  );

  for (const branche of branches) {
    if (typeof branche !== "object") throw new Error(branche.toString());

    const copieBase = copieProfonde(base);
    injecterBranche(copieBase, clefsAvant as clefsExtractionNonNul, branche);
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
  clefs: clefsExtraction,
): valsJSON => {
  let donnéesFinales: valsJSON = données;
  for (const c of clefs) {
    if (typeof c === "number") {
      if (estUneListe(donnéesFinales)) {
        donnéesFinales = (donnéesFinales as élémentListe)[c];
      } else {
        throw new Error(`${c} ne peut pas indexer une liste.`);
      }
    } else if (typeof c === "string") {
      if (estUnDic(donnéesFinales)) {
        donnéesFinales = (donnéesFinales as élémentDic)[c];
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
    clefsRacine: clefsExtraction,
    clefsÉléments: clefsExtraction,
    cols: { [key: string]: clefsExtraction },
  ): élémentDic[] {
    let données: élémentDic[] = [];

    let racineDonnéesJSON = extraireDonnées(this.donnéesJSON, clefsRacine);
    if (typeof racineDonnéesJSON !== "object") {
      throw new Error(
        `Type de données erroné : ${racineDonnéesJSON.toString()}`, // eslint-disable-line no-irregular-whitespace
      );
    }

    racineDonnéesJSON = aplatirDonnées(
      racineDonnéesJSON as élémentListe | élémentDic,
      clefsÉléments,
    );

    for (const élémentJSON of racineDonnéesJSON) {
      if (typeof élémentJSON !== "object")
        throw new Error(`Élément de type non supporté : ${élémentJSON}`); // eslint-disable-line no-irregular-whitespace
      const élément = Object.fromEntries(
        Object.keys(cols)
          .map((c) => {
            const clefs = cols[c];
            let val: valsJSON | undefined;
            try {
              val = extraireDonnées(élémentJSON, clefs);
            } catch {
              val = undefined;
            }

            return [c, val];
          })
          .filter((x) => x[1] !== undefined),
      );
      données = [élément, ...données];
    }

    return données;
  }
}
