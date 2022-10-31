import Semaphore from "@chriscdn/promise-semaphore";
import { v4 as uuidv4 } from "uuid";

import {
  schémaFonctionOublier,
  schémaFonctionSuivi
} from "@/utils/index.js";

export class CacheSuivi {
  verrou: Semaphore;
  _cache: {[clef: string]: {
    val?: unknown,
    requètes: {[clef: string]: schémaFonctionSuivi<unknown>},
    fOublier?: schémaFonctionOublier,
  }}

  constructor() {
    this.verrou = new Semaphore();
    this._cache = {};
  }

  async suivre<T extends Function, U>({
    adresseFonction,
    idClient,
    fOriginale,
    args,
    ceciOriginal,
  }: {
    adresseFonction: string,
    idClient: string,
    fOriginale: T,
    args: {[clef: string]: unknown},
    ceciOriginal: U
  }): Promise<schémaFonctionOublier> {
    // Extraire la fonction de suivi
    const nomArgFonction = Object.entries(args).find(
      (x) => typeof x[1] === "function"
    )?.[0];
    const f = args[nomArgFonction] as schémaFonctionSuivi<unknown>;
    const argsSansF = Object.fromEntries(
      Object.entries(args).filter((x) => typeof x[1] !== "function")
    );
    if (Object.keys(args).length !== Object.keys(argsSansF).length + 1) {
      throw "Plus d'un argument est une fonction : " + JSON.stringify(args);
    }

    const codeCache = this.générerCodeCache({adresseFonction, idClient, argsSansF});
    const idRequète = uuidv4()

    await this.verrou.acquire(codeCache);

    // Vérifier si déjà en cache
    if (!this._cache[codeCache]) {
      // Si pas en cache, générer
      this._cache[codeCache] = {
        requètes: {[idRequète]: f},
      };
      const fFinale = (x: unknown) => {
        this._cache[codeCache].val = x
        const fsSuivis = Object.values(this._cache[codeCache].requètes);
        fsSuivis.forEach(f_=>f_(x))
      }
      const argsAvecF = {...argsSansF, [nomArgFonction]: fFinale}

      const fOublier = await fOriginale.apply(ceciOriginal, [argsAvecF])
      this._cache[codeCache].fOublier = fOublier
    } else {
      // Sinon, ajouter f à la liste de fonctions de rappel
      this._cache[codeCache].requètes[idRequète] = f
      if (Object.keys(this._cache[codeCache]).includes("val")) f(this._cache[codeCache].val)
    }

    const fOublierRequète = () => {
      this.oublier({codeCache, idRequète})
    }
    this.verrou.release(codeCache);

    return fOublierRequète
  }

  async oublier({codeCache, idRequète}: {codeCache: string, idRequète: string}) {
    await this.verrou.acquire(codeCache);
    const { requètes, fOublier } = this._cache[codeCache];
    delete requètes[idRequète];

    if (!Object.keys(requètes).length) {
      fOublier();
      delete this._cache[codeCache]
    }
    this.verrou.release(codeCache);
  };

  générerCodeCache({
    adresseFonction,
    idClient,
    argsSansF
  }: {
    adresseFonction: string,
    idClient: string,
    argsSansF: {[clef: string]: unknown}
  }): string {
    return adresseFonction + "-" + idClient + "-" + JSON.stringify(argsSansF)
  }
}

export const cacheSuivi = new CacheSuivi();


export function cache(target:any, name:any, descriptor:any) {
  const original = descriptor.value;
  if (typeof original === 'function') {
    descriptor.value = function(...args: any[]) {

      if (args.length > 1) throw "Args trop longs";

      try {
        const result = cacheSuivi.suivre({
          adresseFonction: this.constructor.name + "." + name,
          idClient: this.client.idBdCompte,
          fOriginale: original,
          args: args[0],
          ceciOriginal: this
        });
        return result;
      } catch (e) {
        console.error(`Erreur: ${e}`);
        throw e;
      }
    }
  }
  return descriptor;
}
