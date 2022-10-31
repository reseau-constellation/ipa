import Semaphore from "@chriscdn/promise-semaphore";

import OrbitDB from "orbit-db";
import Store from "orbit-db-store";

const verrouOuvertureBd = new Semaphore();

export class AccesseurBdOrbite {
  bds: { [key: string]: Store };
  requètes: { [key: string]: Set<string> };

  constructor() {
    this.bds = {};
    this.requètes = {};
  }

  async ouvrirBd(
    orbite: OrbitDB,
    idBd: string,
    idRequète: string
  ): Promise<Store> {
    const idBdEtOrbite = this._obtClef(orbite, idBd);

    verrouOuvertureBd.acquire(idBdEtOrbite);

    if (!this.requètes[idBdEtOrbite]) this.requètes[idBdEtOrbite] = new Set();
    this.requètes[idBdEtOrbite].add(idRequète);

    const existante = this.bds[idBdEtOrbite];
    if (existante) {
      verrouOuvertureBd.release(idBdEtOrbite);
      return existante;
    }
    const bd = await orbite.open(idBd);
    await bd.load();

    this.bds[idBdEtOrbite] = bd;
    verrouOuvertureBd.release(idBdEtOrbite);
    return bd;
  }

  async fermerBd(
    orbite: OrbitDB,
    idBd: string,
    idRequète: string
  ): Promise<void> {
    const idBdEtOrbite = this._obtClef(orbite, idBd);
    verrouOuvertureBd.acquire(idBdEtOrbite);

    this.requètes[idBdEtOrbite].delete(idRequète);
    if (!this.requètes[idBdEtOrbite].size) {
      const bd = this.bds[idBdEtOrbite];
      await bd.close();
      delete this.bds[idBdEtOrbite];
      delete this.requètes[idBdEtOrbite];
    }
    verrouOuvertureBd.release(idBdEtOrbite);
  }

  _obtClef(orbite: OrbitDB, idBd: string): string {
    const idOrbite = orbite.identity.id;
    const idBdEtOrbite = idBd + idOrbite;
    return idBdEtOrbite;
  }
}

const accesseurBdOrbite = new AccesseurBdOrbite();
export default accesseurBdOrbite;
