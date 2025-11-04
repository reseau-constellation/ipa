import { Semaphore } from "@chriscdn/promise-semaphore";
import { BaseDatabase, OrbitDB, isValidAddress } from "@orbitdb/core";
import { v4 as uuidv4 } from "uuid";
import { ServiceMap } from "@libp2p/interface";

// Un mandataire pour orbite qui évite les conditions de concurrence pour `open`

// Ceci doit être commun pour que les contrôleurs d'accès puissent aussi envelopper leur instance d'Orbite
const verrous = new Map<string, Semaphore>();
const requêtes = new Map<string, Map<string, Set<string>>>();
const cacheBds = new Map<string, Map<string, BaseDatabase>>();

export const ORIGINALE = Symbol("orbite originale");

export const mandatOrbite = <L extends ServiceMap = ServiceMap>(
  orbite: OrbitDB<L>,
) => {
  if (!verrous.has(orbite.identity.id)) verrous.set(orbite.identity.id, new Semaphore());
  const verrouOrbite = verrous.get(orbite.identity.id);

  if (!requêtes.has(orbite.identity.id)) requêtes.set(orbite.identity.id, new Map());
  const requêtesOrbite = requêtes.get(orbite.identity.id)!;
  
  if (!cacheBds.has(orbite.identity.id)) cacheBds.set(orbite.identity.id, new Map());
  const cacheBdsOrbite = cacheBds.get(orbite.identity.id)!;

  return new Proxy(orbite, {
    get(target, prop) {
      if (prop === "open") {
        const ouvrirAvecVerrou: OrbitDB["open"] = async (...args) => {
          const nomOuAdresse = args[0];

          await verrouOrbite.acquire(nomOuAdresse);

          try {
            const bd = cacheBdsOrbite.get(nomOuAdresse) || (await target.open(...args));
            const adresse = bd.address;

            if (!requêtesOrbite.has(adresse)) requêtesOrbite.set(adresse, new Set());
            const résultat = mandatBd(bd, requêtesOrbite.get(adresse)!, cacheBdsOrbite, verrouOrbite);
            cacheBdsOrbite.set(adresse, bd);

            verrouOrbite.release(nomOuAdresse);
            return résultat;
          } finally {
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
  verrou: Semaphore
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
            verrou.release(bd.address)
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
