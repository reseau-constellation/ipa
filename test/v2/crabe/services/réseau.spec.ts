import { expect } from "aegir/chai";
import { peerIdFromString } from "@libp2p/peer-id";
import { obtenirAdresseRelai } from "@constl/utils-tests";
import { obtenir } from "test/v2/utils.js";
import { créerCrabesTest } from "../utils.js";
import type { CrabeTest} from "../utils.js";
import type {
  CompteBloqué,
  ConnexionCompte,
  ConnexionDispositif,
  ConnexionLibp2p,
} from "@/v2/crabe/services/réseau.js";
import type { Oublier } from "@/v2/crabe/types.js";

describe("Réseau", function () {
  describe("suivre connexions", function () {
    let crabes: CrabeTest[];
    let fermer: Oublier;

    let idsLibp2p: string[];
    let idsDispositifs: string[];
    let idsComptes: string[];

    before(async () => {
      ({ crabes, fermer } = await créerCrabesTest({ n: 3 }));

      idsLibp2p = await Promise.all(crabes.map((c) => c.compte.obtIdLibp2p()));
      idsDispositifs = await Promise.all(
        crabes.map((c) => c.compte.obtIdDispositif()),
      );
      idsComptes = await Promise.all(
        crabes.map((c) => c.compte.obtIdCompte()),
      );
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("suivre connexions libp2p", async () => {
      for (const [i, constl] of crabes.entries()) {
        const autresIds = idsLibp2p.filter((id) => id !== idsLibp2p[i]);

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
      for (const [i, constl] of crabes.entries()) {
        const autresIds = idsDispositifs.filter(
          (id) => id !== idsDispositifs[i],
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
      for (const [i, constl] of crabes.entries()) {
        const autresIds = idsComptes.filter((id) => id !== idsComptes[i]);

        const connexionsComptes = await obtenir<ConnexionCompte[]>(({ si }) =>
          constl.réseau.suivreConnexionsComptes({
            f: si(
              (x) =>
                !!x &&
                autresIds.every((id) => x.find((c) => c.idCompte === id)),
            ),
          }),
        );
        expect(
          connexionsComptes.map((c) => c.idCompte),
        ).to.include.deep.members(autresIds);
      }
    });

    it("déconnexion - suivi connexions libp2p", async () => {
      for (const idLibp2p of idsLibp2p.slice(1)) {
        (await crabes[0].services.libp2p.libp2p()).hangUp(
          peerIdFromString(idLibp2p),
        );
      }

      const connexionsLibp2p = await obtenir<ConnexionLibp2p[]>(({ siVide }) =>
        crabes[0].réseau.suivreConnexionsLibp2p({ f: siVide() }),
      );
      expect(connexionsLibp2p).to.be.empty();

      for (const constl of crabes.slice(1)) {
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
          crabes[0].réseau.suivreConnexionsDispositifs({ f: siVide() }),
      );
      expect(connexionsDispositifs).to.be.empty();

      for (const constl of crabes.slice(1)) {
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
        crabes[0].réseau.suivreConnexionsComptes({ f: siVide() }),
      );
      expect(connexionsCompte).to.be.empty();

      for (const constl of crabes.slice(1)) {
        const connexionsCompteAutre = await obtenir<ConnexionCompte[]>(
          ({ si }) =>
            constl.réseau.suivreConnexionsComptes({
              f: si((c) => !!c && !c.find((c) => c.idCompte === idsComptes[0])),
            }),
        );
        expect(
          connexionsCompteAutre.find((c) => c.idCompte === idsComptes[0]),
        ).to.be.undefined();
      }
    });
  });

  describe("confiance - manuelle", function () {
    let crabes: CrabeTest[];
    let fermer: Oublier;

    let idsComptes: string[];

    before(async () => {
      ({ crabes, fermer } = await créerCrabesTest({ n: 2 }));

      idsComptes = await Promise.all(
        crabes.map((c) => c.compte.obtIdCompte()),
      );
    });

    after(async () => {
      if (fermer) await fermer();
    });

    describe("membres fiables", function () {
      it("personne pour commencer", async () => {
        const fiables = await obtenir<string[]>(({ siDéfini }) =>
          crabes[0].réseau.suivreComptesFiables({ f: siDéfini() }),
        );
        expect(fiables).to.be.empty();
      });

      it("faire confiance", async () => {
        const pFiables = obtenir<string[]>(({ siPasVide }) =>
          crabes[0].réseau.suivreComptesFiables({ f: siPasVide() }),
        );

        await crabes[0].réseau.faireConfianceAuCompte({
          idCompte: idsComptes[1],
        });
        const fiables = await pFiables;

        expect(fiables).have.members([idsComptes[1]]);
      });

      it("détecter confiance d'autre membre", async () => {
        const fiables = await obtenir<string[]>(({ siPasVide }) =>
          crabes[1].réseau.suivreComptesFiables({
            f: siPasVide(),
            idCompte: idsComptes[0],
          }),
        );

        expect(fiables).have.members([idsComptes[1]]);
      });

      it("un débloquage accidental ne fait rien", async () => {
        await crabes[0].réseau.débloquerCompte({ idCompte: idsComptes[1] });
        const fiables = await obtenir<string[]>(({ siPasVide }) =>
          crabes[0].réseau.suivreComptesFiables({ f: siPasVide() }),
        );

        expect(fiables).have.members([idsComptes[1]]);
      });

      it("il n'était pas si chouette que ça après tout", async () => {
        const pFiables = obtenir<string[]>(({ siVide }) =>
          crabes[0].réseau.suivreComptesFiables({ f: siVide() }),
        );

        await crabes[0].réseau.nePlusFaireConfianceAuCompte({
          idCompte: idsComptes[1],
        });
        const fiables = await pFiables;

        expect(fiables).to.be.empty();
      });
    });

    describe("membres bloqués", function () {
      it("personne pour commencer", async () => {
        const bloqués = await obtenir<CompteBloqué[]>(({ siDéfini }) =>
          crabes[0].réseau.suivreComptesBloqués({ f: siDéfini() }),
        );
        expect(bloqués).to.be.empty();
      });

      it("bloquer quelqu'un", async () => {
        const pBloqués = obtenir<CompteBloqué[]>(({ siPasVide }) =>
          crabes[0].réseau.suivreComptesBloqués({ f: siPasVide() }),
        );

        await crabes[0].réseau.bloquerCompte({
          idCompte: idsComptes[1],
        });
        const bloqués = await pBloqués;

        const réf: CompteBloqué[] = [
          {
            idCompte: idsComptes[1],
            privé: false,
          },
        ];
        expect(bloqués).have.deep.members(réf);
      });

      it("une dé-confiance accidental ne fait rien", async () => {
        await crabes[0].réseau.nePlusFaireConfianceAuCompte({
          idCompte: idsComptes[1],
        });
        const bloqués = await obtenir<CompteBloqué[]>(({ siPasVide }) =>
          crabes[0].réseau.suivreComptesBloqués({ f: siPasVide() }),
        );

        const réf: CompteBloqué[] = [
          {
            idCompte: idsComptes[1],
            privé: false,
          },
        ];
        expect(bloqués).have.deep.members(réf);
      });

      it("bloquer privé", async () => {
        const pBloqués = obtenir<CompteBloqué[]>(({ siPasVide }) =>
          crabes[1].réseau.suivreComptesBloqués({ f: siPasVide() }),
        );

        await crabes[1].réseau.bloquerCompte({
          idCompte: idsComptes[0],
          privé: true,
        });
        const bloqués = await pBloqués;

        const réf: CompteBloqué[] = [
          {
            idCompte: idsComptes[0],
            privé: true,
          },
        ];
        expect(bloqués).have.deep.members(réf);
      });

      it("on détecte bloqué publique d'un autre membre", async () => {
        const bloqués = await obtenir<CompteBloqué[]>(({ siPasVide }) =>
          crabes[1].réseau.suivreComptesBloqués({
            f: siPasVide(),
            idCompte: idsComptes[0],
          }),
        );

        const réf: CompteBloqué[] = [
          {
            idCompte: idsComptes[1],
            privé: false,
          },
        ];
        expect(bloqués).have.deep.members(réf);
      });

      it("on ne détecte pas le bloqué privé d'un autre membre", async () => {
        const bloqués = await obtenir<CompteBloqué[]>(({ siDéfini }) =>
          crabes[0].réseau.suivreComptesBloqués({
            f: siDéfini(),
            idCompte: idsComptes[1],
          }),
        );

        expect(bloqués).to.be.empty();
      });

      it("débloquer publique", async () => {
        const pBloqués = obtenir<CompteBloqué[]>(({ siVide }) =>
          crabes[0].réseau.suivreComptesBloqués({ f: siVide() }),
        );

        await crabes[0].réseau.débloquerCompte({
          idCompte: idsComptes[1],
        });
        const bloqués = await pBloqués;

        expect(bloqués).to.be.empty();
      });

      it("débloquer privé", async () => {
        const pBloqués = obtenir<CompteBloqué[]>(({ siVide }) =>
          crabes[1].réseau.suivreComptesBloqués({ f: siVide() }),
        );

        await crabes[1].réseau.débloquerCompte({
          idCompte: idsComptes[0],
        });
        const bloqués = await pBloqués;

        expect(bloqués).to.be.empty();
      });

      it("passer de bloqué privé à bloqué publique", async () => {
        await crabes[0].réseau.bloquerCompte({
          idCompte: idsComptes[1],
          privé: true,
        });
        await obtenir<CompteBloqué[]>(({ siPasVide }) =>
          crabes[0].réseau.suivreComptesBloqués({ f: siPasVide() }),
        );

        await crabes[0].réseau.bloquerCompte({
          idCompte: idsComptes[1],
          privé: false,
        });
        const pBloqués = obtenir<CompteBloqué[]>(({ si }) =>
          crabes[0].réseau.suivreComptesBloqués({
            f: si(
              (x) =>
                !!x?.find(
                  ({ idCompte, privé }) => idCompte === idsComptes[1] && !privé,
                ),
            ),
          }),
        );

        const bloqués = await pBloqués;

        const réf: CompteBloqué[] = [
          {
            idCompte: idsComptes[1],
            privé: false,
          },
        ];
        expect(bloqués).to.have.deep.members(réf);
      });
      it("persistance après redémarrage");
    });
  });

  describe("confiance - automatique", function () {
    let crabes: CrabeTest[];
    let fermer: Oublier;

    let idsComptes: string[];

    before(async () => {
      ({ crabes, fermer } = await créerCrabesTest({ n: 2 }));

      idsComptes = await Promise.all(
        crabes.map((c) => c.compte.obtIdCompte()),
      );
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("confiance transitive");
    it("confiance fiable transitive");
    it("confiance bloquée transitive");
    it("priorité confiance manuelle personnelle");
  });

  describe("reconnexion après réouverture");

  describe("automatisation ajout dispositif");
});
