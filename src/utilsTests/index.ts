import type { Controller } from "ipfsd-ctl";
import { connectPeers } from "@/utilsTests/orbitDbTestUtils.js";
import { initierSFIP, arrêterSFIP } from "@/utilsTests/sfipTest.js";
import { EventEmitter } from "events";

import { once } from "events";
import path from "path";
import rmrf from "rimraf";
import { v4 as uuidv4 } from "uuid";
import OrbitDB from "orbit-db";
import type Store from "orbit-db-store";
import type KeyValueStore from "orbit-db-kvstore";
import type FeedStore from "orbit-db-feedstore";
import fs from "fs";
import os from "os";
import Semaphore from "@chriscdn/promise-semaphore";

import type { default as ContrôleurConstellation } from "@/accès/cntrlConstellation.js";
import ClientConstellation from "@/client.js";
import générerMandataireProc from "@/mandataire/ipaProc.js";
import générerMandataireTravailleur from "@/mandataire/ipaTravailleur.js";
import type { statutDispositif } from "@/reseau.js";

export * from "@/utilsTests/sfipTest.js";

export const dirRessourcesTests = (): string => {
  return path.resolve(path.dirname(""), "src", "utilsTests", "ressources");
};

export const dirTempoTests = (): string => {
  return fs.mkdtempSync(path.join(os.tmpdir(), "constl-ipa"));
};

export const obtDirTempoPourTest = (nom?: string): string => {
  const dir = path.resolve(dirTempoTests(), (nom || "") + uuidv4());
  fs.mkdirSync(dir, { recursive: true });
  return dir
};

const attendreInvité = (bd: Store, idInvité: string): Promise<void> =>
  new Promise<void>((resolve) => {
    const testAutorisé = async () => {
      const autorisé = await (
        bd.access as unknown as ContrôleurConstellation
      ).estAutorisé(idInvité);
      if (autorisé) {
        clearInterval(interval);
        resolve();
      }
    };
    const interval = setInterval(testAutorisé, 100);
    testAutorisé();
  });

export const clientConnectéÀ = (
  client1: ClientConstellation,
  client2: ClientConstellation
): Promise<void> => {
  const verrou = new Semaphore();
  return new Promise(async (résoudre) => {
    const fFinale = async (dispositifs: statutDispositif[]) => {
      const idBdCompte2 = await client2.obtIdCompte();
      const connecté = !!dispositifs.find(
        (d) => d.infoDispositif.idCompte === idBdCompte2
      );
      if (connecté) {
        await verrou.acquire("suivreConnexions");
        await fOublier();
        résoudre();
      }
    };
    await verrou.acquire("suivreConnexions");
    const fOublier = await client1.réseau!.suivreConnexionsDispositifs({
      f: fFinale,
    });
    verrou.release("suivreConnexions");
  });
};

export const clientsConnectés = async (
  client1: ClientConstellation,
  client2: ClientConstellation
): Promise<void> => {
  const client1ConnectéÀ2 = clientConnectéÀ(client1, client2);
  const client2ConnectéÀ1 = clientConnectéÀ(client2, client1);
  await Promise.all([client1ConnectéÀ2, client2ConnectéÀ1]);
  return;
};

export const attendreSync = async (bd: Store): Promise<void> => {
  const accès = bd.access as unknown as ContrôleurConstellation;
  await once(accès.bd!.events, "peer.exchanged");
};

export class AttendreRésultat<T> {
  val?: T;
  fsOublier: { [clef: string]: () => void };
  événements: EventEmitter;

  constructor() {
    this.événements = new EventEmitter();
    this.val = undefined;
    this.fsOublier = {};
  }

  mettreÀJour(x?: T) {
    this.val = x;
    this.événements.emit("changé");
  }

  async attendreQue(f: (x: T) => boolean): Promise<T> {
    if (this.val !== undefined && f(this.val)) return this.val;
    const id = uuidv4();

    return new Promise((résoudre) => {
      const fLorsqueChangé = () => {
        if (this.val !== undefined && f(this.val)) {
          this.oublier(id);
          résoudre(this.val);
        }
      };
      this.événements.on("changé", fLorsqueChangé);
      this.fsOublier[id] = () => this.événements.off("changé", fLorsqueChangé);
    });
  }

  async attendreExiste(): Promise<T> {
    const val = await this.attendreQue((x) => !!x) as T;
    return val
  }

  oublier(id: string) {
    this.fsOublier[id]();
    delete this.fsOublier[id];
  }

  toutAnnuler() {
    Object.keys(this.fsOublier).forEach((id) => this.oublier(id));
  }
}

export class AttendreFichierExiste extends EventEmitter {
  fOublier?: () => void;
  fichier: string;

  constructor(fichier: string) {
    super();
    this.fichier = fichier;
  }

  attendre(): Promise<void> {
    return new Promise((résoudre) => {
      if (fs.existsSync(this.fichier)) résoudre();
      const dossier = path.dirname(this.fichier);
      
      const chokidar = import("chokidar");
      chokidar.then(c=>{
        const écouteur = c.watch(dossier);
        this.fOublier = () => écouteur.close();
        écouteur.on("add", async () => {
          if (fs.existsSync(this.fichier)) {
            await écouteur.close();
            résoudre();
          }
        });
        if (fs.existsSync(this.fichier)) {
          écouteur.close();
          résoudre();
        }
      });
      
    });
  }

