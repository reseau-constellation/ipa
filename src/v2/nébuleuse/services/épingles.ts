import { idcValide } from "@constl/utils-ipa";
import { CID } from "multiformats";
import drain from "it-drain";
import PQueue from "p-queue";
import { isValidAddress, type BaseDatabase } from "@orbitdb/core";
import { anySignal } from "any-signal";
import { ServiceAppli } from "../appli/services.js";
import { idcEtFichierValide } from "../../utils.js";
import { estErreurAvortée } from "../utils.js";
import { filtreAsync } from "./utils.js";
import type { OptionsAppli } from "../appli/appli.js";
import type { Oublier } from "../types.js";
import type {
  ServiceOrbite,
  ServicesNécessairesOrbite,
} from "./orbite/orbite.js";

export type ServicesNécessairesÉpingles = ServicesNécessairesOrbite & {
  orbite: ServiceOrbite;
};

export class ServiceÉpingles extends ServiceAppli<
  "épingles",
  ServicesNécessairesÉpingles
> {
  queue: PQueue;
  requêtes: Map<string, Set<string>>;
  bdsOuvertes: Map<
    string,
    { oublier: () => void } | { bd: BaseDatabase; oublier: Oublier }
  >;
  idcsÉpinglés: Set<string>;
  signaleurArrêt: AbortController;

  constructor({
    services,
    options,
  }: {
    services: ServicesNécessairesÉpingles;
    options: OptionsAppli;
  }) {
    super({
      clef: "épingles",
      services,
      dépendances: ["orbite", "hélia"],
      options,
    });

    this.queue = new PQueue({ concurrency: 1 });
    this.requêtes = new Map();
    this.idcsÉpinglés = new Set();
    this.bdsOuvertes = new Map();
    this.signaleurArrêt = new AbortController();
  }

  async démarrer(): Promise<unknown> {
    // Réinitialiser le signaleur, mais uniquement si nécessaire.
    if (this.signaleurArrêt.signal.aborted)
      this.signaleurArrêt = new AbortController();

    return await super.démarrer();
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

    // Documents
    const serviceHélia = this.service("hélia");
    const hélia = await serviceHélia.hélia();

    const idcs = [...àÉpingler]
      .map((id) => {
        const cidAvecFichier = idcEtFichierValide(id);
        if (cidAvecFichier) return cidAvecFichier.idc;
        else if (idcValide(id)) return id;
        return undefined;
      })
      .filter((x): x is string => !!x);

    const idcsÀÉpingler = await filtreAsync(
      idcs.map((idc) => CID.parse(idc)),
      async (idc) => (await hélia.pins.isPinned(idc)) === false,
    );
    try {
      await Promise.allSettled(
        idcsÀÉpingler.map(async (idc) => {
          await drain(
            hélia.pins.add(idc, {
              signal: this.signaleurArrêt.signal,
            }),
          );
        }),
      );
    } catch (e) {
      if (estErreurAvortée(e)) return;
    }

    const idcsÀDésépingler = [...this.idcsÉpinglés].filter(
      (id) => !idcs.includes(id),
    );

    try {
      await Promise.allSettled(
        idcsÀDésépingler.map(async (idc) => {
          await drain(
            hélia.pins.rm(CID.parse(idc), {
              signal: this.signaleurArrêt.signal,
            }),
          );
        }),
      );
    } catch (e) {
      if (estErreurAvortée(e)) return;
      throw e;
    }
    this.idcsÉpinglés = new Set(idcs);

    // Bases de données
    const bdsOrbiteÀÉpingler = [...àÉpingler].filter(
      (id) => id && isValidAddress(id) && !this.bdsOuvertes.has(id),
    );

    const orbite = this.service("orbite");

    bdsOrbiteÀÉpingler.forEach(async (idBd) => {
      const signaleur = new AbortController();
      this.bdsOuvertes.set(idBd, { oublier: () => signaleur.abort() });
      orbite
        .ouvrirBd({
          id: idBd,
          signal: anySignal([this.signaleurArrêt.signal, signaleur.signal]),
        })
        .then(({ bd, oublier }) => this.bdsOuvertes.set(idBd, { bd, oublier }))
        .catch(() => {
          // Faut pas trop s'en faire si la bd n'est pas accessible.
          return;
        });
    });

    const bdsOrbiteÀDésépingler = [...this.bdsOuvertes.keys()].filter(
      (id) => !àÉpingler.has(id),
    );

    for (const idBd of bdsOrbiteÀDésépingler) {
      const existante = this.bdsOuvertes.get(idBd);
      await existante?.oublier();
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

export const serviceÉpingles =
  () =>
  ({
    services,
    options,
  }: {
    services: ServicesNécessairesÉpingles;
    options: OptionsAppli;
  }) => {
    return new ServiceÉpingles({ services, options });
  };
