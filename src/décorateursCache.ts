import Semaphore from "@chriscdn/promise-semaphore";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

import { réponseSuivreRecherche, itemRechercheProfondeur } from "@/reseau.js";
import {
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaRetourFonctionRecherche,
} from "@/utils/index.js";

export class CacheSuivi {
  verrou: Semaphore;
  _cacheSuivi: {
    [clef: string]: {
      val?: unknown;
      requètes: { [clef: string]: schémaFonctionSuivi<unknown> };
      fOublier?: schémaFonctionOublier;
    };
  };
  _cacheRecherche: {
    [clef: string]: {
      val?: unknown[];
      taillePrésente: number;
      requètes: {
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

  async suivre<T extends Function, U>({
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

    const codeCache = this.générerCodeCache({
      adresseFonction,
      idClient,
      argsClefs: argsSansF,
    });
    const idRequète = uuidv4();

    await this.verrou.acquire(codeCache);

    // Vérifier si déjà en cache
    if (!this._cacheSuivi[codeCache]) {
      // Si pas en cache, générer
      this._cacheSuivi[codeCache] = {
        requètes: { [idRequète]: f },
      };
      const fFinale = (x: unknown) => {
        if (!this._cacheSuivi[codeCache]) return; // Si on a déjà annulé la requète
        this._cacheSuivi[codeCache].val = x;
        const fsSuivis = Object.values(this._cacheSuivi[codeCache].requètes);
        fsSuivis.forEach((f_) => f_(x));
      };
      const argsAvecF = { ...argsSansF, [nomArgFonction]: fFinale };

      const fOublier = await fOriginale.apply(ceciOriginal, [argsAvecF]);
      this._cacheSuivi[codeCache].fOublier = fOublier;
    } else {
      // Sinon, ajouter f à la liste de fonctions de rappel
      this._cacheSuivi[codeCache].requètes[idRequète] = f;
      if (Object.keys(this._cacheSuivi[codeCache]).includes("val"))
        f(this._cacheSuivi[codeCache].val);
    }

    const fOublierRequète = async () => {
      await this.oublierSuivi({ codeCache, idRequète });
    };
    this.verrou.release(codeCache);

    return fOublierRequète;
  }

  async suivreRecherche<T extends Function, U>({
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
    par: "profondeur" | "nRésultats";
  }): Promise<schémaRetourFonctionRecherche | réponseSuivreRecherche> {
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
    const argsSansFOuTaille = Object.fromEntries(
      Object.entries(args).filter((x) => x[0] !== nomArgTaille)
    );

    const taille = args[nomArgTaille];
    if (taille === undefined)
      throw `Aucun argument de nom ${nomArgTaille} n'a été passé à la fonction ${adresseFonction}.`;
    if (typeof taille !== "number")
      throw `Argument ${nomArgTaille} n'est pas un nombre dans la fonction ${adresseFonction}.`;

    const codeCache = this.générerCodeCache({
      adresseFonction,
      idClient,
      argsClefs: argsSansFOuTaille,
    });
    const idRequète = uuidv4();

    await this.verrou.acquire(codeCache);

    const fFinale = (val: unknown[]) => {
      this._cacheRecherche[codeCache].val = val;
      const infoRequètes = Object.values(
        this._cacheRecherche[codeCache].requètes
      );
      if (par === "profondeur") {
        infoRequètes.forEach((info) =>
          info.f(
            (val as itemRechercheProfondeur[]).filter(
              (x) => x.profondeur <= info.taille
            )
          )
        );
      } else {
        infoRequètes.forEach((info) => info.f(val.slice(0, info.taille)));
      }
    };

    // Vérifier si déjà en cache
    if (!this._cacheRecherche[codeCache]) {
      // Si pas en cache, générer
      this._cacheRecherche[codeCache] = {
        requètes: { [idRequète]: { f, taille } },
        taillePrésente: taille,
      };

      const argsComplets = {
        ...argsSansFOuTaille,
        [nomArgFonction]: fFinale,
        [nomArgTaille]: taille,
      };

      if (par === "profondeur") {
        const { fOublier, fChangerProfondeur } = await fOriginale.apply(
          ceciOriginal,
          [argsComplets]
        );
        this._cacheRecherche[codeCache].fs = {
          fOublier,
          fChangerTaille: fChangerProfondeur,
        };
      } else {
        const { fOublier, fChangerN } = await fOriginale.apply(ceciOriginal, [
          argsComplets,
        ]);
        this._cacheRecherche[codeCache].fs = {
          fOublier,
          fChangerTaille: fChangerN,
        };
      }
    } else {
      // Sinon, ajouter f à la liste de fonctions de rappel
      this._cacheRecherche[codeCache].requètes[idRequète] = { f, taille };
      if (Object.keys(this._cacheRecherche[codeCache]).includes("val")) {
        fFinale(this._cacheRecherche[codeCache].val);
      }
    }

    const fOublierRequète = async () => {
      await this.oublierRecherche({ codeCache, idRequète });
    };

    const fChangerTailleRequète = (taille: number) => {
      const tailleAvant =
        this._cacheRecherche[codeCache].requètes[idRequète].taille;
      if (taille === tailleAvant) return;
      this._cacheRecherche[codeCache].requètes[idRequète].taille = taille;

      fFinale(this._cacheRecherche[codeCache].val);

      const maxTaille = Math.max(
        ...Object.values(this._cacheRecherche[codeCache].requètes).map(
          (r) => r.taille
        )
      );
      const { taillePrésente } = this._cacheRecherche[codeCache];
      const { fChangerTaille } = this._cacheRecherche[codeCache].fs;
      if (maxTaille !== taillePrésente) {
        fChangerTaille(taillePrésente);
      }
    };
    this.verrou.release(codeCache);

    if (par === "profondeur") {
      return {
        fOublier: fOublierRequète,
        fChangerProfondeur: fChangerTailleRequète,
      };
    } else {
      return {
        fOublier: fOublierRequète,
        fChangerN: fChangerTailleRequète,
      };
    }
  }

  async oublierSuivi({
    codeCache,
    idRequète,
  }: {
    codeCache: string;
    idRequète: string;
  }) {
    await this.verrou.acquire(codeCache);
    if (this._cacheSuivi[codeCache] === undefined) return;
    const { requètes, fOublier } = this._cacheSuivi[codeCache];
    delete requètes[idRequète];

    if (!Object.keys(requètes).length) {
      fOublier();
      delete this._cacheSuivi[codeCache];
    }
    this.verrou.release(codeCache);
  }

  async oublierRecherche({
    codeCache,
    idRequète,
  }: {
    codeCache: string;
    idRequète: string;
  }) {
    await this.verrou.acquire(codeCache);
    if (this._cacheRecherche[codeCache] === undefined) return;
    const { requètes, fs } = this._cacheRecherche[codeCache];
    delete requètes[idRequète];

    if (!Object.keys(requètes).length) {
      fs.fOublier();
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
    return crypto.createHash("md5").update(texte).digest("hex");
  }
}

export const cacheSuivi = (_cible: any, nom: any, descripteur: any) => {
  return envelopper({ nom, descripteur });
};

export const cacheRechercheParNRésultats = (
  _cible: any,
  nom: any,
  descripteur: any
) => {
  return envelopper({ nom, descripteur, recherche: "nRésultats" });
};

export const cacheRechercheParProfondeur = (
  _cible: any,
  nom: any,
  descripteur: any
) => {
  return envelopper({ nom, descripteur, recherche: "profondeur" });
};

export const envelopper = ({
  nom,
  descripteur,
  recherche,
  nomArgTaille,
}: {
  nom: any;
  descripteur: any;
  recherche?: "profondeur" | "nRésultats";
  nomArgTaille?: string;
}) => {
  const original = descripteur.value;

  if (typeof original === "function") {
    descripteur.value = function (...args: any[]) {
      if (args.length > 1) throw "Args trop longs";

      try {
        if (recherche) {
          nomArgTaille = nomArgTaille
            ? nomArgTaille
            : recherche === "profondeur"
            ? "profondeur"
            : "nRésultatsDésirés";
          return cache.suivreRecherche({
            adresseFonction: this.constructor.name + "." + nom,
            idClient: this.client.idBdCompte,
            fOriginale: original,
            args: args[0],
            ceciOriginal: this,
            par: recherche,
            nomArgTaille,
          });
        } else {
          return cache.suivre({
            adresseFonction: this.constructor.name + "." + nom,
            idClient: this.client.idBdCompte,
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
    throw "L'objet décoré n'est pas une fonction";
  }
  return descripteur;
};

export const cache = new CacheSuivi();
