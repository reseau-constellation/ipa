import { Semaphore } from "@chriscdn/promise-semaphore";
import Base64 from "crypto-js/enc-base64.js";
import md5 from "crypto-js/md5.js";
import { v4 as uuidv4 } from "uuid";

import deepEqual from "deep-equal";
import { Oublier, RetourRecherche, Suivi } from "./v2/crabe/types.js";

export class CacheSuivi {
  verrou: Semaphore;
  suivis: Map<string, {
      val?: unknown;
      requêtes: { [clef: string]: Suivi<unknown> };
      fOublier?: Oublier;
    }>;
  _cacheRecherche: {
    [clef: string]: {
      val?: unknown[];
      taillePrésente: number;
      requêtes: {
        [clef: string]: { f: Suivi<unknown>; taille: number };
      };
      fs?: RetourRecherche;
    };
  };

  constructor() {
    this.verrou = new Semaphore();
    this.suivis = new Map();
    this._cacheRecherche = {};
  }

  vérifierArgs({ args, adresseFonction }: {args: [{ [clef: string]: unknown }]; adresseFonction: string }): { [clef: string]: unknown } {
    if (args.length < 1) {
      throw new Error(`La fonction ${adresseFonction} n'a pas d'arguments.`)
    }

    if (args.length > 1)
      throw new Error(
        `Les arguments de ${adresseFonction} doivent être regroupés dans un seul objet {}.`,
      );
    return args[0]
  }

  async suivre<
    T extends (args: { [key: string]: unknown }) => Promise<Oublier>,
    U,
  >({
    adresseFonction,
    idInstance,
    fOriginale,
    args,
    ceciOriginal,
  }: {
    adresseFonction: string;
    idInstance: string;
    fOriginale: T;
    args:  [{ [clef: string]: unknown }];
    ceciOriginal: U;
  }): Promise<Oublier> {
    const argsFinaux = this.vérifierArgs({ args, adresseFonction })

    // Extraire la fonction de suivi
    const nomArgFonction = Object.entries(argsFinaux).find(
      (x) => typeof x[1] === "function",
    )?.[0];
    if (!nomArgFonction)
      throw new Error(
        `Aucun argument pour ${adresseFonction} n'est une fonction.`,
      );
    const f = argsFinaux[nomArgFonction] as Suivi<unknown>;
    const argsSansF = Object.fromEntries(
      Object.entries(argsFinaux).filter((x) => typeof x[1] !== "function"),
    );
    if (Object.keys(argsFinaux).length !== Object.keys(argsSansF).length + 1) {
      throw new Error(
        "Plus d'un argument pour " +
          adresseFonction +
          " est une fonction : " +
          Object.keys(argsFinaux).filter(a=>!Object.keys(argsSansF).includes(a)).join(", "),
      );
    }

    const codeCache = this.générerCodeCache({
      adresseFonction,
      idInstance,
      argsClefs: argsSansF,
    });
    const idRequête = uuidv4();

    await this.verrou.acquire(codeCache);

    // Vérifier si déjà en cache
    if (!this.suivis.has(codeCache)) {
      try {
        // Si pas en cache, générer
        this.suivis.set(codeCache, {
          requêtes: { [idRequête]: f },
        });
        const fFinale = async (x: unknown) => {
          const infoSuivi = this.suivis.get(codeCache);
          if (!infoSuivi) return; // Si on a déjà annulé la requête
          if (
            Object.keys(infoSuivi).includes("val") &&
            deepEqual(infoSuivi.val, x, { strict: true })
          )
            return; // Ignorer si c'est la même valeur qu'avant
          infoSuivi.val = x;
          const fsSuivis = Object.values(infoSuivi.requêtes);
          await Promise.allSettled(fsSuivis.map((f_) => f_(x)));
        };
        const argsAvecF = { ...argsSansF, [nomArgFonction]: fFinale };

        const fOublier = await fOriginale.apply(ceciOriginal, [argsAvecF]);
        this.suivis.get(codeCache)!.fOublier = fOublier;
      } finally {
        this.verrou.release(codeCache);
      }
    } else {
      this.verrou.release(codeCache);

      // Sinon, ajouter f à la liste de fonctions de rappel
      this.suivis.get(codeCache)!.requêtes[idRequête] = f;
      if (Object.keys(this.suivis.get(codeCache)!).includes("val"))
        f(this.suivis.get(codeCache)!.val);
    }

    const fOublierRequête = async () => {
      await this.oublierSuivi({ codeCache, idRequête });
    };

    return fOublierRequête;
  }

