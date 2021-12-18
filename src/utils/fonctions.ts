import { EventEmitter, once } from "events";
import { schémaFonctionSuivi, schémaFonctionOublier } from "./types";

class ÉmetteurUneFois<T> extends EventEmitter {
  résultatPrêt: boolean;
  fOublier?: schémaFonctionOublier;
  résultat?: T;
  f: (fSuivi: schémaFonctionSuivi<T>) => Promise<schémaFonctionOublier>;

  constructor(
    f: (fSuivi: schémaFonctionSuivi<T>) => Promise<schémaFonctionOublier>
  ) {
    super();
    this.résultatPrêt = false;
    this.f = f;
    this.initialiser();
  }

  async initialiser() {
    const fSuivre = async (résultat: T) => {
      this.résultat = résultat;
      this.résultatPrêt = true;
      if (this.fOublier) this.lorsquePrêt();
    };

    this.fOublier = await this.f(fSuivre);
    this.lorsquePrêt();
  }

  lorsquePrêt() {
    if (this.résultatPrêt) {
      if (!this.fOublier) throw new Error("Fuite !!");
      if (this.fOublier) this.fOublier();
      this.emit("fini", this.résultat);
    }
  }
}

export const uneFois = async function <T>(
  f: (fSuivi: schémaFonctionSuivi<T>) => Promise<schémaFonctionOublier>
): Promise<T> {
  const émetteur = new ÉmetteurUneFois(f);
  const résultat = (await once(émetteur, "fini")) as [T];
  return résultat[0];
};

export const faisRien = (): void => {
  // Rien à faire
};
