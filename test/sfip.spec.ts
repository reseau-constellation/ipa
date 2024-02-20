import { ServicesLibp2p, initSFIP } from "../src/sfip/index.js";
import { expect } from "aegir/chai";
import type { Helia } from "helia";
import { isElectronMain, isNode } from "wherearewe";
import { dossiers } from "@constl/utils-tests";
import { initOrbite } from "@/orbite.js";
import { Libp2p } from "@libp2p/interface";
import { créerConstellation } from "@/index.js";
import path, { join } from "path";
import { v4 as uuidv4} from "uuid";

const ID_PAIR_NAVIG = "12D3KooWSCVw8HCc4hrkzfkEeJmVW2xfQRkxEreLzoc1NDTfzYFf";
const ID_PAIR_NODE = "12D3KooWENXsSgmKXse4hi77cmCeyKtpLiQWedkcgYeFsiQPnJRr";

const attendreConnecté = async ({ sfip, idPair }: { sfip: Helia<Libp2p<ServicesLibp2p>>; idPair: string }) => {
  await new Promise<void>((résoudre) => {
    sfip.libp2p.addEventListener("peer:discovery", async () => {
      const pairs = sfip.libp2p.getPeers();
      const connexions = sfip.libp2p.getConnections().map(c=>[c.remotePeer.toString(), c.remoteAddr.toString()]);
      console.log("principal: ", {connexions})
      console.log(pairs.map((p) => p.toString()));
      const trouvé = pairs.find((p) => p.toString() === idPair);
      if (trouvé) {
        résoudre();
      }
    });
  });
}

const testerGossipSub = async ({ sfip, idPair }: { sfip: Helia<Libp2p<ServicesLibp2p>>; idPair: string }) => {
  const CANAL_TEST = "test:gossipsub"
  sfip.libp2p.services.pubsub.subscribe(CANAL_TEST);
    const message = uuidv4();
    let intervale : NodeJS.Timeout | undefined = undefined;

    const retour = await new Promise(résoudre => {
      sfip.libp2p.services.pubsub.addEventListener("gossipsub:message", m => {
        if (m.detail.msg.topic === CANAL_TEST) {
          const messageRetour = JSON.parse(new TextDecoder().decode(m.detail.msg.data)) as { idPair: string, type: string, message: string }
          console.log(messageRetour)
          if (messageRetour.message.includes(message) && messageRetour.idPair === idPair) {
            if (intervale) clearInterval(intervale)
            résoudre(messageRetour)
          }
        }
      });
      intervale = setInterval(
        ()=>sfip.libp2p.services.pubsub.publish(CANAL_TEST, new TextEncoder().encode(JSON.stringify({idPair, message, type: "ping"}))), 500
      );
    })
    expect(retour).to.deep.equal({idPair, message, type: "pong"})
}

describe.only("SFIP", function () {
  let sfip: Helia<Libp2p<ServicesLibp2p>>;
  let dossier: string;
  let fEffacer: () => void;

  before(async () => {
    if (isNode || isElectronMain) {
      ({ dossier, fEffacer } = await dossiers.dossierTempo());
    } else {
      dossier = "dossierSFIP";
    }
    sfip = await initSFIP({dossier: path.join(dossier, "sfip")});
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
    expect(id).to.be.a.string;
  });

  it("Connexion à Node.js", async () => {
    await attendreConnecté({ sfip, idPair: ID_PAIR_NODE })
  });

  it("GossipSub avec Node.js", async () => {
    await testerGossipSub({ sfip, idPair: ID_PAIR_NODE });
  });

  it("Connexion à un navigateur", async () => {
    await attendreConnecté({ sfip, idPair: ID_PAIR_NAVIG })
  });

  it.skip("Ça fonctionne localement hors ligne");

  it("Gossipsub avec navigateur", async () => {
    await testerGossipSub({ sfip, idPair: ID_PAIR_NAVIG });
    sfip.libp2p.services.pubsub.subscribe("test")
    const message = uuidv4();
    let intervale : NodeJS.Timeout | undefined = undefined;
    const retour = await new Promise(résoudre => {
      sfip.libp2p.services.pubsub.addEventListener("gossipsub:message", m => {
        console.log(m.detail.msg.topic, new TextDecoder().decode(m.detail.msg.data));
        if (m.detail.msg.topic === "test") {
          const messageRetour = new TextDecoder().decode(m.detail.msg.data)
          if (messageRetour.includes(message)) {
            if (intervale) clearInterval(intervale)
            résoudre(messageRetour)
          }
        }
      });
      intervale = setInterval(()=>sfip.libp2p.services.pubsub.publish("test", new TextEncoder().encode(message)));
    })
    expect(retour).to.equal("Retour : " + message)
    return
    
    const constl = créerConstellation({ orbite: await initOrbite({ sfip, dossierOrbite: join(dossier, "./orbite") }), dossier});
    await constl.réseau.suivreConnexionsPostesSFIP({
      f: sfips => console.log({sfips})
    })
    const noms = await new Promise(résoudre => {

      constl.réseau.suivreConnexionsMembres({
        f: async membres => {
          console.log(JSON.stringify({membres}, undefined, 2))
          return await constl.profil.suivreNoms({
            idCompte: membres[0].infoMembre.idCompte, 
            f: noms => {console.log({noms}); Object.keys(noms).includes("fr") && résoudre(noms)},
          })
        }
      })
    })
    console.log("ici", {noms})
  })
});