  async suivreRecherche<
    T extends (...args: unknown[]) => Promise<RetourRecherche>,
    R,
    U,
  >({
    adresseFonction,
    nomArgTaille,
    idInstance,
    fOriginale,
    args,
    ceciOriginal,
    sélection,
  }: {
    adresseFonction: string;
    nomArgTaille: string;
    idInstance: string;
    fOriginale: T;
    args: [{ [clef: string]: unknown }];
    ceciOriginal: U;
    sélection: (n: number, résultats: R[]) => R[];
  }): Promise<RetourRecherche> {
    const argsFinaux = this.vérifierArgs({args, adresseFonction});

    // Extraire la fonction de suivi
    const nomArgFonction = Object.entries(argsFinaux).find(
      (x) => typeof x[1] === "function",
    )?.[0];

    if (!nomArgFonction) throw new Error(`Aucun argument pour ${adresseFonction} n'est une fonction.`);
    const f = argsFinaux[nomArgFonction] as Suivi<unknown>;
    const argsSansF = Object.fromEntries(
      Object.entries(argsFinaux).filter((x) => typeof x[1] !== "function"),
    );
    if (Object.keys(argsFinaux).length !== Object.keys(argsSansF).length + 1) {
      throw new Error(
        "Plus d'un argument pour " +
          adresseFonction +
          " est une fonction : " +
          Object.keys(argsFinaux).filter(a=>!Object.keys(argsSansF).includes(a)).join(", ")
      );
    }
    const argsSansFOuTaille = Object.fromEntries(
      Object.entries(argsFinaux).filter((x) => x[0] !== nomArgTaille),
    );

    let taille = argsFinaux[nomArgTaille];
    if (taille === undefined) taille = Infinity;
    if (typeof taille !== "number")
      throw new Error(
        `Argument ${nomArgTaille} n'est pas un nombre dans la fonction ${adresseFonction}.`,
      );

    const codeCache = this.générerCodeCache({
      adresseFonction,
      idInstance,
      argsClefs: argsSansFOuTaille,
    });
    const idRequête = uuidv4();

    const fFinale = async (val: R[]) => {
      if (!this._cacheRecherche[codeCache]) return; // Si on a déjà annulé la requête
      this._cacheRecherche[codeCache].val = val;
      const infoRequêtes = Object.values(
        this._cacheRecherche[codeCache].requêtes,
      );
      await Promise.allSettled(
        infoRequêtes.map(
          async (info) =>
            await info.f(
              sélection(info.taille, val)
            ),
        ));
    };

    const actualiserTaille = async () => {
      const maxTaille = Math.max(
        ...Object.values(this._cacheRecherche[codeCache].requêtes).map(
          (r) => r.taille,
        ),
      );
      const { taillePrésente } = this._cacheRecherche[codeCache];
      const { n } = this._cacheRecherche[codeCache].fs!;

      if (maxTaille !== taillePrésente) {
        this._cacheRecherche[codeCache].taillePrésente = maxTaille;
        n(maxTaille);
      }
    }


    const fChangerTailleRequête = async (taille: number) => {

      const tailleAvant =
        this._cacheRecherche[codeCache].requêtes[idRequête].taille;

      if (taille === tailleAvant) return;
      this._cacheRecherche[codeCache].requêtes[idRequête].taille = taille;
      const { val } = this._cacheRecherche[codeCache];
      if (val) await fFinale(val as R[]);
      actualiserTaille();
      
    };

    await this.verrou.acquire(codeCache);
    
    try {
      // Vérifier si déjà en cache
      if (!this._cacheRecherche[codeCache]) {
        // Si pas en cache, générer
        this._cacheRecherche[codeCache] = {
          requêtes: { [idRequête]: { f, taille } },
          taillePrésente: taille,
        };

        const argsComplets = {
          ...argsSansFOuTaille,
          [nomArgFonction]: fFinale,
          [nomArgTaille]: taille,
        };

        this._cacheRecherche[codeCache].fs = await fOriginale.apply(
          ceciOriginal,
          [argsComplets],
        );
      } else {
        // Sinon, ajouter f à la liste de fonctions de rappel
        this._cacheRecherche[codeCache].requêtes[idRequête] = { f, taille };
        if (Object.keys(this._cacheRecherche[codeCache]).includes("val")) {
          await actualiserTaille()
          const { val } = this._cacheRecherche[codeCache];

          if (val) await fFinale(val as R[]);
        }
      }
    } finally {
      this.verrou.release(codeCache);
    }

    const fOublierRequête = async () => {
      await this.oublierRecherche({ codeCache, idRequête });
    };

    return {
      oublier: fOublierRequête,
      n: fChangerTailleRequête,
    };
  }

