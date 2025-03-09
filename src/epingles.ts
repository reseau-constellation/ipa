import { adresseOrbiteValide, idcValide } from "@constl/utils-ipa";
import { BaseDatabase } from "@orbitdb/core";
import { CID } from "multiformats";
import drain from "it-drain";
import { schémaFonctionOublier } from "@/types.js";
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
  requêtes: { [id: string]: Set<string> };
  bdsOuvertes: {
    [id: string]: { bd: BaseDatabase; fOublier: schémaFonctionOublier };
  };
  idcsÉpinglés: string[];
  signaleurArrêt: AbortController;

  constructor({ client }: { client: Constellation }) {
    this.client = client;
    this.requêtes = {};
    this.bdsOuvertes = {};
    this.idcsÉpinglés = [];
    this.signaleurArrêt = new AbortController();
  }

  async épingler({
    idRequête,
    épingles,
  }: {
    idRequête: string;
    épingles: Set<string>;
  }) {
    if (this.signaleurArrêt.signal.aborted) return;
    this.requêtes[idRequête] = épingles;
    await this.mettreÀJour();
  }

  async désépingler({ idRequête }: { idRequête: string }) {
    if (this.signaleurArrêt.signal.aborted) return;
    delete this.requêtes[idRequête];
    await this.mettreÀJour();
  }

  estÉpinglé({ id }: { id: string }): boolean {
    return !!this.bdsOuvertes[id] || this.idcsÉpinglés.includes(id);
  }

  private async mettreÀJour() {
    const àÉpingler = new Set(...Object.values(this.requêtes));
    const bdsOrbiteÀÉpingler = [...àÉpingler].filter(
      (id) => id && adresseOrbiteValide(id),
    );

    const idcsÀÉpingler = [...àÉpingler]
      .filter((id) => !bdsOrbiteÀÉpingler.includes(id))
      .map((id) => {
        const cidAvecFichier = cidEtFichierValide(id);
        if (cidAvecFichier) return cidAvecFichier.cid;
        else if (idcValide(id)) return id;
        return undefined;
      })
      .filter((x) => !!x) as string[];

    const { sfip } = await this.client.attendreSfipEtOrbite();
    for (const idc of idcsÀÉpingler) {
      await drain(sfip.pins.add(CID.parse(idc)));
    }

    const idcsÀDésépingler = this.idcsÉpinglés.filter(
      (id) => !idcsÀÉpingler.includes(id),
    );
    this.idcsÉpinglés = idcsÀÉpingler;
    for (const idc of idcsÀDésépingler) {
      await drain(sfip.pins.rm(CID.parse(idc)));
    }

    await Promise.all(
      bdsOrbiteÀÉpingler.map(async (idBd) => {
        // Faut pas trop s'en faire si la bd n'est pas accessible.
        try {
          const { bd, fOublier } = await this.client.ouvrirBd({
            id: idBd,
            signal: this.signaleurArrêt.signal,
          });
          this.bdsOuvertes[idBd] = { bd, fOublier };
        } catch {
          return;
        }
      }),
    );
    const bdsOrbiteÀDésépingler = Object.keys(this.bdsOuvertes).filter(
      (id) => !bdsOrbiteÀÉpingler.includes(id),
    );
    for (const idBd of bdsOrbiteÀDésépingler) {
      await this.bdsOuvertes[idBd].fOublier();
      delete this.bdsOuvertes[idBd];
    }
  }

  async fermer() {
    this.signaleurArrêt.abort();
    await Promise.all(
      Object.values(this.bdsOuvertes).map(({ fOublier }) => fOublier()),
    );
  }
}
