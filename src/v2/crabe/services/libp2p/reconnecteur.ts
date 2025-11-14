import { BootstrapComponents } from "@libp2p/bootstrap";
import { multiaddr } from "@multiformats/multiaddr";
import { peerIdFromString } from "@libp2p/peer-id";
import { P2P } from "@multiformats/mafmt";
import { obtIdPairAdresse } from "./config/utils.js";
import type { Logger, PeerInfo, Startable } from "@libp2p/interface";

const FRÉQUENCE_RECONNECTEUR_PAR_DÉFAUT = 10_000;

export interface InitReconnecteur {
  liste: string[];
  fréquence?: number;
}

export class Reconnecteur implements Startable {
  static tag = "reconnecteur";

  private readonly log: Logger;
  private intervale?: ReturnType<typeof setInterval>;
  private readonly liste: PeerInfo[];
  private readonly fréquence: number;
  private readonly components: BootstrapComponents;

  constructor(
    components: BootstrapComponents,
    options: InitReconnecteur = { liste: [] },
  ) {
    this.components = components;
    this.log = components.logger.forComponent("constl:reconnecteur");

    this.fréquence = options.fréquence ?? FRÉQUENCE_RECONNECTEUR_PAR_DÉFAUT;

    this.liste = [];

    for (const candidate of options.liste) {
      if (!P2P.matches(candidate)) {
        this.log.error("Multiadresse invalide");
        continue;
      }

      const ma = multiaddr(candidate);
      const chaîneIdPair = obtIdPairAdresse(ma);

      if (chaîneIdPair == null) {
        this.log.error(
          "Multiadresse invalide car elle n'a pas d'identifiant de pair",
        );
        continue;
      }

      const infoPair: PeerInfo = {
        id: peerIdFromString(chaîneIdPair),
        multiaddrs: [ma],
      };

      this.liste.push(infoPair);
    }
  }

  start(): void | Promise<void> {
    this.intervale = setInterval(() => {
      const connectionsPairs =
        this.components.connectionManager.getConnectionsMap();
      if (connectionsPairs.size > 0) return;

      for (const pair of this.liste) {
        if (connectionsPairs.has(pair.id)) continue;
        this.components.connectionManager
          .openConnection(pair.id)
          .catch((err) => {
            this.log.error("Erreur de connexion au pair %p", pair.id, err);
          });
      }
    }, this.fréquence);
  }

  stop(): void {
    if (this.intervale !== undefined) {
      clearInterval(this.intervale);
    }
    this.intervale = undefined;
  }
}

export function reconnecteur(
  init: InitReconnecteur,
): (components: BootstrapComponents) => Reconnecteur {
  return (components: BootstrapComponents) =>
    new Reconnecteur(components, init);
}