  async oublierSuivi({
    codeCache,
    idRequête,
  }: {
    codeCache: string;
    idRequête: string;
  }) {
    await this.verrou.acquire(codeCache);

    if (!this.suivis.has(codeCache)) {
      this.verrou.release(codeCache);
      return;
    }
    try {
      const { requêtes, fOublier } = this.suivis.get(codeCache)!;
      delete requêtes[idRequête];

      if (!Object.keys(requêtes).length) {
        await fOublier?.();
        this.suivis.delete(codeCache);
      }
    } finally {
      this.verrou.release(codeCache);
    }
  }

  async oublierRecherche({
    codeCache,
    idRequête,
  }: {
    codeCache: string;
    idRequête: string;
  }) {
    await this.verrou.acquire(codeCache);
    if (this._cacheRecherche[codeCache] === undefined) {
      this.verrou.release(codeCache);
      return;
    }
    try {
      const { requêtes, fs } = this._cacheRecherche[codeCache];
      delete requêtes[idRequête];

      if (!Object.keys(requêtes).length) {
        await fs?.oublier();
        delete this._cacheRecherche[codeCache];
      }
    } finally {
      this.verrou.release(codeCache);
    }
  }

  générerCodeCache({
    adresseFonction,
    idInstance,
    argsClefs,
  }: {
    adresseFonction: string;
    idInstance: string;
    argsClefs: { [clef: string]: unknown };
  }): string {
    const texte =
      adresseFonction + "-" + idInstance + "-" + JSON.stringify(argsClefs);
    return Base64.stringify(md5(texte));
  }
}

export const cacheSuivi = (
  _cible: unknown,
  nom: string,
  descripteur: unknown,
) => {
  return envelopper({ nom, descripteur });
};

export const cacheRechercheParN = <T>(
  _cible: unknown,
  nom: string,
  descripteur: unknown,
) => {
  return envelopper({ nom, descripteur, recherche: (n: number, résultats: T[]) => résultats.slice(0, n) });
};

export type RésultatProfondeur<T> = { profondeur: number, val: T }

export const cacheRechercheParProfondeur = <T>(
  _cible: unknown,
  nom: string,
  descripteur: unknown,
) => {
  return envelopper({ nom, descripteur, recherche:  (n: number, résultats: RésultatProfondeur<T>[]) => résultats.filter(r => r.profondeur <= n) });
};

const map = new WeakMap();

const idUnique = (object: WeakKey) => {
  if (!map.has(object)) {
    map.set(object, uuidv4());
  }

  return map.get(object);
};

export const envelopper = <T>({
  nom,
  descripteur,
  recherche,
}: {
  nom: string;
  descripteur: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  recherche?: (n: number, résultats: T[]) => T[];
  nomArgTaille?: string;
}) => {
  const original = descripteur.value;

  if (typeof original === "function") {
    descripteur.value = function (...args: [{ [clef: string]: unknown }]) {
      const adresseFonction = this.constructor.name + "." + nom;

      try {
        const idInstance = idUnique(this)

        if (recherche) {
          return cache.suivreRecherche({
            adresseFonction,
            idInstance,
            fOriginale: original,
            args,
            ceciOriginal: this,
            nomArgTaille: "n",
            sélection: recherche,
          });
        } else {
          return cache.suivre({
            adresseFonction,
            idInstance,
            fOriginale: original,
            args,
            ceciOriginal: this,
          });
        }
      } catch (e) {
        console.error(`Erreur: ${e}`);
        throw e;
      }
    };
  } else {
    throw new Error("L'objet décoré n'est pas une fonction.");
  }
  return descripteur;
};

export const cache = new CacheSuivi();
