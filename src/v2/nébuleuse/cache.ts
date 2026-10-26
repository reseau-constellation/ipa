import { Semaphore } from "@chriscdn/promise-semaphore";
import { v4 as uuidv4 } from "uuid";

import deepEqual from "fast-deep-equal";
import { base64 } from "@hexagon/base64";

import { sha256 } from "js-sha256";
import type { Oublier, RetourRecherche, Suivi } from "./types.js";
import { estUnePromesse } from "./services/utils.js";

export class CacheSuivi {
  verrou: Semaphore;
  suivis: Map<
    string,
    {
      val?: unknown;
      requêtes: Map<string, { f: Suivi<unknown>; promesses: Set<Promise<unknown>> }>;
      oublier?: Oublier;
    }
  >;
  recherches: Map<
    string,
    {
      val?: unknown[];
      taillePrésente: number;
      requêtes: Map<string, { f: Suivi<unknown>; taille: number; promesses: Set<Promise<unknown>> }>;
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
  }): {
    argsSansF: { [clef: string]: unknown };
    f: Suivi<unknown>;
    nomArgFonction: string;
  } {
    if (args.length < 1) {
      throw new Error(`La fonction ${adresseFonction} n'a pas d'arguments.`);
    }

    if (args.length > 1)
      throw new Error(
        `Les arguments de ${adresseFonction} doivent être regroupés dans un seul objet {}.`,
      );

    const objArgs = args[0];

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
    const { f, argsSansF, nomArgFonction } = this.vérifierArgs({
      args,
      adresseFonction,
    });

    const codeCache = this.générerCodeCache({
      adresseFonction,
      idInstance,
      argsClefs: argsSansF,
    });
    const idRequête = uuidv4();
    
    const ajouterAuSuivi = (suiviExistant: Exclude<ReturnType<CacheSuivi["suivis"]["get"]>, undefined>) => {
      const promessesF: Set<Promise<unknown>> = new Set();

      suiviExistant.requêtes.set(idRequête, { f, promesses: promessesF });

      if (Object.keys(suiviExistant).includes("val")) {
        // Différentier `val` absent de `val === undefined`}
        const p = f(suiviExistant.val)
        if (estUnePromesse(p)) promessesF.add(p.finally(() => promessesF.delete(p)))
      };
    }

    // Vérifier si déjà en cache
    let suivi = this.suivis.get(codeCache);
    if (suivi) {
      // Ajouter f à la liste de fonctions de rappel
        ajouterAuSuivi(suivi)
    } else {
      try {
        await this.verrou.acquire(codeCache);
        suivi = this.suivis.get(codeCache);
        if (suivi) {
          ajouterAuSuivi(suivi)
        } else {
          // Si pas en cache, générer
          const requêtes = new Map()
          requêtes.set(idRequête, {f, promesses: new Set() })
          this.suivis.set(codeCache, {
            requêtes,
          });
  
          const fFinale = async (x: unknown) => {
            const suivi = this.suivis.get(codeCache);
            if (!suivi) return; // Si on a déjà annulé la requête
  
            if (Object.keys(suivi).includes("val") && deepEqual(suivi.val, x))
              return; // Ignorer si c'est la même valeur qu'avant
  
            suivi.val = x;
            const fsSuivis = suivi.requêtes.values();

            await Promise.allSettled(fsSuivis.map(({f: f_, promesses }) => {
              const p = f_(x)
              if (estUnePromesse(p)) promesses.add(p.finally(() => promesses.delete(p)))
              return p
            }));
          };
          const argsAvecF = { ...argsSansF, [nomArgFonction]: fFinale };
          this.suivis.get(codeCache)!.oublier = await fOriginale.apply(
            ceciOriginal,
            [argsAvecF],
          );
        }
      } finally {
        this.verrou.release(codeCache);
      }
    }

    let oublié = false
    const oublierRequête = async () => {
      if (oublié) throw new Error("oublié en double" + idRequête + codeCache)
      oublié = true
      await this.oublierSuivi({ codeCache, idRequête });
    };

    return oublierRequête;
  }

  async suivreRecherche<
    T extends (...args: unknown[]) => Promise<RetourRecherche<N>>,
    N extends string,
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
    nomArgTaille: N;
    idInstance: string;
    fOriginale: T;
    args: [{ [clef: string]: unknown }];
    ceciOriginal: U;
    sélection: (n: number, résultats: R[]) => R[];
  }): Promise<RetourRecherche<N>> {
    // Extraire la fonction de suivi et les autres arguments
    const { argsSansF, f, nomArgFonction } = this.vérifierArgs({
      args,
      adresseFonction,
    });

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
      const recherche = this.recherches.get(codeCache);
      if (!recherche) return; // Si on a déjà annulé la requête
      recherche.val = val;
      const infoRequêtes = recherche.requêtes.values();
      await Promise.allSettled(      infoRequêtes.map(
        (info) => {
          const p = info.f(sélection(info.taille, val))
          if (estUnePromesse(p)) info.promesses.add(p.finally(()=>info.promesses.delete(p)))
          return p
        },
      ));
    };

    const actualiserTaille = () => {
      const recherche = this.recherches.get(codeCache);
      if (!recherche) return; // Si on a déjà annulé la requête

      const maxTaille = Math.max(
        ...recherche.requêtes.values().map((r) => r.taille),
      );

      if (maxTaille !== recherche.taillePrésente) {
        recherche.taillePrésente = maxTaille;
        const taille = recherche.fs![nomArgTaille];
        taille(maxTaille);
      }
    };

    const fChangerTailleRequête = async (taille: number) => {
      
      const recherche = this.recherches.get(codeCache);
      if (!recherche) return; // Si on a déjà annulé la requête

      const requête = recherche.requêtes.get(idRequête)
      if (!requête) return

      const tailleAvant = requête.taille;

      if (taille === tailleAvant) return;
      requête.taille = taille;
      const { val } = recherche;

      if (val) await fFinale(val as R[]);
      actualiserTaille();
    };

    const ajouterAuSuiviRecherche = (suiviExistant: Exclude<ReturnType<CacheSuivi["recherches"]["get"]>, undefined>) => {
      const promesses: Set<Promise<unknown>> = new Set();
      suiviExistant.requêtes.set(idRequête, { f, taille, promesses });
      actualiserTaille();
      if (Object.keys(suiviExistant).includes("val")) {
        const p = f(sélection(taille, suiviExistant.val as R[]))
        if (estUnePromesse(p)) promesses.add(p.finally(()=>promesses.delete(p)))
      };
    }

    let recherche = this.recherches.get(codeCache);
    
    // Vérifier si déjà en cache
    if (recherche) {
      // Si présent, ajouter f à la liste de fonctions de rappel
      ajouterAuSuiviRecherche(recherche)
    } else {
      await this.verrou.acquire(codeCache);
      recherche = this.recherches.get(codeCache)
      try {
        if (recherche) {
          ajouterAuSuiviRecherche(recherche)
        } else {
          // Si pas en cache, générer
          const requêtes = new Map();
          const promesses = new Set();
          requêtes.set(idRequête, { f, taille, promesses });
          this.recherches.set(codeCache, {
            requêtes,
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
        }
      } finally {
        this.verrou.release(codeCache);
      }
    }

    const oublierRequête = async () => {
      await this.oublierRecherche({ codeCache, idRequête });
    };

    return {
      oublier: oublierRequête,
      [nomArgTaille]: fChangerTailleRequête,
    } as RetourRecherche<N>;
  }

  async oublierSuivi({
    codeCache,
    idRequête,
  }: {
    codeCache: string;
    idRequête: string;
  }) {
    const { requêtes, oublier } = this.suivis.get(codeCache)!;
    const { promesses } = requêtes.get(idRequête) || {};
    requêtes.delete(idRequête);
    if (promesses) await Promise.allSettled(promesses)

    if (!requêtes.size) {
      try {
        await this.verrou.acquire(codeCache);
        if (!requêtes.size) {
          await oublier?.();
          this.suivis.delete(codeCache);
        }
      } finally {
        this.verrou.release(codeCache);
      }
    }
  }

  async oublierRecherche({
    codeCache,
    idRequête,
  }: {
    codeCache: string;
    idRequête: string;
  }) {
    const { requêtes, fs } = this.recherches.get(codeCache)!;
    const { promesses } = requêtes.get(idRequête) || {};
    requêtes.delete(idRequête);
    if (promesses) await Promise.allSettled(promesses)
    
    if (!requêtes.size) {
      try {
        await this.verrou.acquire(codeCache);
        if (!requêtes.size) {
          await fs?.oublier();
          this.recherches.delete(codeCache);
        }
      } finally {
        this.verrou.release(codeCache);
      }
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
      return texte
    return base64.fromString(sha256(texte), true);
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

export type RésultatProfondeur<T> = { val: T; profondeur: number };

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
    nomArgTaille: "profondeur",
  });
};

const map = new WeakMap();

const idUnique = (objet: WeakKey) => {
  if (!map.has(objet)) {
    map.set(objet, uuidv4());
  }

  return map.get(objet);
};

export const envelopper = <T>({
  nom,
  descripteur,
  recherche,
  nomArgTaille = "n",
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
            nomArgTaille,
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
