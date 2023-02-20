import { webSockets } from "@libp2p/websockets";
import type { create } from "ipfs-core";
import { webTransport } from "@libp2p/webtransport";

const config: Parameters<typeof create>[0] = {
  libp2p: {
    transports: [webSockets(), webTransport()],
  },
};
export default config;
