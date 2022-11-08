import { EventEmitter } from "events";
import OrbitDB from "orbit-db";
import identityProvider from "orbit-db-identity-provider";

import GestionnaireAccès from "@/accès/gestionnaireUtilisateurs.js";
import { MODÉRATEUR, rôles } from "@/accès/consts.js";
import { élémentBdAccès } from "@/accès/types.js";

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
  dernierAppel: number;

  constructor(
    orbitdb: OrbitDB,
    options: OptionsInitContrôleurAccèsConstellation
  ) {
    super();
    this.orbitdb = orbitdb;
    this._premierMod = options.premierMod;

    this.gestAccès = new GestionnaireAccès(this.orbitdb);
    this.dernierAppel = Date.now();
  }

  static get type(): string {
    return type;
  }

  async estUnModérateurPatient(id: string): Promise<boolean> {
    const PATIENCE = 1000;

    if (await this.gestAccès.estUnModérateur(id)) return true;

    return new Promise((résoudre) => {
      const partirCrono = () => {
        setTimeout(async () => {
          const estAutorisé = await this.gestAccès.estUnModérateur(id);
          if (estAutorisé) {
            résoudre(true);
          } else {
            const maintenant = Date.now();
            if (maintenant - this.dernierAppel > PATIENCE) {
              résoudre(false);
            } else {
              partirCrono();
            }
          }
        }, 100);
      };
      partirCrono();
    });
  }

  get premierMod(): string {
    return this._premierMod;
  }

  async canAppend(
    entry: LogEntry<élémentBdAccès>,
    identityProvider: identityProvider
  ): Promise<boolean> {
    const idÉlément = entry.identity.id;
    const { rôle, id: idAjout } = entry.payload.value;
    const estUnMod = this.estUnModérateurPatient(idÉlément);
    const rôleValide = rôles.includes(rôle);

    const validSig = async () =>
      identityProvider.verifyIdentity(entry.identity);

    if (rôleValide && (await estUnMod) && (await validSig())) {
      if (rôle === MODÉRATEUR) {
        await this.gestAccès.ajouterÉléments([
          { id: idAjout, rôle: MODÉRATEUR },
        ]);
        this.dernierAppel = Date.now();
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
    if (!premierMod) {
      throw new Error("Contrôle d'accès: premier modérateur requis");
    }
    return new ContrôleurAccès(orbitdb, { premierMod });
  }
}
