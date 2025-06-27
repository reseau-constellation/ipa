import { multiaddr } from "@multiformats/multiaddr"
import { expect } from "aegir/chai";
import { dépunicodifier } from "@/utils.js"

describe.only("utils", function () {
  describe("Dépunycodifier", function () {
    it("Convertir à Unicode", () => {
      const converti = dépunicodifier(multiaddr("/dns4/relai-ws-libp2p.xn--rseau-constellation-bzb.ca/tcp/443/wss/p2p/12D3KooWGVYEgCLYwMSa1hDFW93fiCxhN2V2QUuMGCEfmG5ZuM9m"))
      expect(converti.toString()).to.equal("/dns4/relai-ws-libp2p.réseau-constellation.ca/tcp/443/wss/p2p/12D3KooWGVYEgCLYwMSa1hDFW93fiCxhN2V2QUuMGCEfmG5ZuM9m")
    })
    it("Pas de changement si déjà en Unicode", () => {
      const converti = dépunicodifier(multiaddr("/dns4/relai-ws-libp2p.réseau-constellation.ca/tcp/443/wss/p2p/12D3KooWGVYEgCLYwMSa1hDFW93fiCxhN2V2QUuMGCEfmG5ZuM9m"))
      expect(converti.toString()).to.equal("/dns4/relai-ws-libp2p.réseau-constellation.ca/tcp/443/wss/p2p/12D3KooWGVYEgCLYwMSa1hDFW93fiCxhN2V2QUuMGCEfmG5ZuM9m")
    })
    it("Pas de changement si en ascii", () => {
      const converti = dépunicodifier(multiaddr("/dns4/ny5.bootstrap.libp2p.io/tcp/443/wss/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa"))
      expect(converti.toString()).to.equal("/dns4/ny5.bootstrap.libp2p.io/tcp/443/wss/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa")
    })
    it("dns 6", () => {
      const converti = dépunicodifier(multiaddr("/dns6/relai-ws-libp2p.réseau-constellation.ca/tcp/443/wss/p2p/12D3KooWGVYEgCLYwMSa1hDFW93fiCxhN2V2QUuMGCEfmG5ZuM9m"))
      expect(converti.toString()).to.equal("/dns6/relai-ws-libp2p.réseau-constellation.ca/tcp/443/wss/p2p/12D3KooWGVYEgCLYwMSa1hDFW93fiCxhN2V2QUuMGCEfmG5ZuM9m")
    })
  })
})