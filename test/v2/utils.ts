import path from "path";
import { isBrowser } from "wherearewe";
import { dossierTempo } from "@constl/utils-tests";

import { TypedEmitter } from "tiny-typed-emitter";
import { isNull } from "lodash-es";
import { useFakeTimers } from "sinon";
import {
  isValidAddress,
  type BaseDatabase,
  type KeyValueDatabase,
} from "@orbitdb/core";
import { créerConstellation } from "@/v2/index.js";
import { estContrôleurNébuleuse } from "@/v2/nébuleuse/services/compte/accès/contrôleurNébuleuse.js";
import { attendreQue } from "./appli/utils/fonctions.js";
import { connecterNébuleuses } from "./nébuleuse/utils.js";
import { obtenirOptionsLibp2pTest } from "./nébuleuse/services/utils.js";
import type { InfoRésultat, RésultatRecherche } from "@/v2/recherche/types.js";
import type { Constellation } from "@/v2/index.js";
import type { Constellation as ConstructeurConstellation } from "@/v2/constellation.js";
import type { Oublier, RetourRecherche, Suivi } from "@/v2/nébuleuse/types.js";
import type { OrderedKeyValueDatabaseType } from "@orbitdb/ordered-keyvalue-db";
import type { FeedDatabaseType } from "@orbitdb/feed-db";
import type { SetDatabaseType } from "@orbitdb/set-db";

export const journalifier = <T extends (...args: unknown[]) => unknown>(
  f: T,
  étiquette?: string,
): T => {
  return ((...args) => {
    console.log(étiquette || "", args);
    return f(...args);
  }) as T;
};

export const attendreInvité = async (
  bd: BaseDatabase,
  idInvité: string,
): Promise<void> => {
  const accès = bd.access;
  if (!estContrôleurNébuleuse(accès))
    throw new Error(`Contrôleur d'accès non supporté : ${accès.type}`);

  const estInvité = async () => {
    return isValidAddress(idInvité)
      ? !!accès.accès.utilisateurs.find((u) => u.idCompte === idInvité)
      : !!accès.accès.dispositifs.find((d) => d.idDispositif === idInvité);
  };
  return await attendreQue(estInvité);
};

export const peutÉcrire = async (
  bd:
    | KeyValueDatabase
    | SetDatabaseType
    | FeedDatabaseType
    | OrderedKeyValueDatabaseType,
): Promise<boolean> => {
  try {
    if (bd.type === "keyvalue" || bd.type === "ordered-keyvalue") {
      // Important d'avoir une clef unique pour éviter l'interférence entre les tests
      const CLEF = "test" + Math.random().toString();
      const VAL = 123;

      await bd.set(CLEF, VAL);
      const val = await bd.get(CLEF);

      await bd.del(CLEF);
      return val === VAL;
    } else if (bd.type === "feed") {
      const VAL = "test";

      await bd.add(VAL);
      const éléments = await bd.all();

      const autorisé = éléments.length === 1 && éléments[0].value === VAL;
      if (éléments.length === 1) {
        await bd.remove(éléments[0].hash);
      }
      return autorisé;
    } else if (bd.type === "set") {
      const VAL = "test";

      await bd.add(VAL);
      const éléments = await bd.all();

      const autorisé = éléments.size === 1 && éléments.has(VAL);
      await bd.del(VAL);

      return autorisé;
    } else {
      // @ts-expect-error bd.type n'a plus d'options
      throw new Error(`Type de BD ${bd.type} non supporté par ce test.`);
    }
  } catch (e) {
    if (e.toString().includes("is not allowed to write to the log")) {
      return false;
    }
    throw e;
  }
};

export const dossierTempoPropre = () => {
  if (isBrowser) window.localStorage.clear();
  return dossierTempo();
};

export const obtenir = async <T>(
  f: (args: {
    si: (
      f: (x: T | undefined) => boolean | Promise<boolean>,
    ) => (x: T | undefined) => void;
    siDéfini: () => (x: T | undefined) => void;
    siNonDéfini: () => (x: T | undefined) => void;
    siVide: () => (x: T) => void;
    siNul: () => (x: T) => void;
    siPasVide: () => (x: T | undefined) => void;
    siPasNul: () => (x: T) => void;
    tous: () => (x: T) => void;
  }) => Promise<Oublier>,
): Promise<T> => {
  const événements = new TypedEmitter<{ résolu: (x: T) => void }>();
  const si = (
    fTest: (x: T | undefined) => boolean | Promise<boolean>,
  ): ((x: T | undefined) => void) => {
    return async (x: T | undefined) => {
      const passe = await fTest(x);
      if (passe) {
        événements.emit("résolu", x as T);
      }
    };
  };

  const siDéfini = (): ((x: T | undefined) => void) => {
    return si((x: T | undefined): x is T => x !== undefined);
  };

  const siNonDéfini = (): ((x: T | undefined) => void) => {
    return si((x: T | undefined) => x === undefined);
  };

  const siVide = (): ((x: T) => void) => {
    return si((x) => {
      if (Array.isArray(x)) return x.length === 0;
      else if (typeof x === "object" && !isNull(x))
        return Object.keys(x).length === 0;
      else return false;
    });
  };
  const siNul = (): ((x: T) => void) => {
    return si((x: T | undefined) => isNull(x));
  };
  const siPasVide = (): ((x: T | undefined) => void) => {
    return si((x) => {
      if (Array.isArray(x)) return x.length > 0;
      else if (typeof x === "object" && !isNull(x))
        return Object.keys(x).length > 0;
      else return false;
    });
  };
  const siPasNul = (): ((x: T) => void) => {
    return si((x: T | undefined) => !isNull(x));
  };
  const tous = (): ((x: T) => void) => {
    return si(() => true);
  };

  let fOublier: Oublier | undefined = undefined;

  const promesse = new Promise<T>((résoudre) =>
    événements.once("résolu", async (x) => {
      if (fOublier) {
        await fOublier();
        fOublier = undefined;
      }
      résoudre(x);
    }),
  );
  fOublier = await f({
    si,
    siDéfini,
    siNonDéfini,
    siVide,
    siNul,
    siPasVide,
    siPasNul,
    tous,
  });
  afterEach(async () => {
    if (fOublier) await fOublier();
    fOublier = undefined;
  });

  return promesse;
};

