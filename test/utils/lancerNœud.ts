import { initSFIP } from "@/sfip/index.js";

import { isBrowser } from "wherearewe";

const CANAL_TEST = "test:gossipsub";

const dossier = isBrowser
  ? "./testSfip"
  : process.argv.indexOf("--dossier")
    ? process.argv[process.argv.indexOf("--dossier") + 1]
    : "./testSfip";

initSFIP({ dossier, configLibp2p: {} }).then(async (sfip) => {
  // Important ! Ne pas effacer cet appel à `console.log`
  console.log(
    "SFIP initialisé avec id de nœud :",
    sfip.libp2p.peerId.toString(),
  );
  sfip.libp2p.services.pubsub.subscribe(CANAL_TEST);
  sfip.libp2p.services.pubsub.addEventListener("gossipsub:message", (m) => {
    if (m.detail.msg.topic === CANAL_TEST) {
      const idPair = sfip.libp2p.peerId.toString();
      const message = JSON.parse(
        new TextDecoder().decode(m.detail.msg.data),
      ) as {
        idPair: string;
        type: string;
        message: string;
      };
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
