import { isValidAddress } from "@orbitdb/core";
import PQueue from "p-queue";
import { TypedEmitter } from "tiny-typed-emitter";
import { anySignal } from "any-signal";
import { appelerLorsque } from "../../utils.js";
import { estContrôleurNébuleuse } from "./contrôleurNébuleuse.js";
import { MEMBRE, MODÉRATRICE } from "./consts.js";
import type { AccèsDispositif, AccèsUtilisateur, Rôle } from "./types.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";
import type { OrbitDB } from "@orbitdb/core";

export const rôlePlusPuissant = (rôles: Set<Rôle>): Rôle | undefined => {
  if (rôles.has(MODÉRATRICE)) return MODÉRATRICE;
  else if (rôles.has(MEMBRE)) return MEMBRE;
  else return undefined;
};

class AccèsCompte {
  orbite: OrbitDB;
  idCompte: string;

  dispositifs: string[];
  événements: TypedEmitter<{
    démarré: (args: { oublier?: Oublier }) => void;
    misÀJour: () => void;
  }>;

  estDémarré?: { oublier?: Oublier };
  oublier?: Oublier;

  constructor(orbite: OrbitDB, idCompte: string) {
    this.orbite = orbite;
    this.idCompte = idCompte;

    this.dispositifs = [];
    this.événements = new TypedEmitter();
  }

  async démarrer({ signal }: { signal?: AbortSignal } = {}): Promise<void> {
    try {
      const bd = await this.orbite.open(this.idCompte, { signal });
      const accèsCompte = bd.access;

      if (!estContrôleurNébuleuse(accèsCompte)) {
        await bd.close();
        throw new Error(accèsCompte.type)
      };
  
      const suiviCompte = async () => {
        const tous = await accèsCompte.bd.all();
        // On ne différencie pas entre les membres et les modératrices pour les dispositifs d'un compte
        this.dispositifs = [accèsCompte.écriture, ...tous.map((x) => x.key)];
        this.événements.emit("misÀJour");
      };
  
      const oublierÉvénements = appelerLorsque({
        émetteur: accèsCompte.bd.events,
        événement: "update",
        f: suiviCompte,
      });
      await suiviCompte();
  
      const oublier = async () => {
        await oublierÉvénements();
        await bd.close();
      }
  
      this.estDémarré = { oublier };
  
    } catch {
      this.estDémarré = { };
    } finally {
      this.événements.emit("démarré", this.estDémarré as { oublier?: Oublier });
    }
  }

  démarré(): Promise<{ oublier?: Oublier }> {
    return new Promise((résoudre) => {
      if (this.estDémarré) résoudre(this.estDémarré);
      this.événements.once("démarré", résoudre);
    });
  }

  async fermer() {
    const { oublier } = await this.démarré();
    await oublier?.();
  }
}

export class AccèsParComptes {
  orbite: OrbitDB;
  queue: PQueue;
  événements: TypedEmitter<{ misÀJour: () => void }>;
  oublier: Oublier[];
  signaleurArrêt: AbortController;
  signal: AbortSignal;

  _comptes: Map<string, { rôles: Set<Rôle>; accès: AccèsCompte }>;
  _dispositifs: Map<string, Set<Rôle>>;

  constructor({ orbite, signal }: { orbite: OrbitDB; signal?: AbortSignal }) {
    this.orbite = orbite;

    this.queue = new PQueue({ concurrency: 1 });
    this.événements = new TypedEmitter();
    this.oublier = [];
    this.signaleurArrêt = new AbortController();
    this.signal = signal ? anySignal([signal, this.signaleurArrêt.signal]) : this.signaleurArrêt.signal

    this._comptes = new Map();
    this._dispositifs = new Map();
  }

  async autoriser({ id, rôle }: { id: string; rôle: Rôle }) {
    const tâche = async () => {
      if (isValidAddress(id)) {
        let utilisateur = this._comptes.get(id);
        if (!utilisateur) {
          const accèsCompte = new AccèsCompte(this.orbite, id);
          utilisateur = {
            accès: accèsCompte,
            rôles: new Set([rôle]),
          };

          this._comptes.set(id, utilisateur);

          this.événements.emit("misÀJour");

          const oublierUtilisateur = appelerLorsque({
            émetteur: accèsCompte.événements,
            événement: "misÀJour",
            f: () => {
              this.événements.emit("misÀJour");
            },
          });
          
          const oublier = async () => {
            await oublierUtilisateur();
            await accèsCompte.fermer();
          }
          this.oublier.push(oublier);
          try {
            await accèsCompte.démarrer({ signal: this.signal });
          } catch (e) {
            if (!e.toString().includes("AbortError")) throw e;
            return;
          }
        }
        utilisateur.rôles.add(rôle);
      } else {
        let dispositif = this._dispositifs.get(id);
        if (!dispositif) {
          dispositif = new Set();
          this._dispositifs.set(id, dispositif);
        }
        dispositif.add(rôle);
      }
      this.événements.emit("misÀJour");
    };
    this.queue.add(tâche);
  }

  get utilisateurs(): AccèsUtilisateur[] {
    return [...this._comptes.entries()]
      .map(([idCompte, info]) => ({
        idCompte,
        rôle: rôlePlusPuissant(info.rôles),
      }))
      .filter((x) => x.rôle) as AccèsUtilisateur[];
  }

  get dispositifs(): AccèsDispositif[] {
    const dispositifsCompte = [...this._comptes.values()]
      .map(({ rôles, accès }) => {
        const rôle = rôlePlusPuissant(rôles);
        return accès.dispositifs.map((idDispositif) => ({
          idDispositif,
          rôle,
        }));
      })
      .flat()
      .filter((x) => x.rôle) as AccèsDispositif[];

    const dispositifsDirectes = [...this._dispositifs.entries()]
      .map(([idDispositif, rôles]) => {
        return {
          idDispositif,
          rôle: rôlePlusPuissant(rôles),
        };
      })
      .filter((x) => x.rôle) as AccèsDispositif[];
    return [...dispositifsCompte, ...dispositifsDirectes];
  }

  async estUnMembre(id: string): Promise<boolean> {
    await this.àJour();

    // Les modératrices sont aussi des membres
    if (isValidAddress(id)) {
      return !!(
        this._comptes.get(id)?.rôles.has(MEMBRE) ||
        this._comptes.get(id)?.rôles.has(MODÉRATRICE)
      );
    } else {
      return !!this.dispositifs.find((d) => d.idDispositif === id);
    }
  }

  async estUneModératrice(id: string): Promise<boolean> {
    await this.àJour();

    if (isValidAddress(id)) {
      return !!this._comptes.get(id)?.rôles.has(MODÉRATRICE);
    } else {
      return !!this.dispositifs.find(
        (d) => d.idDispositif === id && d.rôle === MODÉRATRICE,
      );
    }
  }

  async estAutorisé(id: string): Promise<boolean> {
    return (await this.estUneModératrice(id)) || (await this.estUnMembre(id));
  }

  async existeDéjà({ id, rôle }: { id: string; rôle: Rôle }) {
    if (rôle === "MEMBRE")
      return (await this.estUnMembre(id)) || (await this.estUneModératrice(id));
    else return await this.estUneModératrice(id);
  }

  async àJour(): Promise<void> {
    await this.queue.onIdle();
  }

  async fermer(): Promise<void> {
    this.signaleurArrêt.abort();
    await Promise.allSettled(this.oublier.map((f) => f()));
  }
}
