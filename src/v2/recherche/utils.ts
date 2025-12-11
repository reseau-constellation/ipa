const MIN_POINTS = 5;

export class EstimateurAsymptoteTemps {
  début: number;
  mémoire: number;

  points: [number, number][];

  constructor({ mémoire }: { mémoire: number }) {
    this.début = new Date().getTime();
    this.mémoire = Math.max(mémoire, MIN_POINTS);

    this.points = [];
  }

  ajouter(val: number) {
    const maintenant = new Date().getTime();
    this.points.push([maintenant, val]);

    if (this.points.length > this.mémoire) {
      this.points = this.points.slice(this.points.length - this.mémoire);
    }
  }

  asymptote(): number | undefined {
    if (this.points.length < MIN_POINTS) return undefined;

    const x = this.points.map((point) => point[0]);
    const y = this.points.map((point) => point[1]);

    const { a } = régressionAsymptotique(x, y);
    return a;
  }
}

export const calculerIntersection = ({
  p,
  points,
}: {
  p: number;
  points: [number, number][];
}): number | undefined => {
  if (points.length < MIN_POINTS) return undefined;

  const x = points.map((point) => point[0]);
  const y = points.map((point) => point[1]);

  const { a, b, c } = régressionAsymptotique(x, y);

  return Math.log((-a * (p - 1)) / (a - b)) / -c;
};

const écartType = (array: number[]): number => {
  // https://stackoverflow.com/questions/7343890/standard-deviation-javascript#53577159
  const n = array.length;
  const mean = array.reduce((a, b) => a + b) / n;
  return Math.sqrt(
    array.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / (n - 1),
  );
};

const régressionNonLinéaire = ({
  f,
  x,
  y,
  p0,
}: {
  f: (x: number[], p: number[]) => number[];
  x: number[];
  y: number[];
  p0: number[];
}): number[] => {
  // Licence MIT Jonas Almeida https://github.com/jonasalmeida/fminsearch
  const maxItér = 1000;
  const pas = p0.map((p) => (p === 0 ? 1 : p) / 100);

  const fObj = (y: number[], y_p: number[]) =>
    y.map((y_i, i) => Math.pow(y_i - y_p[i], 2)).reduce((a, b) => a + b); // SSD

  p0 = p0.slice();
  let p1 = p0.slice();

  const objP = (p: number[]) => fObj(y, f(x, p)); // la fonction à minimiser
  for (let i = 0; i < maxItér; i++) {
    for (let j = 0; j < p0.length; j++) {
      // un pas par paramètre
      p1 = p0.slice();
      p1[j] += pas[j];
      // si on s'en va dans la bonne direction
      if (objP(p1) < objP(p0)) {
        pas[j] = 1.2 * pas[j]; // alors on accélère
        p0 = p1.slice();
      } else {
        pas[j] = -(0.5 * pas[j]); // sinon, on ralenti et on change de direction
      }
    }
  }
  return p0;
};

const régressionAsymptotique = (x: number[], y: number[]) => {
  // y = a−(a-b) * e^(−c*x); a = asymptote ; b = intercepte y
  const σ_x = écartType(x);
  const σ_y = écartType(y);

  const f = (x: number[], p: number[]) => {
    const [a, b, c] = p;
    const e = 2.71818;
    return x.map((x_i) => a - (a - b) * e ** (-c * x_i));
  };

  const paramètres = régressionNonLinéaire({
    f,
    x: x.map((z) => z / σ_x),
    y: y.map((z) => z / σ_y),
    p0: [Math.max(...y), Math.max(...y) / 2, 0.1],
  });

  return {
    a: paramètres[0] * σ_y,
    b: paramètres[1] * σ_y,
    c: paramètres[2] * σ_x,
  };
};