  annuler() {
    this.fOublier && this.fOublier();
  }
}

export class AttendreFichierModifié extends EventEmitter {
  fsOublier: (() => void)[];
  fichier: string;
  attendreExiste: AttendreFichierExiste;

  constructor(fichier: string) {
    super();
    this.fichier = fichier;
    this.attendreExiste = new AttendreFichierExiste(fichier);
    this.fsOublier = [];
    this.fsOublier.push(() => this.attendreExiste.annuler());
  }

  async attendre(tempsAvant: number): Promise<void> {
    await this.attendreExiste.attendre();

    return new Promise((résoudre, rejeter) => {
      import("chokidar").then(
        c=>{
          const écouteur = c.watch(this.fichier);
          this.fsOublier.push(() => écouteur.close());

          écouteur.on("change", async (adresse) => {
            if (adresse !== this.fichier) return;
            try {
              const { mtime } = fs.statSync(this.fichier);
              const prêt = mtime.getTime() > tempsAvant;
              if (prêt) {
                await écouteur.close();
                résoudre();
              }
            } catch (e) {
              // Le fichier a été effacé
              écouteur.close();
              rejeter(e);
            }
          });
        }
      )
      
    });
  }

  annuler() {
    this.fsOublier.forEach((f) => f());
  }
}

export const peutÉcrire = async (
  bd: KeyValueStore<number> | FeedStore<string>,
  attendre?: OrbitDB
): Promise<boolean> => {
  if (attendre) {
    await attendreInvité(bd, attendre.identity.id);
  }

  try {
    if (bd.type === "keyvalue") {
      const CLEF = "test";
      const VAL = 123;

      await (bd as KeyValueStore<number>).set(CLEF, VAL);
      const val = bd.get(CLEF);

      await (bd as KeyValueStore<number>).del(CLEF);
      return val === VAL;
    } else if (bd.type === "feed") {
      const VAL = "test";

      await (bd as FeedStore<string>).add(VAL);
      const éléments = (bd as FeedStore<string>)
        .iterator({ limit: -1 })
        .collect();

      const autorisé =
        éléments.length === 1 && éléments[0].payload.value === VAL;
      if (éléments.length === 1) {
        await (bd as FeedStore<string>).remove(éléments[0].hash);
      }
      return autorisé;
    } else {
      throw new Error(`Type de BD ${bd.type} non supporté par ce test.`);
    }
  } catch {
    return false;
  }
};

export const générerOrbites = async (
  n = 1
): Promise<{ orbites: OrbitDB[]; fOublier: () => Promise<void> }> => {
  const dssfip: Controller[] = [];
  const sfips: Controller["api"][] = [];
  const orbites: OrbitDB[] = [];

  const racineDossierOrbite = obtDirTempoPourTest("orbite");

  rmrf.sync(racineDossierOrbite);
  const _générer = async (i: number): Promise<void> => {
    const racineDossier = `${racineDossierOrbite}/${i}`;
    const dsfip = await initierSFIP(`${racineDossier}/sfip`);
    const sfip = dsfip.api;
    const orbite = await OrbitDB.createInstance(sfip, {
      directory: `${racineDossier}/orbite`,
    });

    for (const ip of sfips) {
      await connectPeers(sfip, ip);
    }

    dssfip.push(dsfip);
    sfips.push(sfip);
    orbites.push(orbite);
  };

  await Promise.all([...Array(n).keys()].map((i) => _générer(i)));

  const fOublier = async () => {
    await Promise.all(
      orbites.map(async (orbite) => {
        await orbite.stop();
      })
    );

    await Promise.all(
      dssfip.map(async (d) => {
        await arrêterSFIP(d);
      })
    );

    rmrf.sync(racineDossierOrbite);
  };
  return { orbites, fOublier };
};

export type typeClient = "directe" | "proc" | "travailleur";

export const générerClients = async (
  n = 1,
  type: typeClient = "directe"
): Promise<{
  clients: ClientConstellation[];
  fOublier: () => Promise<void>;
}> => {
  const clients: ClientConstellation[] = [];
  const fsOublier: (() => Promise<void>)[] = [];

  if (type === "directe" || type == "proc") {
    const { orbites, fOublier: fOublierOrbites } = await générerOrbites(n);
    fsOublier.push(fOublierOrbites);

    for (const i in [...Array(n).keys()]) {
      let client: ClientConstellation;
      switch (type) {
        case "directe": {
          client = await ClientConstellation.créer({
            orbite: orbites[i],
          });
          break;
        }

        case "proc": {
          client = générerMandataireProc({ orbite: orbites[i] });
          break;
        }

        default:
          throw new Error(type);
      }
      clients.push(client);
    }
  } else if (type === "travailleur") {
    let client: ClientConstellation;
    for (const i in [...Array(n).keys()]) {
      client = générerMandataireTravailleur({ orbite: { dossier: String(i) } });
      clients.push(client);
    }
  } else {
    throw new Error(type);
  }

  const fOublier = async () => {
    await Promise.all(clients.map((client) => client.fermer()));
    await Promise.all(fsOublier.map((f) => f()));
  };
  return { fOublier, clients };
};

export const typesClients: typeClient[] =
  process.env.MANDATAIRE === "TOUS"
    ? ["directe", "proc"]
    : process.env.MANDATAIRE === "PROC"
    ? ["proc"]
    : ["directe"];
