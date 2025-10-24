import { Semaphore } from "@chriscdn/promise-semaphore";
import { BaseDatabase, OrbitDB } from "@orbitdb/core";
import { v4 as uuidv4 } from "uuid";
import { ServiceMap } from "@libp2p/interface";

// Un mandataire pour orbite qui évite les conditions de concurrence pour `open`

// Ceci doit être commun pour que les contrôleurs d'accès puissent aussi envelopper leur instance d'Orbite
const verrous = new Map<string, Semaphore>();

export const mandatOrbite = <L extends ServiceMap = ServiceMap>(
  orbite: OrbitDB<L>,
) => {
  if (!verrous.has(orbite.id)) verrous.set(orbite.id, new Semaphore());
  const verrouOuverture = verrous.get(orbite.id);

  const requêtes = new Map<string, Set<string>>();

  return new Proxy(orbite, {
    get(target, prop) {
      if (prop === "open") {
        const ouvrirAvecVerrou: OrbitDB["open"] = async (...args) => {
          const adresse = args[0];

          await verrouOuverture.acquire(adresse);
          try {
            if (!requêtes.has(adresse)) requêtes.set(adresse, new Set());
            const résultat = mandatBd(
              await target.open(...args),
              requêtes.get(adresse)!,
            );
            verrouOuverture.release(adresse);
            return résultat;
          } finally {
            verrouOuverture.release(adresse);
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
const mandatBd = (bd: BaseDatabase, requêtes: Set<string>) => {
  const id = uuidv4();
  requêtes.add(id);

  return new Proxy(bd, {
    get(target, prop) {
      if (prop === "close") {
        const fermer: BaseDatabase["close"] = async () => {
          requêtes.delete(id);
          if (!requêtes.size) return await target.close();
        };
        return fermer;
      } else if (prop === "drop") {
        const effacer: BaseDatabase["drop"] = async () => {
          requêtes.clear();
          return await target.drop();
        };
        return effacer;
      } else {
        return target[prop as keyof BaseDatabase];
      }
    },
  });
};
