import { Semaphore } from "@chriscdn/promise-semaphore";
import Base64 from "crypto-js/enc-base64.js";
import md5 from "crypto-js/md5.js";
import { v4 as uuidv4 } from "uuid";

import deepEqual from "deep-equal";
import { Oublier, RetourRecherche, Suivi } from "./v2/crabe/types.js";

export class CacheSuivi {
  verrou: Semaphore;
  suivis: Map<
    string,
    {
      val?: unknown;
      requêtes: { [clef: string]: Suivi<unknown> };
      oublier?: Oublier;
    }
  >;
  recherches: Map<
    string,
    {
      val?: unknown[];
      taillePrésente: number;
      requêtes: {
        [clef: string]: { f: Suivi<unknown>; taille: number };
      };
      fs?: RetourRecherche;
    }
  >;

  constructor() {
    this.verrou = new Semaphore();
    this.suivis = new Map();
    this.recherches = new Map();
  }

  vérifierArgs({
    args,
    adresseFonction,
  }: {
    args: [{ [clef: string]: unknown }];
    adresseFonction: string;
  }): { argsSansF: { [clef: string]: unknown }, f: Suivi<unknown>, nomArgFonction: string } {
    if (args.length < 1) {
      throw new Error(`La fonction ${adresseFonction} n'a pas d'arguments.`);
    }

    if (args.length > 1)
      throw new Error(
        `Les arguments de ${adresseFonction} doivent être regroupés dans un seul objet {}.`,
      );
    
    const objArgs = args[0]

    const nomArgFonction = Object.entries(objArgs).find(
      (x) => typeof x[1] === "function",
    )?.[0];
    if (!nomArgFonction)
      throw new Error(
        `Aucun argument pour ${adresseFonction} n'est une fonction.`,
      );

      const f = objArgs[nomArgFonction] as Suivi<unknown>;
      const argsSansF = Object.fromEntries(
        Object.entries(objArgs).filter((x) => typeof x[1] !== "function"),
      );
      if (Object.keys(objArgs).length !== Object.keys(argsSansF).length + 1) {
        throw new Error(
          "Plus d'un argument pour " +
            adresseFonction +
            " est une fonction : " +
            Object.keys(objArgs)
              .filter((a) => !Object.keys(argsSansF).includes(a))
              .join(", "),
        );
      }

    return { argsSansF, f, nomArgFonction };
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
    args: [{ [clef: string]: unknown }];
    ceciOriginal: U;
  }): Promise<Oublier> {
    // Extraire la fonction de suivi et les autres arguments
    const { f, argsSansF, nomArgFonction } = this.vérifierArgs({ args, adresseFonction });

    const codeCache = this.générerCodeCache({
      adresseFonction,
      idInstance,
      argsClefs: argsSansF,
    });
    const idRequête = uuidv4();

    await this.verrou.acquire(codeCache);

    // Vérifier si déjà en cache
    const suivi = this.suivis.get(codeCache)
    if (suivi) {
      this.verrou.release(codeCache);

      // Ajouter f à la liste de fonctions de rappel
      suivi.requêtes[idRequête] = f;
      if (Object.keys(suivi).includes("val"))
        f(suivi.val);
    } else {
      try {
        // Si pas en cache, générer
        this.suivis.set(codeCache, {
          requêtes: { [idRequête]: f },
        });
        
        const fFinale = async (x: unknown) => {
          const suivi = this.suivis.get(codeCache);
          if (!suivi) return; // Si on a déjà annulé la requête
          if (
            Object.keys(suivi).includes("val") &&
            deepEqual(suivi.val, x, { strict: true })
          )
            return; // Ignorer si c'est la même valeur qu'avant
            suivi.val = x;
          const fsSuivis = Object.values(suivi.requêtes);
          await Promise.allSettled(fsSuivis.map((f_) => f_(x)));
        };
        const argsAvecF = { ...argsSansF, [nomArgFonction]: fFinale };
        this.suivis.get(codeCache)!.oublier = await fOriginale.apply(ceciOriginal, [argsAvecF]);

      } finally {
        this.verrou.release(codeCache);
      }
    }

    const oublierRequête = async () => {
      await this.oublierSuivi({ codeCache, idRequête });
    };

    return oublierRequête;
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
    // Extraire la fonction de suivi et les autres arguments
    const { argsSansF, f, nomArgFonction } = this.vérifierArgs({ args, adresseFonction });

    const argsSansFOuTaille = Object.fromEntries(
      Object.entries(argsSansF).filter((x) => x[0] !== nomArgTaille),
    );

    let taille = argsSansF[nomArgTaille];
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
      const recherche = this.recherches.get(codeCache)
      if (!recherche) return; // Si on a déjà annulé la requête
      recherche.val = val;
      const infoRequêtes = Object.values(
        recherche.requêtes,
      );
      await Promise.allSettled(
        infoRequêtes.map(
          async (info) => await info.f(sélection(info.taille, val)),
        ),
      );
    };

    const actualiserTaille = async () => {
      const recherche = this.recherches.get(codeCache)
      if (!recherche) return; // Si on a déjà annulé la requête

      const maxTaille = Math.max(
        ...Object.values(recherche.requêtes).map(
          (r) => r.taille,
        ),
      );
      const { n } = recherche.fs!;

      if (maxTaille !== recherche.taillePrésente) {
        recherche.taillePrésente = maxTaille;
        n(maxTaille);
      }
    };

    const fChangerTailleRequête = async (taille: number) => {
      const recherche = this.recherches.get(codeCache)
      if (!recherche) return; // Si on a déjà annulé la requête

      const tailleAvant =
        recherche.requêtes[idRequête].taille;

      if (taille === tailleAvant) return;
      recherche.requêtes[idRequête].taille = taille;
      const { val } = recherche;
      if (val) await fFinale(val as R[]);
      actualiserTaille();
    };

    await this.verrou.acquire(codeCache);

    try {
      const recherche = this.recherches.get(codeCache)
      // Vérifier si déjà en cache
      if (!recherche) {
        // Si pas en cache, générer
        this.recherches.set(codeCache, {
          requêtes: { [idRequête]: { f, taille } },
          taillePrésente: taille,
        });

        const argsComplets = {
          ...argsSansFOuTaille,
          [nomArgFonction]: fFinale,
          [nomArgTaille]: taille,
        };

        this.recherches.get(codeCache)!.fs = await fOriginale.apply(
          ceciOriginal,
          [argsComplets],
        );
      } else {
        // Sinon, ajouter f à la liste de fonctions de rappel
        recherche.requêtes[idRequête] = { f, taille };
        if (Object.keys(recherche).includes("val")) {
          await actualiserTaille();
          const { val } = recherche;

          if (val) await fFinale(val as R[]);
        }
      }
    } finally {
      this.verrou.release(codeCache);
    }

    const oublierRequête = async () => {
      await this.oublierRecherche({ codeCache, idRequête });
    };

    return {
      oublier: oublierRequête,
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
      const { requêtes, oublier } = this.suivis.get(codeCache)!;
      delete requêtes[idRequête];

      if (!Object.keys(requêtes).length) {
        await oublier?.();
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
    if (!this.recherches.has(codeCache)) {
      this.verrou.release(codeCache);
      return;
    }
    try {
      const { requêtes, fs } = this.recherches.get(codeCache)!;
      delete requêtes[idRequête];

      if (!Object.keys(requêtes).length) {
        await fs?.oublier();
        this.recherches.delete(codeCache);
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
  return envelopper({
    nom,
    descripteur,
    recherche: (n: number, résultats: T[]) => résultats.slice(0, n),
  });
};

export type RésultatProfondeur<T> = { profondeur: number; val: T };

export const cacheRechercheParProfondeur = <T>(
  _cible: unknown,
  nom: string,
  descripteur: unknown,
) => {
  return envelopper({
    nom,
    descripteur,
    recherche: (n: number, résultats: RésultatProfondeur<T>[]) =>
      résultats.filter((r) => r.profondeur <= n),
  });
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
        const idInstance = idUnique(this);

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
