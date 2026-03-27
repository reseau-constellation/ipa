export type ConstantesRéseautage = {
  n_max: number;
  n_min: number;
  a: number;
};

export const CONSTANTES_PAR_DÉFAUT: ConstantesRéseautage = {
  n_max: 50,
  n_min: 30,
  a: 3,
};

export const densitéCumul = ({
  params,
  x,
}: {
  params: ConstantesRéseautage;
  x: number;
}): number => {
  const { a } = params;
  return (1 - Math.exp(-a * x)) / (1 - Math.exp(-a));
};

const séq = (start: number, stop: number, step: number = 1) =>
  Array.from(
    { length: (stop - start) / step + 1 },
    (_value, index) => start + index * step,
  );

export const somme_f = (
  de: number,
  à: number,
  f: (i: number) => number,
): number => {
  return séq(de, à).reduce((a, b) => a + f(b), 0);
};

export const ajustementDensité = ({
  params,
  points,
}: {
  params: ConstantesRéseautage;
  points: number[];
}): number => {
  points.sort();

  const n = points.length;

  const f = (i: number) => {
    return Math.abs(i / n - densitéCumul({ params, x: points[i] }));
  };

  return somme_f(0, n, f) / n;
};

export const choisirMeilleurs = ({
  params,
  existants,
  potentiels,
  n_nouveaux,
}: {
  params: ConstantesRéseautage;
  existants: number[];
  potentiels: number[];
  n_nouveaux: number;
}): number[] => {
  existants = [...existants];
  potentiels = [...potentiels];

  const n_à_ajouter = Math.min(n_nouveaux, potentiels.length);
  if (n_à_ajouter === potentiels.length) return potentiels;

  const à_ajouter = [];

  for (let _ = 0; _ < n_nouveaux; _++) {
    const scores = potentiels.map((x) =>
      ajustementDensité({ params, points: [...existants, x] }),
    );
    const i_meilleur = potentiels.indexOf(Math.max(...scores));
    à_ajouter.push(potentiels[i_meilleur]);
    potentiels = potentiels.splice(i_meilleur, 1);
  }

  return à_ajouter;
};
