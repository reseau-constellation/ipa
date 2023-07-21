import initSFIP from "../src/sfip/index.js";
import { expect } from "aegir/chai";
import type { IPFS } from "ipfs-core";
import { isElectronMain, isNode, isWebWorker } from "wherearewe";

describe("SFIP", function () {
  let sfip: IPFS;
  let dossier: string | undefined = undefined;

  before(async () => {
    if (isNode || isElectronMain) {
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");
      dossier = fs.mkdtempSync(path.join(os.tmpdir(), "constl-ipa"));
    }
    sfip = await initSFIP(dossier);
  });

  it("Initialiser", async () => {
    const id = await sfip.id();
    expect(id.id.toCID().toString()).to.be.a.string;
  });

  it("Connexion à un serveur webrtc-star", async () => {
    if (!isWebWorker) {
      await new Promise<void>((résoudre) => {
        // @ts-expect-error libp2p n'est pas dans les déclarations de SFIP
        sfip.libp2p.addEventListener("peer:connect", async () => {
          const pairs = await sfip.swarm.peers();
          const trouvé = pairs.find((p) =>
            p.addr.toString().includes("p2p-webrtc-star")
          );
          if (trouvé) {
            résoudre();
          }
        });
      });
    }
  });
  after(async () => {
    if (sfip) sfip.stop();
    if (dossier) {
      if (isNode || isElectronMain) {
        const { sync } = await import("rimraf");
        sync(dossier);
      }
    }
  });
});
