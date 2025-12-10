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

    const { c } = régressionAsymptote(x, y);
    return c;
  }
}

export const calculerIntersection = ({
  p,
  points,
}: {
  p: number;
  points: [number, number][];
}): number | undefined => {};