export type ObtRecherche<T extends InfoRésultat = InfoRésultat> = {
  si(
    f: (x?: RésultatRecherche<T>[]) => boolean | Promise<boolean>,
  ): Promise<RésultatRecherche<T>[]>;
  siDéfini: () => Promise<RésultatRecherche<T>[]>;
  siNonDéfini: () => Promise<RésultatRecherche<T>[]>;
  siVide: () => Promise<RésultatRecherche<T>[]>;
  siNul: () => Promise<RésultatRecherche<T>[]>;
  siPasVide: () => Promise<RésultatRecherche<T>[]>;
  siPasNul: () => Promise<RésultatRecherche<T>[]>;
  siAuMoins: (n: number) => Promise<RésultatRecherche<T>[]>;
  siPasPlusQue: (n: number) => Promise<RésultatRecherche<T>[]>;
  tous: () => Promise<RésultatRecherche<T>[]>;

  n: (n: number) => Promise<void>;
};

export const rechercher = async <T extends InfoRésultat = InfoRésultat>(
  f: (args: { f: Suivi<RésultatRecherche<T>[]> }) => Promise<RetourRecherche>,
): Promise<ObtRecherche<T>> => {
  const événements = new TypedEmitter<{
    trouvé: (x: RésultatRecherche<T>[]) => void;
  }>();

  const si = (
    fTest: (
      x: RésultatRecherche<T>[] | undefined,
    ) => boolean | Promise<boolean>,
  ): Promise<RésultatRecherche<T>[]> => {
    return new Promise<RésultatRecherche<T>[]>((résoudre) => {
      const fTrouvé = async (x: RésultatRecherche<T>[]) => {
        if (await fTest(x)) {
          événements.off("trouvé", fTrouvé);
          résoudre(x);
        }
      };
      événements.on("trouvé", fTrouvé);
    });
  };

  const siDéfini = (): Promise<RésultatRecherche<T>[]> => {
    return si((x): x is RésultatRecherche<T>[] => x !== undefined);
  };

  const siNonDéfini = (): Promise<RésultatRecherche<T>[]> => {
    return si((x) => x === undefined);
  };

  const siVide = (): Promise<RésultatRecherche<T>[]> => {
    return si((x) => {
      if (Array.isArray(x)) return x.length === 0;
      else if (typeof x === "object" && !isNull(x))
        return Object.keys(x).length === 0;
      else return false;
    });
  };

  const siNul = (): Promise<RésultatRecherche<T>[]> => {
    return si((x) => isNull(x));
  };

  const siPasVide = (): Promise<RésultatRecherche<T>[]> => {
    return si((x) => {
      if (Array.isArray(x)) return x.length > 0;
      else if (typeof x === "object" && !isNull(x))
        return Object.keys(x).length > 0;
      else return false;
    });
  };

  const siPasNul = (): Promise<RésultatRecherche<T>[]> => {
    return si((x) => !isNull(x));
  };

  const siAuMoins = (n: number): Promise<RésultatRecherche<T>[]> => {
    return si((x) => !!x && x.length >= n);
  };

  const siPasPlusQue = (n: number): Promise<RésultatRecherche<T>[]> => {
    return si((x) => !!x && x.length <= n);
  };

  const tous = (): Promise<RésultatRecherche<T>[]> => {
    return si(() => true);
  };

  const { oublier, n: changerN } = await f({
    f: (x) => {
      événements.emit("trouvé", x);
    },
  });
  after(async () => await oublier());

  return {
    si,
    siDéfini,
    siNonDéfini,
    siVide,
    siNul,
    siPasVide,
    siPasNul,
    tous,
    siAuMoins,
    siPasPlusQue,
    n: changerN,
  };
};

type CréerConstellationsTest = {
  (args: { n: number; avecMandataire: false }): Promise<{
    constls: ConstructeurConstellation[];
    fermer: Oublier;
  }>;
  (args: { n: number; avecMandataire?: true }): Promise<{
    constls: Constellation[];
    fermer: Oublier;
  }>;
  (args: { n: number; avecMandataire?: boolean }): Promise<{
    constls: (Constellation | ConstructeurConstellation)[];
    fermer: Oublier;
  }>;
};

export const créerConstellationsTest: CréerConstellationsTest = async ({
  n,
  avecMandataire = true,
}) => {
  const { dossier, effacer } = await dossierTempoPropre();

  const constls: Constellation[] = [];

  for (const i in [...Array(n).entries()]) {
    const constl = créerConstellation(
      {
        services: {
          dossier: { dossier: path.join(dossier, i) },
          libp2p: {
            libp2p: obtenirOptionsLibp2pTest(),
          },
        },
      },
      avecMandataire,
    );
    if (!avecMandataire) await constl.démarrer();
    constls.push(constl);
  }

  await connecterNébuleuses(constls);

  const fermer = async () => {
    await Promise.allSettled(constls.map((c) => c.fermer()));
    effacer?.();
  };

  return {
    constls,
    fermer,
  };
};

export const utiliserFauxChronomètres = () => {
  const horloge = useFakeTimers({
    shouldAdvanceTime: true,
    now: new Date(),
    shouldClearNativeTimers: true,
  });
  after(() => horloge.reset());
  return horloge;
};
