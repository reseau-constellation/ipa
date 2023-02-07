import { webSockets } from "@libp2p/websockets";
import type { create } from "ipfs";
const config: Parameters<typeof create>[0] = {
  libp2p: {
    transports: [webSockets()],
  },
};
export default config;
