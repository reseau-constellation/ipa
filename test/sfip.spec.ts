import initSFIP from "../src/sfip/index.js";
import { expect } from "aegir/chai";
import type { Helia } from "helia";
import { isElectronMain, isNode, isWebWorker } from "wherearewe";

describe("SFIP", function () {
  let sfip: Helia;
  let dossier: string | undefined = undefined;

  before(async () => {
    if (isNode || isElectronMain) {
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");
      dossier = fs.mkdtempSync(path.join(os.tmpdir(), "constl-ipa-"));
    }
    sfip = await initSFIP(dossier);
  });

  it("Initialiser", async () => {
    const id = await sfip.libp2p.peerId;
    expect(id).to.be.a.string;
  });

  it("Connexion à un serveur webrtc-star", async () => {
    if (!isWebWorker) {
      await new Promise<void>((résoudre) => {
        sfip.libp2p.addEventListener("peer:connect", async () => {
          const pairs = sfip.libp2p.getPeers();
          const trouvé = pairs.find((p) =>
            p.toString().includes("p2p-webrtc-star"),
          );
          if (trouvé) {
            résoudre();
          }
        });
      });
    }
  });
  after(async () => {
    // Ça coince pour toujours avec Électron principal. Peut-être que ça sera mieux avec Hélia...
    if (!isElectronMain) await sfip.stop();
    if (dossier) {
      if (isNode) {
        // Pas pour Électron principal parce que nous n'avons pas appellé sfip.stop() ci-dessus
        const { sync } = await import("rimraf");
        sync(dossier);
      }
    }
  });
});
