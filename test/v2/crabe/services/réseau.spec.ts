import { expect } from "aegir/chai";
import { peerIdFromString } from "@libp2p/peer-id";
import { obtenirAdresseRelai } from "@constl/utils-tests";
import { créerConstellationsTest, obtenir } from "test/v2/utils.js";
import type {
  ConnexionDispositif,
  ConnexionLibp2p,
} from "@/v2/crabe/services/réseau.js";
import type { Oublier } from "@/v2/crabe/types.js";
import type { Constellation } from "@/v2/index.js";

describe("Réseau", function () {
  describe("suivre connexions", function () {
    let constls: Constellation[];
    let fermer: Oublier;

    let idsLibp2p: string[];
    let idsDispositifs: string[];
    let idsComptes: string[];

    before(async () => {
      ({ constls, fermer } = await créerConstellationsTest({ n: 3 }));

      idsLibp2p = await Promise.all(constls.map((c) => c.compte.obtIdLibp2p()));
      idsDispositifs = await Promise.all(
        constls.map((c) => c.compte.obtIdDispositif()),
      );
      idsComptes = await Promise.all(
        constls.map((c) => c.compte.obtIdCompte()),
      );
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("suivre connexions libp2p", async () => {
      for (const constl of constls) {
        const autresIds = idsLibp2p.filter((id) => id !== idsComptes[0]);

        const connexionsLibp2p = await obtenir<ConnexionLibp2p[]>(({ si }) =>
          constl.réseau.suivreConnexionsLibp2p({
            f: si(
              (x) =>
                !!x && autresIds.every((id) => x.find((c) => c.pair === id)),
            ),
          }),
        );
        expect(connexionsLibp2p.map((c) => c.pair)).to.include.deep.members(
          autresIds,
        );
        expect(
          connexionsLibp2p.find((c) =>
            c.adresses.find((a) => a === obtenirAdresseRelai()),
          ),
        ).to.not.be.undefined();
      }
    });

    it("suivre connexions dispositifs", async () => {
      for (const constl of constls) {
        const autresIds = idsDispositifs.filter(
          (id) => id !== idsDispositifs[0],
        );

        const connexionsDispositifs = await obtenir<ConnexionDispositif[]>(
          ({ si }) =>
            constl.réseau.suivreConnexionsDispositifs({
              f: si(
                (x) =>
                  !!x &&
                  autresIds.every((id) => x.find((c) => c.idDispositif === id)),
              ),
            }),
        );
        expect(
          connexionsDispositifs.map((c) => c.idDispositif),
        ).to.include.deep.members(autresIds);
      }
    });

    it("suivre connexions compte", async () => {
      for (const constl of constls) {
        const autresIds = idsDispositifs.filter((id) => id !== idsComptes[0]);

        const connexionsComptes = await obtenir<ConnexionCompte[]>(({ si }) =>
          constl.réseau.suivreConnexionsComptes({
            f: si(
              (x) =>
                !!x && autresIds.every((id) => x.find((c) => c.pair === id)),
            ),
          }),
        );
        expect(connexionsComptes.map((c) => c.pair)).to.include.deep.members(
          autresIds,
        );
      }
    });

    it("déconnexion - suivi connexions libp2p", async () => {
      for (const idLibp2p of idsLibp2p.slice(1)) {
        (await constls[0].services.libp2p.libp2p()).hangUp(
          peerIdFromString(idLibp2p),
        );
      }

      const connexionsLibp2p = await obtenir<ConnexionLibp2p[]>(({ siVide }) =>
        constls[0].réseau.suivreConnexionsLibp2p({ f: siVide() }),
      );
      expect(connexionsLibp2p).to.be.empty();

      for (const constl of constls.slice(1)) {
        const connexionsLibp2pAutre = await obtenir<ConnexionLibp2p[]>(
          ({ si }) =>
            constl.réseau.suivreConnexionsLibp2p({
              f: si((c) => !!c && !c.find((c) => c.pair === idsLibp2p[0])),
            }),
        );
        expect(
          connexionsLibp2pAutre.find((c) => c.pair === idsLibp2p[0]),
        ).to.be.undefined();
      }
    });

    it("déconnexion - suivi connexions dispositifs", async () => {
      const connexionsDispositifs = await obtenir<ConnexionDispositif[]>(
        ({ siVide }) =>
          constls[0].réseau.suivreConnexionsDispositifs({ f: siVide() }),
      );
      expect(connexionsDispositifs).to.be.empty();

      for (const constl of constls.slice(1)) {
        const connexionsDispositifsAutre = await obtenir<ConnexionDispositif[]>(
          ({ si }) =>
            constl.réseau.suivreConnexionsDispositifs({
              f: si(
                (c) =>
                  !!c && !c.find((c) => c.idDispositif === idsDispositifs[0]),
              ),
            }),
        );
        expect(
          connexionsDispositifsAutre.find(
            (c) => c.idDispositif === idsDispositifs[0],
          ),
        ).to.be.undefined();
      }
    });

    it("déconnexion - suivi connexions comptes", async () => {
      const connexionsCompte = await obtenir<ConnexionCompte[]>(({ siVide }) =>
        constls[0].réseau.suivreConnexionsComptes({ f: siVide() }),
      );
      expect(connexionsCompte).to.be.empty();

      for (const constl of constls.slice(1)) {
        const connexionsCompteAutre = await obtenir<ConnexionCompte[]>(
          ({ si }) =>
            constl.réseau.suivreConnexionsComptes({
              f: si((c) => !!c && !c.find((c) => c.pair === idsComptes[0])),
            }),
        );
        expect(
          connexionsCompteAutre.find((c) => c.pair === idsComptes[0]),
        ).to.be.undefined();
      }
    });
  });

  describe("confiance", function () {
    describe("membres fiables");
    describe("membres bloqués", function () {
      it("persistance après redémarrage");
    });
  });

  describe("reconnexion après réouverture");

  describe("automatisation ajout dispositif");
});
