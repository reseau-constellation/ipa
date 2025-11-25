import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { webSockets } from "@libp2p/websockets";
import { webTransport } from "@libp2p/webtransport";
import { obtOptionsLibp2pNavigateur } from "./navigateur.js";
import type { ConfigOptionsLibp2p, ServicesLibp2pCrabeDéfaut } from "./utils.js";
import type { Libp2pOptions } from "libp2p";

export const obtOptionsLibp2pTravailleur = async (
  config: ConfigOptionsLibp2p,
): Promise<Libp2pOptions<ServicesLibp2pCrabeDéfaut>> => {
  const configNavigateur = await obtOptionsLibp2pNavigateur(config);

  const configTravailleur = {
    ...configNavigateur,
    transports: [webSockets(), webTransport(), circuitRelayTransport()],
    addresses: {
      listen: ["/webrtc", "/webtransport", "/p2p-circuit"],
    },
  };
  return configTravailleur;
};
