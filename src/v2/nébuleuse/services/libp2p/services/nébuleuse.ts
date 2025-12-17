import { serviceCapabilities, serviceDependencies } from "@libp2p/interface";
import { PROTOCOLE_RÉSEAUTAGE } from "./const.js";
import type { Connection, PeerId, Startable } from "@libp2p/interface";
import type { Registrar } from "@libp2p/interface-internal";

// https://github.com/libp2p/js-libp2p/blob/main/doc/SERVICES.md

interface ComposantesConnecteurNébuleuse {
  registrar: Registrar;
}

class ConnecteurNébuleuse implements Startable {
  private readonly components: ComposantesConnecteurNébuleuse;
  private topologyId?: string;

  constructor(components: ComposantesConnecteurNébuleuse) {
    this.components = components;
  }

  // this property is used as a human-friendly name for the service
  readonly [Symbol.toStringTag] = "Réseautage Nébuleuse";

  // this service provides these capabilities to the node
  readonly [serviceCapabilities]: string[] = ["@constl/réseautage"];

  // this service requires Identify to be configured on the current node
  readonly [serviceDependencies]: string[] = ["@libp2p/identify"];

  async start(): Promise<void> {
    this.topologyId = await this.components.registrar.register(
      PROTOCOLE_RÉSEAUTAGE,
      {
        onConnect: (pair, connexion) => {
          this.gérerConnexion({ pair, connexion });
        },
        onDisconnect: (pair: PeerId) => {},
        notifyOnLimitedConnection: true,
      },
    );
  }

  gérerConnexion({ pair, connexion }: { pair: PeerId; connexion: Connection }) {
    connexion;
  }

  stop(): void {
    if (this.topologyId != null) {
      this.components.registrar.unregister(this.topologyId);
    }
  }
}

export default function connecteurNébuleuse() {
  return (composantes: ComposantesConnecteurNébuleuse) => {
    return new ConnecteurNébuleuse(composantes);
  };
}
