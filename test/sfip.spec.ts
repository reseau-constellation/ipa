import { ServicesLibp2p, initSFIP } from "../src/sfip/index.js";
import { expect } from "aegir/chai";
import type { HeliaLibp2p } from "helia";
import { isElectronMain, isNode } from "wherearewe";
import { dossiers } from "@constl/utils-tests";
import { Libp2p } from "@libp2p/interface";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { Constellation, créerConstellation } from "@/index.js";
import { obtIdsPairs } from "./utils/utils.js";

const attendre = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const attendreConnecté = async ({
  sfip,
  idPair,
}: {
  sfip: HeliaLibp2p<Libp2p<ServicesLibp2p>>;
  idPair: string;
}) => {
  await new Promise((résoudre) => {
    const vérifierConnecté = () => {
      const pairs = sfip.libp2p.getPeers();
      const connexions = sfip.libp2p.getConnections()
      const trouvé = pairs.find((p) => p.toString() === idPair);
      if (trouvé) {
        résoudre(connexions.find(c=>c.remotePeer.toString() === idPair)?.remoteAddr.toString());
      }
    };
    sfip.libp2p.addEventListener("peer:connect", vérifierConnecté);
    vérifierConnecté();
  });
};

const testerGossipSub = async ({
  sfip,
  idPair,
}: {
  sfip: HeliaLibp2p<Libp2p<ServicesLibp2p>>;
  idPair: string;
}) => {
  const CANAL_TEST = "test:gossipsub";
  sfip.libp2p.services.pubsub.subscribe(CANAL_TEST);
  const message = uuidv4();
  let intervale: NodeJS.Timeout | undefined = undefined;

  const retour = await new Promise((résoudre) => {
    sfip.libp2p.services.pubsub.addEventListener("gossipsub:message", (m) => {
      if (m.detail.msg.topic === CANAL_TEST) {
        const messageRetour = JSON.parse(
          new TextDecoder().decode(m.detail.msg.data),
        ) as { idPair: string; type: string; message: string };

        if (
          messageRetour.message.includes(message) &&
          messageRetour.idPair === idPair
        ) {
          if (intervale) clearInterval(intervale);
          résoudre(messageRetour);
        }
      }
    });
    intervale = setInterval(
      () =>
        sfip.libp2p.services.pubsub.publish(
          CANAL_TEST,
          new TextEncoder().encode(
            JSON.stringify({ idPair, message, type: "ping" }),
          ),
        ),
      500,
    );
  });
  expect(retour).to.deep.equal({ idPair, message, type: "pong" });
};

if (!(process.platform === "win32")) {
  describe.only("Connectivité SFIP", function () {
    let idPairNavig: string;
    let idPairNode: string;
    let sfip: HeliaLibp2p<Libp2p<ServicesLibp2p>>;
    let dossier: string;
    let fEffacer: () => void;

    before(async () => {
      ({ dossier, fEffacer } = await dossiers.dossierTempo());
      sfip = await initSFIP({ dossier: path.join(dossier, "sfip") });
      ({idPairNavig, idPairNode} = await obtIdsPairs());
      console.log({idPairNavig, idPairNode})
    });

    after(async () => {
      await sfip.stop();
      try {
        fEffacer?.();
      } catch (e) {
        if (!(isNode || isElectronMain) || !(process.platform === "win32")) {
          throw e;
        }
      }
    });

    it("Initialiser", async () => {
      const id = sfip.libp2p.peerId;
      expect(id.toString()).to.be.a("string");
    });

    it("Connexion à Node.js", async () => {
      await attendreConnecté({ sfip, idPair: idPairNode });
    });

    it("GossipSub avec Node.js", async () => {
      await testerGossipSub({ sfip, idPair: idPairNode });
    });

    it("Connexion à un navigateur", async () => {
      await attendreConnecté({ sfip, idPair: idPairNavig });
    });

    it("Gossipsub avec navigateur", async () => {
      await testerGossipSub({ sfip, idPair: idPairNavig });
    });

    it.skip("Ça fonctionne localement hors ligne");
  });

  describe.only("Connectivité lors de redémarrage", function () {
    let idPairNavig: string;
    let idPairNode: string;
    let sfip: HeliaLibp2p<Libp2p<ServicesLibp2p>>;
    let dossier: string;
    let fEffacer: () => void;

    before(async () => {
      ({ dossier, fEffacer } = await dossiers.dossierTempo());
      sfip = await initSFIP({ dossier: path.join(dossier, "sfip") });
      ({idPairNavig, idPairNode} = await obtIdsPairs());
      console.log({idPairNavig, idPairNode})
    });

    after(async () => {
      await sfip.stop();
      try {
        fEffacer?.();
      } catch (e) {
        if (!(isNode || isElectronMain) || !(process.platform === "win32")) {
          throw e;
        }
      }
    });

    it("Réouverture", async () => {
      await sfip.stop();
      sfip = await initSFIP({ dossier: path.join(dossier, "sfip") });
      console.log({dossier})
      const id = sfip.libp2p.peerId;
      expect(id.toString()).to.be.a("string");
    });

    it("Connexion à Node.js", async () => {
      await attendreConnecté({ sfip, idPair: idPairNode });
    });

    it("GossipSub avec Node.js", async () => {
      await testerGossipSub({ sfip, idPair: idPairNode });
    });

    it("Connexion à un navigateur", async () => {
      await attendreConnecté({ sfip, idPair: idPairNavig });
    });

    it("Gossipsub avec navigateur", async () => {
      await testerGossipSub({ sfip, idPair: idPairNavig });
    });
  });
}
describe("Stabilité client", function () {
  let client: Constellation;
  let dossier: string;
  let fEffacer: () => void;

  before(async () => {
    ({ dossier, fEffacer } = await dossiers.dossierTempo());
    client = créerConstellation({ dossier });
    await attendre(15000);
  });

  after(async () => {
    await client.fermer();
    try {
      fEffacer?.();
    } catch (e) {
      if (!(isNode || isElectronMain) || !(process.platform === "win32")) {
        throw e;
      }
    }
  });
  it("Réactivité continue", async () => {
    let avant = Date.now();
    let i = 0;
    while (i < 30) {
      await client.bds.créerBd({ licence: "ODbl-1_0" });
      const après = Date.now();
      console.log(après - avant);
      avant = après;
      i++;
    }
  });
});
