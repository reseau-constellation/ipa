import { join } from "path";
import { createHelia } from "helia";
import { unixfs } from "@helia/unixfs";
import { toBuffer } from "@constl/utils-ipa";
import { CID } from "multiformats";
import { loadOrCreateSelfKey } from "@libp2p/config";
import { ServiceAppli } from "../appli/index.js";
import { STATUTS } from "../appli/consts.js";
import { obtenirOptionsLibp2p } from "./libp2p/config/index.js";
import { obtStockageBlocs, obtStockageDonnées } from "./utils.js";

import type { OptionsAppli } from "../appli/appli.js";
import type { ServicesLibp2pNébuleuse } from "./libp2p/libp2p.js";
import type { HeliaInit } from "helia";
import type { Libp2p, Libp2pOptions } from "libp2p";
import type { CreateLibp2pOptions, HeliaWithLibp2p } from "@helia/libp2p";
import type { ServiceDossier } from "./dossier.js";
import type { ServiceStockage } from "./stockage.js";
import type { PrivateKey, ServiceMap } from "@libp2p/interface";
import type { BitswapOptions } from "@helia/bitswap";
import type { Datastore } from "interface-datastore";

export type CréerHélia<L extends ServiceMap> = (
  init?: HeliaInit & {
    libp2p?: CreateLibp2pOptions<L>;
    bitswap?: BitswapOptions;
  },
) => HeliaWithLibp2p<L>;
export type OptionsServiceHélia<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> = {
  hélia?: HeliaWithLibp2p<L> | CréerHélia<L>;
  libp2p?: (args: {
    dossier: string;
    clefPrivée?: PrivateKey;
  }) => Promise<Libp2pOptions<L>>;
};

export type ServicesNécessairesHélia = {
  dossier: ServiceDossier;
  stockage: ServiceStockage;
};

type RetourDémarrageHélia<L extends ServicesLibp2pNébuleuse> = {
  hélia?: HeliaWithLibp2p<L>;
};

export class ServiceHélia<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> extends ServiceAppli<
  "hélia",
  ServicesNécessairesHélia,
  RetourDémarrageHélia<L>,
  OptionsServiceHélia<L>
> {
  constructor({
    services,
    options,
  }: {
    services: ServicesNécessairesHélia;
    options: OptionsServiceHélia<L> & OptionsAppli;
  }) {
    super({
      clef: "hélia",
      services,
      dépendances: ["dossier", "stockage"],
      options,
    });
  }

  async démarrer() {
    if (!this.options.hélia || typeof this.options.hélia === "function") {
      const générateurOptions = this.options.libp2p || obtenirOptionsLibp2p();

      const dossier = await this.service("dossier").dossier();
      const dossierLibp2p = join(dossier, "libp2p");
      const dossierHélia = join(dossier, "hélia");

      const optionsHélia = await obtenirOptionsHélia({ dossierHélia });
      const clefPrivée = await loadOrCreateSelfKey(optionsHélia.datastore);

      const configLibp2p = (await générateurOptions({
        dossier: dossierLibp2p,
        clefPrivée,
      })) as Libp2pOptions<L>;

      const créerHélia = this.options.hélia ?? createHelia;
      const hélia = await créerHélia({
        ...optionsHélia,
        libp2p: { ...configLibp2p },
      }).start();

      this.estDémarré = { hélia };
    }

    return await super.démarrer();
  }

  async hélia(): Promise<HeliaWithLibp2p<L>> {
    // Si `hélia` n'est pas défini dans les options, il sera rendu par `this.démarré`
    return this.options.hélia && typeof this.options.hélia !== "function"
      ? this.options.hélia
      : (await this.démarré()).hélia!;
  }

  async fermer(): Promise<void> {
    // Uniquement fermer hélia si elle n'a pas été fournie dans les options
    const { hélia } = await this.démarré();
    this.statut = STATUTS.FERMETURE_EN_COURS;
    if (hélia) await hélia.stop();

    await super.fermer();
  }

  // Opérations Hélia

  async ajouterFichierÀSFIP({
    contenu,
    nomFichier,
  }: {
    contenu: Uint8Array;
    nomFichier: string;
  }): Promise<string> {
    const hélia = await this.hélia();
    const fs = unixfs(hélia);
    const idc = await fs.addFile({ content: contenu, path: nomFichier });
    return idc.toString() + "/" + nomFichier;
  }

  async obtFichierDeSFIP({
    id,
    max,
  }: {
    id: string;
    max?: number;
  }): Promise<Uint8Array | null> {
    return await toBuffer(await this.obtItérableAsyncSFIP({ id }), max);
  }

  async obtItérableAsyncSFIP({
    id,
    signal,
  }: {
    id: string;
    signal?: AbortSignal;
  }): Promise<AsyncIterable<Uint8Array>> {
    const hélia = await this.hélia();
    const fs = unixfs(hélia);
    const [idc, nomFichier] = id.split("/");
    return fs.cat(CID.parse(idc), { path: nomFichier, signal });
  }
}

// Méthodes internes

export const obtenirOptionsHélia = async ({
  dossierHélia,
}: {
  dossierHélia: string;
}): Promise<HeliaInit & { datastore: Datastore }> => {
  const dossierDonnées = join(dossierHélia, "données");
  const dossierBlocs = join(dossierHélia, "blocs");

  const stockageBlocs = await obtStockageBlocs(dossierBlocs);
  const stockageDonnées = await obtStockageDonnées(dossierDonnées);

  const optionsHelia: HeliaInit & { datastore: Datastore } = {
    blockstore: stockageBlocs,
    datastore: stockageDonnées,
  };

  return optionsHelia;
};

export const serviceHélia =
  <L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse>(
    optionsHélia?: OptionsServiceHélia<L>,
  ) =>
  ({
    options,
    services,
  }: {
    options: OptionsAppli;
    services: ServicesNécessairesHélia;
  }) => {
    return new ServiceHélia<L>({
      services,
      options: { ...optionsHélia, ...options },
    });
  };
