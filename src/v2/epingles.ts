import { adresseOrbiteValide, idcValide } from "@constl/utils-ipa";
import { BaseDatabase } from "@orbitdb/core";
import { CID } from "multiformats";
import drain from "it-drain";
import PQueue from "p-queue";
import { Nébuleuse, ServiceNébuleuse } from "./nébuleuse/nébuleuse.js";
import { Oublier } from "./crabe/types.js";
import { ServicesNécessairesOrbite } from "./crabe/services/orbite/orbite.js";
import { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";

export const idcEtFichierValide = (val: string) => {
  let idc: string;
  let fichier: string;
  try {
    [idc, fichier] = val.split("/", 1);
  } catch {
    return false;
  }
  if (!fichier) return false;
  if (!idcValide(idc)) return false;
  return { idc, fichier };
};

export class Épingles<
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> extends ServiceNébuleuse<"épingles", ServicesNécessairesOrbite<L>> {
  queue: PQueue;
  requêtes: Map<string, Set<string>>;
  bdsOuvertes: Map<string, { bd: BaseDatabase; oublier: Oublier }>;
  idcsÉpinglés: Set<string>;
  signaleurArrêt: AbortController;

  constructor({
    nébuleuse,
  }: {
    nébuleuse: Nébuleuse<ServicesNécessairesOrbite<L>>;
  }) {
    super({
      clef: "épingles",
      nébuleuse,
      dépendances: ["orbite", "hélia"],
    });

    this.queue = new PQueue({ concurrency: 1 });
    this.requêtes = new Map();
    this.idcsÉpinglés = new Set();
    this.bdsOuvertes = new Map();
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
    this.requêtes.set(idRequête, épingles);
    this.queue.add(async () => await this.mettreÀJour());
  }

  async désépingler({ idRequête }: { idRequête: string }) {
    if (this.signaleurArrêt.signal.aborted) return;
    this.requêtes.delete(idRequête);

    this.queue.add(async () => await this.mettreÀJour());
  }

  estÉpinglé({ id }: { id: string }): boolean {
    return this.bdsOuvertes.has(id) || this.idcsÉpinglés.has(id);
  }

  private async mettreÀJour() {
    const àÉpingler = new Set(...this.requêtes.values());
    const bdsOrbiteÀÉpingler = [...àÉpingler].filter(
      (id) => id && adresseOrbiteValide(id),
    );

    const idcsÀÉpingler = [...àÉpingler]
      .filter((id) => !bdsOrbiteÀÉpingler.includes(id))
      .map((id) => {
        const cidAvecFichier = idcEtFichierValide(id);
        if (cidAvecFichier) return cidAvecFichier.idc;
        else if (idcValide(id)) return id;
        return undefined;
      })
      .filter((x) => !!x) as string[];

    const serviceHélia = this.service("hélia");
    const hélia = await serviceHélia.hélia();
    for (const idc of idcsÀÉpingler) {
      await drain(
        hélia.pins.add(CID.parse(idc), { signal: this.signaleurArrêt.signal }),
      );
    }

    const idcsÀDésépingler = [...this.idcsÉpinglés].filter(
      (id) => !idcsÀÉpingler.includes(id),
    );
    this.idcsÉpinglés = new Set(idcsÀÉpingler);
    for (const idc of idcsÀDésépingler) {
      await drain(
        hélia.pins.rm(CID.parse(idc), { signal: this.signaleurArrêt.signal }),
      );
    }

    const orbite = this.service("orbite");
    await Promise.allSettled(
      bdsOrbiteÀÉpingler.map(async (idBd) => {
        // Faut pas trop s'en faire si la bd n'est pas accessible.
        try {
          const { bd, oublier } = await orbite.ouvrirBd({
            id: idBd,
            signal: this.signaleurArrêt.signal,
          });
          this.bdsOuvertes.set(idBd, { bd, oublier });
        } catch {
          return;
        }
      }),
    );
    const bdsOrbiteÀDésépingler = Object.keys(this.bdsOuvertes).filter(
      (id) => !bdsOrbiteÀÉpingler.includes(id),
    );
    for (const idBd of bdsOrbiteÀDésépingler) {
      await this.bdsOuvertes.get(idBd)?.oublier();
      this.bdsOuvertes.delete(idBd);
    }
  }

  async fermer() {
    this.signaleurArrêt.abort();
    await this.queue.onIdle();

    await Promise.allSettled(
      Object.values(this.bdsOuvertes).map(({ oublier }) => oublier()),
    );
  }
}
