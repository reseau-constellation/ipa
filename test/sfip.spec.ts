import initSFIP from "../src/sfip/index.js";
import { expect } from "aegir/chai";
import type { IPFS } from "ipfs-core";

describe("SFIP", function () {
  let sfip: IPFS;
  before(async () => {
    sfip = await initSFIP();
  });
  it("Initialiser", async () => {
    const id = await sfip.id();
    expect(id.id.toCID().toString()).to.be.a.string;
  }, 10000);
  it("Connexion à un serveur webrtc-star", async () => {
    await new Promise<void>((résoudre) => {
      // @ts-expect-error libp2p n'est pas dans les déclarations de SFIP
      sfip.libp2p.addEventListener("peer:connect", async () => {
        const pairs = await sfip.swarm.peers();
        console.log({ pairs });
        const trouvé = pairs.find((p) =>
          p.addr.toString().includes("arcane-springs")
        );
        if (trouvé) {
          console.log(trouvé.addr.toString());
          résoudre();
        }
      });
    });
  });
  after(async () => {
    await sfip.stop();
  });
});
