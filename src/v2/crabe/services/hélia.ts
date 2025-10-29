import { join } from "path";
import { Libp2p } from "libp2p";
import { Helia, HeliaInit, createHelia } from "helia";
import { isElectronMain, isNode } from "wherearewe";
import { IDBBlockstore } from "blockstore-idb";

import { unixfs } from "@helia/unixfs";
import { toBuffer } from "@constl/utils-ipa";
import { CID } from "multiformats";
import {
  Nébuleuse,
  OptionsNébuleuse,
  ServiceNébuleuse,
} from "../../nébuleuse/index.js";
import {
  ServicesLibp2pCrabe,
  ServicesNécessairesLibp2p,
} from "./libp2p/libp2p.js";
import { obtStockageDonnées } from "./utils.js";
import { ServiceOrbite } from "./orbite/orbite.js";

export type OptionsServiceHélia<
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> = {
  hélia: Helia<Libp2p<L>>;
};

export type ServicesNécessairesHélia<
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> = ServicesNécessairesLibp2p<L> & {
  hélia: ServiceHélia<L>;
};

export const extraireHéliaDesOptions = <L extends ServicesLibp2pCrabe>(
  options: OptionsNébuleuse<{
    orbite: ServiceOrbite<L>;
    hélia: ServiceHélia<L>;
  }>,
): Helia<Libp2p<L>> | undefined => {
  const optionsServices = options.services;
  if (optionsServices?.orbite?.orbite) {
    return optionsServices.orbite.orbite.ipfs;
  } else return optionsServices?.hélia?.hélia;
};

export class ServiceHélia<
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> extends ServiceNébuleuse<
  "hélia",
  ServicesNécessairesHélia<L>,
  { hélia?: Helia<Libp2p<L>> },
  OptionsServiceHélia<L>
> {
  constructor({
    nébuleuse,
    options,
  }: {
    nébuleuse: Nébuleuse<ServicesNécessairesHélia<L>>;
    options?: OptionsServiceHélia<L>;
  }) {
    super({
      clef: "hélia",
      nébuleuse,
      dépendances: ["libp2p"],
      options,
    });
  }

  async démarrer(): Promise<{ hélia?: Helia<Libp2p<L>> }> {
    let hélia = extraireHéliaDesOptions<L>(this.nébuleuse.options);
    if (!hélia) {
      const libp2p = await this.service("libp2p").libp2p();

      const dossierRacine = await this.nébuleuse.dossier();
      const dossierHélia = join(dossierRacine, "hélia");

      hélia = await createHelia(
        await obtenirOptionsHélia({ libp2p, dossierHélia }),
      );
      this.estDémarré = { hélia };
    }
    return await super.démarrer();
  }

  async hélia(): Promise<Helia<Libp2p<L>>> {
    // Si `hélia` n'est pas défini dans les options, il sera rendu par `this.démarré`
    return (
      extraireHéliaDesOptions(this.nébuleuse.options) ||
      (await this.démarré()).hélia!
    );
  }

  async fermer(): Promise<void> {
    // Uniquement fermer hélia si elle n'a pas été fournie dans les options
    const { hélia } = await this.démarré();
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
  }: {
    id: string;
  }): Promise<AsyncIterable<Uint8Array>> {
    const hélia = await this.hélia();
    const fs = unixfs(hélia);
    const [idc, nomFichier] = id.split("/");
    return fs.cat(CID.parse(idc), { path: nomFichier });
  }
}

export const obtenirOptionsHélia = async <L extends ServicesLibp2pCrabe>({
  libp2p,
  dossierHélia,
}: {
  libp2p: Libp2p<L>;
  dossierHélia: string;
}): Promise<Partial<HeliaInit<Libp2p<L>>>> => {
  const dossierDonnées = `${dossierHélia}/données`;
  const dossierBlocs = `${dossierHélia}/blocs`;

  // Importer FsBlockstore et FsDatastore dynamiquement pour éviter les erreurs
  // de compilation sur le navigateur
  const stockageBlocs =
    isNode || isElectronMain
      ? new (await import("blockstore-fs")).FsBlockstore(dossierBlocs)
      : new IDBBlockstore(dossierBlocs);
  const stockageDonnées = await obtStockageDonnées(dossierDonnées);

  // Ouverture manuelle requise pour une drôle de raison pour l'instant.
  if (!(isNode || isElectronMain)) {
    await stockageBlocs.open();
  }

  const optionsHelia: Partial<HeliaInit<Libp2p<L>>> = {
    blockstore: stockageBlocs,
    datastore: stockageDonnées,
    libp2p,
  };

  return optionsHelia;
};
