import Semaphore from "@chriscdn/promise-semaphore";
import Base64 from "crypto-js/enc-base64.js";
import md5 from "crypto-js/md5.js";
import { v4 as uuidv4 } from "uuid";

import deepEqual from "deep-equal";
import type { itemRechercheProfondeur } from "@/reseau.js";
import type {
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaRetourFonctionRechercheParN,
  schémaRetourFonctionRechercheParProfondeur,
} from "@/types.js";

export class CacheSuivi {
  verrou: Semaphore;
  _cacheSuivi: {
    [clef: string]: {
      val?: unknown;
      requêtes: { [clef: string]: schémaFonctionSuivi<unknown> };
      fOublier?: schémaFonctionOublier;
    };
  };
  _cacheRecherche: {
    [clef: string]: {
      val?: unknown[];
      taillePrésente: number;
      requêtes: {
        [clef: string]: { f: schémaFonctionSuivi<unknown>; taille: number };
      };
      fs?: {
        fChangerTaille: (n: number) => void;
        fOublier: schémaFonctionOublier;
      };
    };
  };

  constructor() {
    this.verrou = new Semaphore();
    this._cacheSuivi = {};
    this._cacheRecherche = {};
  }

  async suivre<
    T extends (args: {
      [key: string]: unknown;
    }) => Promise<schémaFonctionOublier>,
    U,
  >({
    adresseFonction,
    idClient,
    fOriginale,
    args,
    ceciOriginal,
  }: {
    adresseFonction: string;
    idClient: string;
    fOriginale: T;
    args: { [clef: string]: unknown };
    ceciOriginal: U;
  }): Promise<schémaFonctionOublier> {
    // Extraire la fonction de suivi
    const nomArgFonction = Object.entries(args).find(
      (x) => typeof x[1] === "function",
    )?.[0];
    if (!nomArgFonction) throw new Error(`Aucun argument n'est une fonction.`);
    const f = args[nomArgFonction] as schémaFonctionSuivi<unknown>;
    const argsSansF = Object.fromEntries(
      Object.entries(args).filter((x) => typeof x[1] !== "function"),
    );
    if (Object.keys(args).length !== Object.keys(argsSansF).length + 1) {
      throw new Error(
        "Plus d'un argument pour " +
          adresseFonction +
          " est une fonction : " +
          JSON.stringify(args),
      );
    }

    const codeCache = this.générerCodeCache({
      adresseFonction,
      idClient,
      argsClefs: argsSansF,
    });
    const idRequête = uuidv4();

    await this.verrou.acquire(codeCache);

    // Vérifier si déjà en cache
    if (!this._cacheSuivi[codeCache]) {
      // Si pas en cache, générer
      this._cacheSuivi[codeCache] = {
        requêtes: { [idRequête]: f },
      };
      const fFinale = async (x: unknown) => {
        if (!this._cacheSuivi[codeCache]) return; // Si on a déjà annulé la requête
        if (
          Object.keys(this._cacheSuivi[codeCache]).includes("val") &&
          deepEqual(this._cacheSuivi[codeCache].val, x, { strict: true })
        )
          return; // Ignorer si c'est la même valeur qu'avant
        this._cacheSuivi[codeCache].val = x;
        const fsSuivis = Object.values(this._cacheSuivi[codeCache].requêtes);
        await Promise.all(fsSuivis.map((f_) => f_(x)));
      };
      const argsAvecF = { ...argsSansF, [nomArgFonction]: fFinale };

      const fOublier = await fOriginale.apply(ceciOriginal, [argsAvecF]);
      this._cacheSuivi[codeCache].fOublier = fOublier;
      this.verrou.release(codeCache);
    } else {
      this.verrou.release(codeCache);

      // Sinon, ajouter f à la liste de fonctions de rappel
      this._cacheSuivi[codeCache].requêtes[idRequête] = f;
      if (Object.keys(this._cacheSuivi[codeCache]).includes("val"))
        await f(this._cacheSuivi[codeCache].val);
    }

    const fOublierRequête = async () => {
      await this.oublierSuivi({ codeCache, idRequête });
    };

    return fOublierRequête;
  }

