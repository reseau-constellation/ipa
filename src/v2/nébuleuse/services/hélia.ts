import { join } from "path";
import { createHelia } from "helia";
import { isElectronMain, isNode } from "wherearewe";
import { IDBBlockstore } from "blockstore-idb";
import {
  fromString as uint8ArrayFromString,
  toString as uint8ArrayToString,
} from "uint8arrays";
import { keys } from "@libp2p/crypto";

import { unixfs } from "@helia/unixfs";
import { toBuffer } from "@constl/utils-ipa";
import { CID } from "multiformats";
import { ServiceAppli } from "../appli/index.js";
import { STATUTS } from "../appli/consts.js";
import { obtenirOptionsLibp2p } from "./libp2p/config/index.js";
import { obtStockageDonnées } from "./utils.js";
import type { OptionsAppli } from "../appli/appli.js";
import type { ServicesLibp2pNébuleuse } from "./libp2p/libp2p.js";
import type { HeliaInit } from "helia";
import type { Libp2p, Libp2pOptions } from "libp2p";
import type { HeliaWithLibp2p } from "@helia/libp2p";
import type { ServiceDossier } from "./dossier.js";
import type { ServiceStockage } from "./stockage.js";
import type { PrivateKey } from "@libp2p/interface";

export type OptionsServiceHélia<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> = {
  hélia?: HeliaWithLibp2p<L>;
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
    if (!this.options.hélia) {
      const générateurOptions = this.options.libp2p || obtenirOptionsLibp2p();

      const dossier = await this.service("dossier").dossier();
      const dossierLibp2p = join(dossier, "libp2p");

      const clefPrivée = await this.obtenirClefPrivée();

      const configLibp2p = (await générateurOptions({
        dossier: dossierLibp2p,
        clefPrivée,
      })) as Libp2pOptions<L>;

      // Il faut accéder configLibp2p.privateKey *avant* d'appeler `createLibp2p` parce que ce dernier
      // modifie l'objet `configLibp2p` et lui ajoute la clef générée.
      const clefPrivéeExistante = configLibp2p.privateKey;

      const dossierHélia = join(dossier, "hélia");

      const hélia = await createHelia({
        ...(await obtenirOptionsHélia({ dossierHélia })),
        libp2p: { ...configLibp2p },
      }).start();

      // Sauvegarder la clef privée si elle a été générée automatiquement par libp2p
      if (!clefPrivéeExistante)
        await this.sauvegarderClefPrivée({ libp2p: hélia.libp2p });

      this.estDémarré = { hélia };
    }
    return await super.démarrer();
  }

  async obtenirClefPrivée(): Promise<PrivateKey | undefined> {
    const texteClefPrivée = await this.service("stockage").obtenirItem({
      clef: "idPairLibp2p",
    });
    if (texteClefPrivée) {
      const encoded = uint8ArrayFromString(texteClefPrivée, "base64");
      return keys.privateKeyFromRaw(encoded);
    }
    return undefined;
  }

  async sauvegarderClefPrivée({ libp2p }: { libp2p: Libp2p<L> }) {
    const clefPrivéeGénérée = libp2p.services.obtClefPrivée.obtenirClef();
    const texteNouvelleClefPrivée = uint8ArrayToString(
      clefPrivéeGénérée.raw,
      "base64",
    );

    await this.service("stockage").sauvegarderItem({
      clef: "idPairLibp2p",
      valeur: texteNouvelleClefPrivée,
    });
  }

  async hélia(): Promise<HeliaWithLibp2p<L>> {
    // Si `hélia` n'est pas défini dans les options, il sera rendu par `this.démarré`
    return this.options.hélia || (await this.démarré()).hélia!;
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
}): Promise<HeliaInit> => {
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

  const optionsHelia: HeliaInit = {
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
