import { join } from "path";
import { createLibp2p, isLibp2p } from "libp2p";
import {
  fromString as uint8ArrayFromString,
  toString as uint8ArrayToString,
} from "uint8arrays";
import { keys } from "@libp2p/crypto";
import { ServiceAppli } from "../../appli/index.js";
import { obtenirOptionsLibp2p } from "./config/index.js";
import type { ServiceDossier } from "../dossier.js";
import type { Oublier, Suivi } from "../../types.js";
import type { Libp2p, Libp2pOptions } from "libp2p";
import type { Identify } from "@libp2p/identify";
import type { GossipSub } from "@chainsafe/libp2p-gossipsub";
import type { PeerUpdate, PrivateKey, ServiceMap } from "@libp2p/interface";
import type { ServiceStockage } from "../stockage.js";

import type { ServiceClefPrivée } from "./config/utils.js";
import type { OptionsAppli } from "../../appli/appli.js";

export type ServicesLibp2pNébuleuse = {
  identify: Identify;
  pubsub: GossipSub;
  obtClefPrivée: ServiceClefPrivée;
} & ServiceMap;

export interface OptionsServiceLibp2p<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> {
  libp2p?:
    | Libp2p<L>
    | ((args: {
        dossier: string;
        clefPrivée?: PrivateKey;
      }) => Promise<Libp2pOptions<L>>);
}

export type ServicesNécessairesLibp2p = {
  dossier: ServiceDossier;
  stockage: ServiceStockage;
};

type RetourDémarrageLibp2p<L extends ServicesLibp2pNébuleuse> = {
  libp2p?: Libp2p<L>;
  oublierReconnecteur?: () => void;
};

export class ServiceLibp2p<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> extends ServiceAppli<
  "libp2p",
  ServicesNécessairesLibp2p,
  RetourDémarrageLibp2p<L>,
  OptionsServiceLibp2p<L>
> {
  constructor({
    services,
    options,
  }: {
    services: ServicesNécessairesLibp2p;
    options: OptionsServiceLibp2p<L> & OptionsAppli;
  }) {
    super({
      clef: "libp2p",
      services,
      dépendances: ["stockage", "dossier"],
      options,
    });
  }

  async démarrer() {
    let libp2p = this.options.libp2p;

    if (!isLibp2p(libp2p)) {
      if (
        this.options.libp2p !== undefined &&
        typeof this.options.libp2p !== "function"
      )
        throw new Error(
          "L'option `libp2p` doit être une fonction qui génère la configuration libp2p.",
        );

      const générateurOptions = this.options.libp2p || obtenirOptionsLibp2p();

      const dossier = await this.service("dossier").dossier();
      const dossierLibp2p = join(dossier, "libp2p");

      const clefPrivée = await this.obtenirClefPrivée();

      const configLibp2p = await générateurOptions({
        dossier: dossierLibp2p,
        clefPrivée,
      });

      // Il faut accéder configLibp2p.privateKey *avant* d'appeler `createLibp2p` parce que ce dernier
      // modifie l'objet `configLibp2p` et lui ajoute la clef générée.
      const clefPrivéeExistante = configLibp2p.privateKey;

      libp2p = await createLibp2p<L>(configLibp2p as Libp2pOptions<L>);

      // Uniquement rendre `libp2p` s'il a été créé ici.
      this.estDémarré = { libp2p };

      // Sauvegarder la clef privée si elle a été générée automatiquement par libp2p
      if (!clefPrivéeExistante) await this.sauvegarderClefPrivée({ libp2p });
    }

    // À faire : créer un gestionnaire de pairs plus idiomatique et efficace
    const chrono = setInterval(async () => {
      const pairsConnus = await libp2p.peerStore.all();

      for (const connu of pairsConnus) {
        try {
          await libp2p.dial(connu.id);
        } catch {
          // Tant pis...
        }
      }
    }, 1000);
    libp2p.addEventListener("peer:discovery", async (x) => {
      try {
        await libp2p.dial(x.detail.id);
      } catch {
        // Tant pis...
      }
    });
    libp2p.addEventListener("peer:update", async (x) => {
      try {
        await libp2p.dial(x.detail.peer.id);
      } catch {
        // Tant pis...
      }
    });
    libp2p.addEventListener("peer:disconnect", async ({ detail: idPair }) => {
      const connexions = libp2p
        .getConnections()
        .filter((c) =>
          c.remoteAddr.toString().includes(`${idPair.toString()}/p2p-circuit/`),
        );
      await Promise.all(connexions.map((c) => c.close()));
    });

    if (this.estDémarré === false) this.estDémarré = {};
    this.estDémarré.oublierReconnecteur = () => clearInterval(chrono);

    return await super.démarrer();
  }

  async libp2p(): Promise<Libp2p<L>> {
    // Si `libp2p` n'est pas définie et de type `Libp2p` dans les options, elle sera rendu par `this.démarré`
    return isLibp2p(this.options.libp2p)
      ? this.options.libp2p
      : (await this.démarré()).libp2p!;
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

    await this.service("stockage").sauvegarderItem({
      clef: "idPairLibp2p",
      valeur: texteNouvelleClefPrivée,
    });
  }

  async suivreMesAdresses({ f }: { f: Suivi<string[]> }): Promise<Oublier> {
    const libp2p = await this.libp2p();
    const adressesActuelles = libp2p.getMultiaddrs().map((a) => a.toString());
    await f(adressesActuelles);

    const fSuivi = async (é: CustomEvent<PeerUpdate>) => {
      const adresses = é.detail.peer.addresses.map((a) =>
        a.multiaddr.toString(),
      );
      await f(adresses);
    };

    libp2p.addEventListener("self:peer:update", fSuivi);
    return async () => libp2p.removeEventListener("self:peer:update", fSuivi);
  }

  async fermer(): Promise<void> {
    const { libp2p, oublierReconnecteur } = await this.démarré();
    oublierReconnecteur?.();
    // Uniquement fermer libp2p s'il n'a pas été fourni dans les options
    if (libp2p) await libp2p.stop();

    await super.fermer();
  }
}

export const serviceLibp2p =
  <L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse>(
    optionsLibp2p?: OptionsServiceLibp2p<L>,
  ) =>
  ({
    options,
    services,
  }: {
    options: OptionsAppli;
    services: ServicesNécessairesLibp2p;
  }) => {
    return new ServiceLibp2p<L>({
      services,
      options: { ...optionsLibp2p, ...options },
    });
  };
