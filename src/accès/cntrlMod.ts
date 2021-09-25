import { EventEmitter } from "events";
import OrbitDB, { entréeBD, identityProvider } from "orbit-db";

import GestionnaireAccès from "./gestionnaireUtilisateurs";
import { MODÉRATEUR, rôles } from "./consts";
import { entréeBDAccès } from "./types";

const type = "controlleur-accès-constellation";

export interface OptionsContrôleurAccèsConstellation {
  premierMod?: string;
}

interface OptionsInitContrôleurAccèsConstellation
  extends OptionsContrôleurAccèsConstellation {
  premierMod: string;
}

export default class ContrôleurAccès extends EventEmitter {
  _premierMod: string;
  orbitdb: OrbitDB;
  gestAccès: GestionnaireAccès;
  dernierAppel?: number;

  constructor(
    orbitdb: OrbitDB,
    options: OptionsInitContrôleurAccèsConstellation
  ) {
    super();
    this.orbitdb = orbitdb;
    this._premierMod = options.premierMod;

    this.gestAccès = new GestionnaireAccès(this.orbitdb);
  }

  static get type(): string {
    return type;
  }

  async estUnModérateurPatient(id: string): Promise<boolean> {
    this.dernierAppel = Date.now();
    const PATIENCE = 1000;

    if (await this.gestAccès.estUnModérateur(id)) return true;

    return new Promise((résoudre) => {
      const interval = setInterval(async () => {
        const estAutorisé = await this.gestAccès.estUnModérateur(id);
        if (estAutorisé) {
          clearInterval(interval);
          résoudre(true);
        } else {
          const maintenant = Date.now();
          if (maintenant - this.dernierAppel! > PATIENCE) {
            clearInterval(interval);
            résoudre(false);
          }
        }
      }, 10);
    });
  }

  get premierMod(): string {
    return this._premierMod;
  }

  async canAppend(
    entry: entréeBD<entréeBDAccès>,
    identityProvider: identityProvider
  ): Promise<boolean> {
    const idÉlément = entry.identity.id;
    const { rôle, id: idAjout } = entry.payload.value;
    const estUnMod = this.estUnModérateurPatient(idÉlément);
    const rôleValide = rôles.includes(rôle);

    /*console.log({
      estUnMod,
      rôleValide,
      rôle,
      idÉlément,
      idAjout,
      accèsÉcriture: [...this._accèsÉcriture],
      entry,
    });*/
    const validSig = async () =>
      identityProvider.verifyIdentity(entry.identity);

    if (rôleValide && (await estUnMod) && (await validSig())) {
      if (rôle === MODÉRATEUR) {
        await this.gestAccès.ajouterÉléments([
          { id: idAjout, rôle: MODÉRATEUR },
        ]);
      }
      return true;
    }
    return false;
  }

  async load(): Promise<void> {
    // Ajouter le premier modérateur
    await this.gestAccès.ajouterÉléments([
      { id: this._premierMod, rôle: MODÉRATEUR },
    ]);
  }

  async save(): Promise<{ [key: string]: string }> {
    const manifest = { premierMod: this.premierMod };
    return manifest;
  }

  static async create(
    orbitdb: OrbitDB,
    options: OptionsContrôleurAccèsConstellation = {}
  ): Promise<ContrôleurAccès> {
    const premierMod = options.premierMod;
    if (!premierMod)
      throw new Error("Contrôle d'accès: premier modérateur requis");
    return new ContrôleurAccès(orbitdb, { premierMod });
  }
}
