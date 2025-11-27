import { adresseOrbiteValide, idcValide } from "@constl/utils-ipa";
import { CID } from "multiformats";
import drain from "it-drain";
import PQueue from "p-queue";
import { ServiceNébuleuse } from "./nébuleuse/nébuleuse.js";
import { idcEtFichierValide } from "./utils.js";
import type { BaseDatabase } from "@orbitdb/core";
import type { Nébuleuse } from "./nébuleuse/nébuleuse.js";
import type { Oublier } from "./crabe/types.js";
import type { ServicesNécessairesOrbite } from "./crabe/services/orbite/orbite.js";
import type { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";

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
    this.requêtes.set(idRequête, épingles);

    this.queue.add(async () => await this.mettreÀJour());
  }

  async désépingler({ idRequête }: { idRequête: string }) {
    this.requêtes.delete(idRequête);
    this.queue.add(async () => await this.mettreÀJour());
  }

  async estÉpinglé({ id }: { id: string }): Promise<boolean> {
    // Enlever le fichier s'il s'agit d'un CID avec fichier
    const idcEtFichier = idcEtFichierValide(id);
    if (idcEtFichier) id = idcEtFichier.idc;

    return this.bdsOuvertes.has(id) || this.idcsÉpinglés.has(id);
  }

  private async mettreÀJour() {
    if (this.signaleurArrêt.signal.aborted) return;

    const àÉpingler = new Set(
      [...this.requêtes.values()].map((x) => [...x]).flat(),
    );
    const bdsOrbiteÀÉpingler = [...àÉpingler].filter(
      (id) => id && adresseOrbiteValide(id),
    );

    const idcsÀÉpingler = [...àÉpingler]
      .map((id) => {
        const cidAvecFichier = idcEtFichierValide(id);
        if (cidAvecFichier) return cidAvecFichier.idc;
        else if (idcValide(id)) return id;
        return undefined;
      })
      .filter((x) => !!x) as string[];

    const serviceHélia = this.service("hélia");
    const hélia = await serviceHélia.hélia();
    try {
      for (const idc of idcsÀÉpingler) {
        await drain(
          hélia.pins.add(CID.parse(idc), {
            signal: this.signaleurArrêt.signal,
          }),
        );
      }
    } catch (e) {
      if (e.toString().includes("AbortError")) return;
      throw e;
    }

    const idcsÀDésépingler = [...this.idcsÉpinglés].filter(
      (id) => !idcsÀÉpingler.includes(id),
    );

    try {
      for (const idc of idcsÀDésépingler) {
        await drain(
          hélia.pins.rm(CID.parse(idc), { signal: this.signaleurArrêt.signal }),
        );
      }
    } catch (e) {
      if (e.toString().includes("AbortError")) return;
      throw e;
    }
    this.idcsÉpinglés = new Set(idcsÀÉpingler);

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
    const bdsOrbiteÀDésépingler = [...this.bdsOuvertes.keys()].filter(
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
      [...this.bdsOuvertes.values()].map(
        async ({ oublier }) => await oublier(),
      ),
    );

    await super.fermer();
  }
}
