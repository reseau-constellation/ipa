import { join } from "path";
import { Libp2p, Libp2pOptions, createLibp2p, isLibp2p } from "libp2p";
import { Identify } from "@libp2p/identify";
import { GossipSub } from "@chainsafe/libp2p-gossipsub";
import {
  fromString as uint8ArrayFromString,
  toString as uint8ArrayToString,
} from "uint8arrays";
import { PrivateKey, ServiceMap } from "@libp2p/interface";
import { keys } from "@libp2p/crypto";
import {
  Nébuleuse,
  OptionsNébuleuse,
  ServiceNébuleuse,
} from "../../../nébuleuse/index.js";
import { ServiceStockage } from "../stockage.js";

import { ServiceOrbite } from "../orbite/index.js";
import { ServiceHélia } from "../hélia.js";
import { obtenirOptionsLibp2p } from "./config/index.js";
import { ServiceClefPrivée } from "./config/utils.js";

export type ServicesLibp2pCrabe = {
  identify: Identify;
  pubsub: GossipSub;
  obtClefPrivée: ServiceClefPrivée;
} & ServiceMap;

export interface OptionsServiceLibp2p<
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> {
  libp2p:
    | Libp2p<L>
    | ((args: {
        dossier: string;
        clefPrivée?: PrivateKey;
      }) => Promise<Libp2pOptions<L>>);
}

export type ServicesNécessairesLibp2p<
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> = {
  stockage: ServiceStockage;
  libp2p: ServiceLibp2p<L>;
};

export const extraireLibp2pDesOptions = <L extends ServicesLibp2pCrabe>(
  options: OptionsNébuleuse<{
    orbite: ServiceOrbite<L>;
    hélia: ServiceHélia<L>;
    libp2p: ServiceLibp2p<L>;
  }>,
): Libp2p<L> | undefined => {
  const optsServices = options.services;
  const hélia =
    optsServices?.orbite?.orbite?.ipfs || optsServices?.hélia?.hélia;

  if (hélia) return hélia.libp2p;

  return isLibp2p(optsServices?.libp2p?.libp2p)
    ? optsServices?.libp2p?.libp2p
    : undefined;
};

export class ServiceLibp2p<
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> extends ServiceNébuleuse<
  "libp2p",
  ServicesNécessairesLibp2p<L>,
  { libp2p?: Libp2p<L> },
  OptionsServiceLibp2p<L>
> {
  constructor({
    nébuleuse,
    options,
  }: {
    nébuleuse: Nébuleuse<ServicesNécessairesLibp2p<L>>;
    options?: OptionsServiceLibp2p<L>;
  }) {
    super({
      clef: "libp2p",
      nébuleuse,
      dépendances: ["stockage"],
      options,
    });
  }

  async démarrer(): Promise<{ libp2p?: Libp2p<L> }> {
    let libp2p = extraireLibp2pDesOptions<L>(this.nébuleuse.options);

    if (!isLibp2p(libp2p)) {
      if (typeof this.options.libp2p !== "function")
        throw new Error("Ça devrait être impossible d'arriver à cette erreur");

      const générateurOptions = this.options.libp2p || obtenirOptionsLibp2p();

      const dossierRacine = await this.nébuleuse.dossier();
      const dossierLibp2p = join(dossierRacine, "libp2p");

      const clefPrivée = await this.obtenirClefPrivée();

      const configLibp2p = await générateurOptions({
        dossier: dossierLibp2p,
        clefPrivée,
      });

      libp2p = await createLibp2p<L>(configLibp2p);

      // Uniquement rendre `libp2p` s'il a été créé ici.
      this.estDémarré = { libp2p };

      // Sauvegarder la clef privée si elle a été générée automatiquement par libp2p
      if (!configLibp2p.privateKey)
        await this.sauvegarderClefPrivée({ libp2p });
    }

    // À faire : créer un gestionnaire de pairs plus idiomatique et efficace
    libp2p.addEventListener("peer:discovery", async (x) => {
      try {
        await libp2p.dial(x.detail.id);
      } catch {
        // Tant pis...
      }
    });

    return await super.démarrer();
  }

  async libp2p(): Promise<Libp2p<L>> {
    // Si `libp2p` n'est pas défini dans les options, il sera rendu par `this.démarré`
    return (
      extraireLibp2pDesOptions(this.nébuleuse.options) ||
      (await this.démarré()).libp2p!
    );
  }

  async obtenirClefPrivée(): Promise<PrivateKey | undefined> {
    const texteClefPrivée =
      await this.service("stockage").obtenirItem("idPairLibp2p");
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
    await this.service("stockage").sauvegarderItem(
      "idPairLibp2p",
      texteNouvelleClefPrivée,
    );
  }

  async fermer(): Promise<void> {
    // Uniquement fermer libp2p s'il n'a pas été fourni dans les options
    const { libp2p } = await this.démarré();
    if (libp2p) await libp2p.stop();

    await super.fermer();
  }
}
