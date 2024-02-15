import { initSFIP } from "@/sfip/index.js";
console.log("on est ici");
initSFIP("./testSfip").then(async (sfip) => {
  console.log("Ça fonctionne ! Lancer nœud");
  console.log(sfip.libp2p.peerId.toString());
  sfip.libp2p.addEventListener("peer:discovery", async () => {
    const pairs = sfip.libp2p.getPeers();
    console.log(pairs.map((p) => p.toString()));
  });
});
