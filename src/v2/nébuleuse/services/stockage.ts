import { join } from "path";
import { ServiceAppli } from "@/v2/nébuleuse/appli/services.js";
import type { ServiceDossier } from "./dossier.js";
import type { OptionsAppli } from "@/v2/nébuleuse/appli/appli.js";
import { obtStockageDonnées } from "./utils.js";
import { Key, type Datastore } from "interface-datastore";
import type { FsDatastore } from "datastore-fs";
import type { IDBDatastore } from "datastore-idb";
import { NotFoundError } from "@libp2p/interface";

export type ServicesNécessairesStockage = {
  dossier: ServiceDossier;
};

type RetourDémarrageStockage = { stockageLocal: Datastore };

const estStockageDonnéesFermable = (
  x: Datastore,
): x is Datastore & { close: () => Promise<void> } => {
  return (x as FsDatastore | IDBDatastore).close !== undefined;
};

export class ServiceStockage extends ServiceAppli<
  "stockage",
  ServicesNécessairesStockage,
  RetourDémarrageStockage
> {
  constructor({
    services,
    options,
  }: {
    services: ServicesNécessairesStockage;
    options: OptionsAppli;
  }) {
    super({
      clef: "stockage",
      dépendances: ["dossier"],
      services,
      options,
    });
  }

  async démarrer() {
    const dossier = await this.service("dossier").dossier();
    const fichier = join(dossier, "stockage");
    const stockageLocal = await obtStockageDonnées(fichier);

    this.estDémarré = { stockageLocal };

    return await super.démarrer();
  }

  async fermer(): Promise<void> {
    const { stockageLocal } = await this.démarré();

    if (estStockageDonnéesFermable(stockageLocal)) await stockageLocal.close();

    await super.fermer();
  }

  async obtenirItem({ clef }: { clef: string }): Promise<string | null> {
    const { stockageLocal } = await this.démarré();
    try {
      return new TextDecoder().decode(await stockageLocal.get(new Key(clef)));
    } catch (e) {
      if (e.name === NotFoundError.name) return null;
      throw e;
    }
  }

  async sauvegarderItem({
    clef,
    valeur,
  }: {
    clef: string;
    valeur: string;
  }): Promise<void> {
    const { stockageLocal } = await this.démarré();
    await stockageLocal.put(new Key(clef), new TextEncoder().encode(valeur));
  }

  async effacerItem({ clef }: { clef: string }) {
    const { stockageLocal } = await this.démarré();
    return stockageLocal.delete(new Key(clef));
  }
}

export const serviceStockage =
  () =>
  ({
    services,
    options,
  }: {
    services: ServicesNécessairesStockage;
    options: OptionsAppli;
  }) => {
    return new ServiceStockage({ services, options });
  };
