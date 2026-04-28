import { Semaphore } from "@chriscdn/promise-semaphore";
import { v4 as uuidv4 } from "uuid";
import { isValidAddress, type BaseDatabase, type OrbitDB } from "@orbitdb/core";
import { estErreurAvortée, pSignal } from "../../utils.js";
import type { ServiceMap } from "@libp2p/interface";

// Un mandataire pour orbite qui évite les conditions de concurrence pour `open`

// Ceci doit être commun pour que les contrôleurs d'accès puissent aussi envelopper leurs instance d'OrbitDB
const verrous = new Map<string, Semaphore>();
const requêtes = new Map<string, Map<string, Set<string>>>();
const cacheBds = new Map<string, Map<string, BaseDatabase>>();

export const ORBITE_ORIGINALE = Symbol("orbite originale");

type MandataireOrbite<L extends ServiceMap = ServiceMap> = OrbitDB<L> & { [ORBITE_ORIGINALE]: OrbitDB<L> };

export const estOrbiteMandatairifié = <L extends ServiceMap = ServiceMap>(
  x: OrbitDB<L> | MandataireOrbite<L>,
): x is MandataireOrbite<L> => {
  return !!(x as MandataireOrbite<L>)[ORBITE_ORIGINALE];
};

export const mandatOrbite = <L extends ServiceMap = ServiceMap>(
  orbite: OrbitDB<L>,
  lorsquErreur?: (e: Error) => void,
) => {
  lorsquErreur ??= (erreur) => {
    if(!estErreurAvortée(erreur)) console.log("Erreur OrbitDB", erreur)
  }

  if (!verrous.has(orbite.identity.id))
    verrous.set(orbite.identity.id, new Semaphore());
  const verrouOrbite = verrous.get(orbite.identity.id)!;

  if (!requêtes.has(orbite.identity.id))
    requêtes.set(orbite.identity.id, new Map());
  const requêtesOrbite = requêtes.get(orbite.identity.id)!;

  if (!cacheBds.has(orbite.identity.id))
    cacheBds.set(orbite.identity.id, new Map());
  const cacheBdsOrbite = cacheBds.get(orbite.identity.id)!;

  return new Proxy(orbite, {
    get(target, prop) {
      if (prop === ORBITE_ORIGINALE) return target;

      if (prop === "open") {
        const ouvrirAvecVerrou: OrbitDB["open"] = async (...args) => {
          const nomOuAdresse = args[0];
          const parAdresse = isValidAddress(nomOuAdresse);

          const signal = args[1]?.signal;

          const promesseVerrou = verrouOrbite.acquire(nomOuAdresse);

          try {
            if (signal) await Promise.race([promesseVerrou, pSignal(signal)]);
            else await promesseVerrou;

            if (signal?.aborted) throw new Error("Opération avortée");
            const existante = cacheBdsOrbite.get(nomOuAdresse);

            const bd =
              (parAdresse && existante) || (await target.open(...args));
            const adresse = bd.address;

            if (!parAdresse && existante)
              throw new Error(
                "Ouvrir les bds existantes selon leur adresse et non leur nom.",
              );
            if (!existante) cacheBdsOrbite.set(adresse, bd);

            if (!requêtesOrbite.has(adresse))
              requêtesOrbite.set(adresse, new Set());

            if (!existante && lorsquErreur) {
              bd.events.on("error", lorsquErreur);
            }
            const résultat = mandatBd(
              bd,
              requêtesOrbite.get(adresse)!,
              cacheBdsOrbite,
              verrouOrbite,
            );

            return résultat;
          } finally {
            // S'assurer que le verrou sera bien relâché (en cas de signal avorté) lorsqu'il aura été
            // enfin acquis. **Ne pas utiliser `await` parce que ça pourrait empêcher la fonction
            // de compléter si un autre appel à l'ouverture de la bd est toujours en cours en parallel.**
            promesseVerrou.then(() => verrouOrbite.release(nomOuAdresse));
          }
        };
        return ouvrirAvecVerrou;
      } else {
        return target[prop as keyof OrbitDB];
      }
    },
  });
};

export const BD_ORIGINALE = Symbol("bd originale");

type MandataireBd = BaseDatabase & { [BD_ORIGINALE]: BaseDatabase };

export const estMandatairifié = (
  x: BaseDatabase | MandataireBd,
): x is MandataireBd => {
  return !!(x as MandataireBd)[BD_ORIGINALE];
};

// Ce mandataire-ci s'assure que la base de données n'est fermée que lorsque la dernière copie est fermée
const mandatBd = (
  bd: BaseDatabase,
  requêtes: Set<string>,
  cache: Map<string, BaseDatabase>,
  verrou: Semaphore,
) => {
  const id = uuidv4();
  requêtes.add(id);

  return new Proxy(bd, {
    get(target, prop) {
      if (prop === BD_ORIGINALE) return target;

      if (prop === "close") {
        const fermer: BaseDatabase["close"] = async () => {
          await verrou.acquire(bd.address);

          try {
            requêtes.delete(id);

            if (!requêtes.size) {
              // On met ça avant au cas où on aurait une erreur dans `target.close()`
              cache.delete(target.address);
              await target.close();
            }
          } finally {
            verrou.release(bd.address);
          }
        };
        return fermer;
      } else if (prop === "drop") {
        const effacer: BaseDatabase["drop"] = async () => {
          requêtes.clear();
          cache.delete(target.address);

          return await target.drop();
        };
        return effacer;
      } else {
        return target[prop as keyof BaseDatabase];
      }
    },
  });
};
