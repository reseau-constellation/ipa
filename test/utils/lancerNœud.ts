import { initSFIP } from "@/sfip/index.js";

import { isBrowser } from "wherearewe";

const CANAL_TEST = "test:gossipsub";

const dossier = isBrowser
  ? "./testSfip"
  : process.argv.indexOf("--dossier")
    ? process.argv[process.argv.indexOf("--dossier") + 1]
    : "./testSfip";

initSFIP({ dossier, configLibp2p: {} }).then(async (sfip) => {
  console.log(
    "SFIP initialisé avec id de nœud :",
    sfip.libp2p.peerId.toString(),
  );
  console.log(
    "nos adresses: ",
    sfip.libp2p.peerId.toString(),
    sfip.libp2p.getMultiaddrs().map((ma) => ma.toString()),
  );
  sfip.libp2p.addEventListener("peer:connect", async () => {
    /*const pairs = sfip.libp2p.getPeers();
    const connexions = sfip.libp2p.getConnections();
    console.log(
      "pairs : ",
      pairs.map((p) => p.toString()),
    );
    console.log(
      "connexions : ",
      JSON.stringify(
        connexions.map((c) => [
          c.remotePeer.toString(),
          c.remoteAddr.toString(),
        ]),
        undefined,
        2,
      ),
    );
    */
  });
  sfip.libp2p.services.pubsub.subscribe(CANAL_TEST);
  sfip.libp2p.services.pubsub.addEventListener("gossipsub:message", (m) => {
    /*console.log(
      m.detail.msg.topic,
      new TextDecoder().decode(m.detail.msg.data),
    );*/
    if (m.detail.msg.topic === CANAL_TEST) {
      const idPair = sfip.libp2p.peerId.toString();
      const message = JSON.parse(
        new TextDecoder().decode(m.detail.msg.data),
      ) as { idPair: string; type: string; message: string };
      if (message.type === "ping" && message.idPair === idPair) {
        sfip.libp2p.services.pubsub.publish(
          CANAL_TEST,
          new TextEncoder().encode(
            JSON.stringify({
              message: message.message,
              idPair,
              type: "pong",
            }),
          ),
        );
      }
    }
  });
});