  async suivreRecherche<
    T extends (...args: unknown[]) => Promise<V>,
    U,
    W extends "profondeur" | "nRésultats",
    V extends W extends "profondeur"
      ? schémaRetourFonctionRechercheParProfondeur
      : schémaRetourFonctionRechercheParN,
  >({
    adresseFonction,
    nomArgTaille,
    idClient,
    fOriginale,
    args,
    ceciOriginal,
    par,
  }: {
    adresseFonction: string;
    nomArgTaille: string;
    idClient: string;
    fOriginale: T;
    args: { [clef: string]: unknown };
    ceciOriginal: U;
    par: W;
  }): Promise<V> {
    // Extraire la fonction de suivi
    const nomArgFonction = Object.entries(args).find(
      (x) => typeof x[1] === "function",
    )?.[0];
    if (!nomArgFonction) throw new Error(`Aucun argument n'est une fonction.`);
    const f = args[nomArgFonction] as schémaFonctionSuivi<unknown>;
    const argsSansF = Object.fromEntries(
      Object.entries(args).filter((x) => typeof x[1] !== "function"),
    );
    if (Object.keys(args).length !== Object.keys(argsSansF).length + 1) {
      throw new Error(
        "Plus d'un argument pour " +
          adresseFonction +
          " est une fonction : " +
          JSON.stringify(args),
      );
    }
    const argsSansFOuTaille = Object.fromEntries(
      Object.entries(args).filter((x) => x[0] !== nomArgTaille),
    );

    let taille = args[nomArgTaille];
    if (taille === undefined) taille = Infinity;
    if (typeof taille !== "number")
      throw new Error(
        `Argument ${nomArgTaille} n'est pas un nombre dans la fonction ${adresseFonction}.`,
      );

    const codeCache = this.générerCodeCache({
      adresseFonction,
      idClient,
      argsClefs: argsSansFOuTaille,
    });
    const idRequête = uuidv4();

    await this.verrou.acquire(codeCache);

    const fFinale = (val: unknown[]) => {
      if (!this._cacheRecherche[codeCache]) return; // Si on a déjà annulé la requête
      this._cacheRecherche[codeCache].val = val;
      const infoRequêtes = Object.values(
        this._cacheRecherche[codeCache].requêtes,
      );
      if (par === "profondeur") {
        infoRequêtes.forEach((info) =>
          info.f(
            (val as itemRechercheProfondeur[]).filter(
              (x) => x.profondeur <= info.taille,
            ),
          ),
        );
      } else {
        infoRequêtes.forEach((info) => info.f(val.slice(0, info.taille)));
      }
    };

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

      if (par === "profondeur") {
        const { fOublier, fChangerProfondeur } = (await fOriginale.apply(
          ceciOriginal,
          [argsComplets],
        )) as schémaRetourFonctionRechercheParProfondeur;
        this._cacheRecherche[codeCache].fs = {
          fOublier,
          fChangerTaille: fChangerProfondeur,
        };
      } else {
        const { fOublier, fChangerN } = (await fOriginale.apply(ceciOriginal, [
          argsComplets,
        ])) as schémaRetourFonctionRechercheParN;
        this._cacheRecherche[codeCache].fs = {
          fOublier,
          fChangerTaille: fChangerN,
        };
      }
    } else {
      // Sinon, ajouter f à la liste de fonctions de rappel
      this._cacheRecherche[codeCache].requêtes[idRequête] = { f, taille };
      if (Object.keys(this._cacheRecherche[codeCache]).includes("val")) {
        const { val } = this._cacheRecherche[codeCache];
        if (val) fFinale(val);
      }
    }

    const fOublierRequête = async () => {
      await this.oublierRecherche({ codeCache, idRequête });
    };

