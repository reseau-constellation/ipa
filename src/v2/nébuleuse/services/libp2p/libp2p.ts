import { ServiceAppli } from "../../appli/index.js";
import { STATUTS } from "../../appli/consts.js";
import type { Oublier, Suivi } from "../../types.js";
import type { Libp2p } from "libp2p";
import type { Identify, IdentifyPush } from "@libp2p/identify";
import type { GossipSub } from "@libp2p/gossipsub";
import type { PeerUpdate, ServiceMap } from "@libp2p/interface";
import type { ServiceClefPrivée } from "./config/utils.js";
import type { OptionsAppli } from "../../appli/appli.js";
import type { Ping } from "@libp2p/ping";
import type { ServiceHélia, ServicesNécessairesHélia } from "../hélia.js";

export type ServicesLibp2pNébuleuse = {
  identify: Identify;
  identifyPush: IdentifyPush;
  pubsub: GossipSub;
  obtClefPrivée: ServiceClefPrivée;
  ping: Ping;
} & ServiceMap;

export interface OptionsServiceLibp2p {
  a?: number;
}

export type ServicesNécessairesLibp2p<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> = ServicesNécessairesHélia & {
  hélia: ServiceHélia<L>;
};

type RetourDémarrageLibp2p<L extends ServicesLibp2pNébuleuse> = {
  libp2p?: Libp2p<L>;
  oublierReconnecteur?: () => void;
};

export class ServiceLibp2p<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> extends ServiceAppli<
  "libp2p",
  ServicesNécessairesLibp2p<L>,
  RetourDémarrageLibp2p<L>,
  OptionsServiceLibp2p
> {
  signaleurArrêt: AbortController;

  constructor({
    services,
    options,
  }: {
    services: ServicesNécessairesLibp2p<L>;
    options: OptionsServiceLibp2p & OptionsAppli;
  }) {
    super({
      clef: "libp2p",
      services,
      dépendances: ["stockage", "dossier", "hélia"],
      options,
    });

    this.signaleurArrêt = new AbortController();
  }

  async démarrer() {
    // Réinitialiser le signaleur, mais uniquement si nécessaire.
    if (this.signaleurArrêt.signal.aborted)
      this.signaleurArrêt = new AbortController();

    const libp2p = (await this.service("hélia").hélia()).libp2p;

    // À faire : créer un gestionnaire de pairs plus idiomatique et efficace
    const chrono = setInterval(async () => {
      const pairsConnus = await libp2p.peerStore.all();
      const connexions = libp2p.getPeers().map((p) => p.toString());
      for (const connu of pairsConnus) {
        if (!connexions.some((id) => id.toString() === connu.id.toString())) {
          try {
            await libp2p.dial(connu.id, { signal: this.signaleurArrêt.signal });
          } catch {
            // Tant pis...
          }
        }
      }
    }, 3000);

    const idLibp2p = libp2p.peerId.toString();
    libp2p.addEventListener("peer:connect", (x) => {
      console.log(
        "✔ peer:connect",
        "de",
        idLibp2p.slice(-10),
        x.detail.toString(),
      );
    });
    libp2p.addEventListener("connection:open", (x) => {
      console.log(
        "✔ connection:open",
        "de",
        idLibp2p.slice(-10),
        x.detail.remoteAddr.toString(),
      );
    });
    libp2p.addEventListener("connection:close", async (x) => {
      console.log(
        "✘ connexion:close",
        "de",
        idLibp2p.slice(-10),
        x.detail.remoteAddr.toString(),
      );
    });
    libp2p.addEventListener("peer:disconnect", async ({ detail: idPair }) => {
      console.log(
        "✘ peer:disconnect",
        "de",
        idLibp2p.slice(-10),
        idPair.toString(),
      );
      const connexions = libp2p
        .getConnections()
        .filter((c) =>
          c.remoteAddr.toString().includes(`${idPair.toString()}/p2p-circuit/`),
        );
      await Promise.allSettled(connexions.map((c) => c.close()));
    });

    if (this.estDémarré === false) this.estDémarré = {};
    this.estDémarré.oublierReconnecteur = () => clearInterval(chrono);

    return await super.démarrer();
  }

  async libp2p(): Promise<Libp2p<L>> {
    return (await this.service("hélia").hélia()).libp2p;
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
    this.statut = STATUTS.FERMETURE_EN_COURS;

    this.signaleurArrêt.abort();

    oublierReconnecteur?.();
    // Uniquement fermer libp2p s'il n'a pas été fourni dans les options
    if (libp2p) await libp2p.stop();

    await super.fermer();
  }
}

export const serviceLibp2p =
  <L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse>(
    optionsLibp2p?: OptionsServiceLibp2p,
  ) =>
  ({
    options,
    services,
  }: {
    options: OptionsAppli;
    services: ServicesNécessairesLibp2p<L>;
  }) => {
    return new ServiceLibp2p<L>({
      services,
      options: { ...optionsLibp2p, ...options },
    });
  };
