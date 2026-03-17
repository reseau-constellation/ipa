import { Semaphore } from "@chriscdn/promise-semaphore";
import { v4 as uuidv4 } from "uuid";
import { isValidAddress, type BaseDatabase, type OrbitDB } from "@orbitdb/core";
import { pSignal } from "../../utils.js";
import type { ServiceMap } from "@libp2p/interface";

// Un mandataire pour orbite qui évite les conditions de concurrence pour `open`

// Ceci doit être commun pour que les contrôleurs d'accès puissent aussi envelopper leurs instance d'OrbitDB
const verrous = new Map<string, Semaphore>();
const requêtes = new Map<string, Map<string, Set<string>>>();
const cacheBds = new Map<string, Map<string, BaseDatabase>>();

export const ORIGINALE = Symbol("orbite originale");

export const mandatOrbite = <L extends ServiceMap = ServiceMap>(
  orbite: OrbitDB<L>,
) => {
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
      if (prop === "open") {
        const ouvrirAvecVerrou: OrbitDB["open"] = async (...args) => {
          const nomOuAdresse = args[0];

          const signal = args[1]?.signal;

          if (signal)
            await Promise.race([
              verrouOrbite.acquire(nomOuAdresse),
              pSignal(signal),
            ]);
          else await verrouOrbite.acquire(nomOuAdresse);
          if (signal?.aborted) throw new Error("Opération avortée");

          try {
            let bd =
              (isValidAddress(nomOuAdresse) &&
                cacheBdsOrbite.get(nomOuAdresse)) ||
              (await target.open(...args));
            const adresse = bd.address;

            // S'il s'agissait d'un nom, on essaie de prendre la version en cache pour réutiliser le mandataire bd
            if (!isValidAddress(nomOuAdresse)) {
              bd = cacheBdsOrbite.get(adresse) || bd;
            }

            if (!requêtesOrbite.has(adresse))
              requêtesOrbite.set(adresse, new Set());
            const résultat = mandatBd(
              bd,
              requêtesOrbite.get(adresse)!,
              cacheBdsOrbite,
              verrouOrbite,
            );
            cacheBdsOrbite.set(adresse, bd);

            return résultat;
          } finally {
            // Sera exécuté avant le `return` ci-dessus
            verrouOrbite.release(nomOuAdresse);
          }
        };
        return ouvrirAvecVerrou;
      } else {
        return target[prop as keyof OrbitDB];
      }
    },
  });
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
      if (prop === ORIGINALE) return target;

      if (prop === "close") {
        const fermer: BaseDatabase["close"] = async () => {
          await verrou.acquire(bd.address);

          try {
            requêtes.delete(id);

            if (!requêtes.size) {
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
