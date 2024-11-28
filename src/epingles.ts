import { idcValide } from "@constl/utils-ipa";
import { BaseDatabase, isValidAddress } from "@orbitdb/core";
import { CID } from "multiformats";
import drain from "it-drain";
import {
  schémaFonctionOublier,
} from "@/types.js";
import type { Constellation } from "@/client.js";

export const cidEtFichierValide = (val: string) => {
  let cid: string;
  let fichier: string;
  try {
    [cid, fichier] = val.split("/");
  } catch {
    return false;
  }
  if (!fichier) return false;
  if (!idcValide(cid)) return false;
  return { cid, fichier };
};

export class Épingles {
  client: Constellation;
  requêtes: {[id: string]: Set<string>}
  bdsOuvertes: {[id: string]: {bd: BaseDatabase; fOublier: schémaFonctionOublier}};
  idcsÉpinglés: string[];

  constructor({ client }: { client: Constellation }) {
    this.client = client;
    this.requêtes = {};
    this.bdsOuvertes = {};
    this.idcsÉpinglés = [];
  }

  async épingler({idRequête, épingles}: {idRequête: string, épingles: Set<string>}) {
    this.requêtes[idRequête] = épingles;
    await this.mettreÀJour();
  }

  async désépingler({idRequête}: {idRequête: string}) {
    delete this.requêtes[idRequête];
    await this.mettreÀJour();
  }

  estÉpinglé({id}: {id: string}): boolean {
    return !!this.bdsOuvertes[id] || this.idcsÉpinglés.includes(id)
  }

  private async mettreÀJour() {
    const àÉpingler = new Set(...Object.values(this.requêtes));
    const bdsOrbiteÀÉpingler = [...àÉpingler].filter(id=>id && isValidAddress(id));
    
    const idcsÀÉpingler = [...àÉpingler].filter(id=>!bdsOrbiteÀÉpingler.includes(id)).map(id=>{
      const cidAvecFichier = cidEtFichierValide(id)
      if (cidAvecFichier) return cidAvecFichier.cid
      else if (idcValide(id)) return id;
      return undefined;
    }).filter(x=>!!x) as string[];
    
    const { sfip } = await this.client.attendreSfipEtOrbite();
    for (const idc of idcsÀÉpingler) {
      await drain(sfip.pins.add(CID.parse(idc)));
    };

    const idcsÀDésépingler = this.idcsÉpinglés.filter(id => !idcsÀÉpingler.includes(id));
    this.idcsÉpinglés = idcsÀÉpingler;
    for (const idc of idcsÀDésépingler) {
      await drain(sfip.pins.rm(CID.parse(idc)));
    };

    for (const idBd of bdsOrbiteÀÉpingler) {
      // Faut pas trop s'en faire si la bd n'est pas accessible.
      try {
        const { bd, fOublier } = await this.client.ouvrirBd({ id: idBd });
        this.bdsOuvertes[idBd] = { bd, fOublier };
      } catch {
        return;
      }
    }
    const bdsOrbiteÀDésépingler = Object.keys(this.bdsOuvertes).filter(id => !bdsOrbiteÀÉpingler.includes(id));
    for (const idBd of bdsOrbiteÀDésépingler) {
      await this.bdsOuvertes[idBd].fOublier();
      delete this.bdsOuvertes[idBd];
    }
  }

  async fermer() {
    await Promise.all(Object.values(this.bdsOuvertes).map(({fOublier}) => fOublier()))
  }
};