    const fChangerTailleRequête = (taille: number) => {
      const tailleAvant =
        this._cacheRecherche[codeCache].requêtes[idRequête].taille;
      if (taille === tailleAvant) return;
      this._cacheRecherche[codeCache].requêtes[idRequête].taille = taille;
      const { val } = this._cacheRecherche[codeCache];
      if (val) fFinale(val);

      const maxTaille = Math.max(
        ...Object.values(this._cacheRecherche[codeCache].requêtes).map(
          (r) => r.taille,
        ),
      );
      const { taillePrésente } = this._cacheRecherche[codeCache];
      const { fChangerTaille } = this._cacheRecherche[codeCache].fs!;

      if (maxTaille !== taillePrésente) {
        this._cacheRecherche[codeCache].taillePrésente = maxTaille;
        fChangerTaille(maxTaille);
      }
    };
    this.verrou.release(codeCache);

    return {
      fOublier: fOublierRequête,
      [par === "profondeur" ? "fChangerProfondeur" : "fChangerN"]:
        fChangerTailleRequête,
    } as V;
  }

  async oublierSuivi({
    codeCache,
    idRequête,
  }: {
    codeCache: string;
    idRequête: string;
  }) {
    await this.verrou.acquire(codeCache);
    if (this._cacheSuivi[codeCache] === undefined) return;
    const { requêtes, fOublier } = this._cacheSuivi[codeCache];
    delete requêtes[idRequête];

    if (!Object.keys(requêtes).length) {
      await fOublier?.();
      delete this._cacheSuivi[codeCache];
    }
    this.verrou.release(codeCache);
  }

  async oublierRecherche({
    codeCache,
    idRequête,
  }: {
    codeCache: string;
    idRequête: string;
  }) {
    await this.verrou.acquire(codeCache);
    if (this._cacheRecherche[codeCache] === undefined) return;
    const { requêtes, fs } = this._cacheRecherche[codeCache];
    delete requêtes[idRequête];

    if (!Object.keys(requêtes).length) {
      await fs?.fOublier();
      delete this._cacheRecherche[codeCache];
    }
    this.verrou.release(codeCache);
  }

  générerCodeCache({
    adresseFonction,
    idClient,
    argsClefs,
  }: {
    adresseFonction: string;
    idClient: string;
    argsClefs: { [clef: string]: unknown };
  }): string {
    const texte =
      adresseFonction + "-" + idClient + "-" + JSON.stringify(argsClefs);
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

export const cacheRechercheParNRésultats = (
  _cible: unknown,
  nom: string,
  descripteur: unknown,
) => {
  return envelopper({ nom, descripteur, recherche: "nRésultats" });
};

export const cacheRechercheParProfondeur = (
  _cible: unknown,
  nom: string,
  descripteur: unknown,
) => {
  return envelopper({ nom, descripteur, recherche: "profondeur" });
};

export const envelopper = ({
  nom,
  descripteur,
  recherche,
  nomArgTaille,
}: {
  nom: string;
  descripteur: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  recherche?: "profondeur" | "nRésultats";
  nomArgTaille?: string;
}) => {
  const original = descripteur.value;

  if (typeof original === "function") {
    descripteur.value = function (...args: [{ [clef: string]: unknown }]) {
      if (args.length > 1) throw new Error("Args trop longs");

      const client = this.client ? this.client : this;

      try {
        if (recherche) {
          nomArgTaille = nomArgTaille
            ? nomArgTaille
            : recherche === "profondeur"
              ? "profondeur"
              : "nRésultatsDésirés";
          return cache.suivreRecherche({
            adresseFonction: this.constructor.name + "." + nom,
            idClient: client.idCompte,
            fOriginale: original,
            args: args[0],
            ceciOriginal: this,
            par: recherche,
            nomArgTaille,
          });
        } else {
          return cache.suivre({
            adresseFonction: this.constructor.name + "." + nom,
            idClient: client.idCompte,
            fOriginale: original,
            args: args[0],
            ceciOriginal: this,
          });
        }
      } catch (e) {
        console.error(`Erreur: ${e}`);
        throw e;
      }
    };
  } else {
    throw new Error("L'objet décoré n'est pas une fonction");
  }
  return descripteur;
};

export const cache = new CacheSuivi();
