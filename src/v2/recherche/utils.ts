const MIN_POINTS = 5;

export class EstimateurAsymptote {
  points: [number, number][];

  mémoire: number

  constructor({ mémoire }: { mémoire: number }) {
    this.points = []

    this.mémoire = Math.max(mémoire, MIN_POINTS)
  }

  ajouterPoint(x: number, y: number) {
    this.points.push([x, y])
    if (this.points.length > this.mémoire) {
      this.points = this.points.slice(this.points.length - this.mémoire)
    }
  }

  asymptote(): number | undefined {
    if (this.points.length < MIN_POINTS) return undefined;

    const x = this.points.map(point => point[0])
    const y = this.points.map(point => point[1])

    const { c } = régression(x, y);
    return c
  }
}

export class EstimateurAsymptoteTemps extends EstimateurAsymptote {
  début: number

  constructor({ mémoire }: { mémoire: number }) {  
    super({ mémoire })
    this.début = new Date().getTime();
  }

  ajouter(val: number): void {
    const maintenant = new Date().getTime();
    super.ajouterPoint(maintenant, val)
  }
}