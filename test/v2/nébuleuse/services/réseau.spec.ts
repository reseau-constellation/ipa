import { expect } from "aegir/chai";
import { peerIdFromString } from "@libp2p/peer-id";
import { obtenirAdresseRelai } from "@constl/utils-tests";
import { faisRien } from "@constl/utils-ipa";
import { ServiceAppli } from "@/v2/nébuleuse/appli/services.js";
import { obtenir } from "../../utils.js";
import { créerNébuleusesTest } from "../utils.js";
import type { OptionsAppli } from "@/v2/nébuleuse/appli/appli.js";
import type { NébuleuseTest } from "../utils.js";
import type {
  CompteBloqué,
  ConnexionCompte,
  ConnexionDispositif,
  ConnexionLibp2p,
  RelationImmédiate,
} from "@/v2/nébuleuse/services/réseau.js";
import type { Oublier, Suivi } from "@/v2/nébuleuse/types.js";
import type { ServicesNébuleuse } from "@/v2/nébuleuse/nébuleuse.js";

describe("Réseau", function () {
  describe("suivre connexions", function () {
    let nébuleuses: NébuleuseTest[];
    let fermer: Oublier;

    let idsLibp2p: string[];
    let idsDispositifs: string[];
    let idsComptes: string[];

    before(async () => {
      ({ nébuleuses, fermer } = await créerNébuleusesTest({ n: 3 }));

      idsLibp2p = await Promise.all(
        nébuleuses.map((c) => c.compte.obtIdLibp2p()),
      );
      idsDispositifs = await Promise.all(
        nébuleuses.map((c) => c.compte.obtIdDispositif()),
      );
      idsComptes = await Promise.all(
        nébuleuses.map((c) => c.compte.obtIdCompte()),
      );
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("suivre connexions libp2p", async () => {
      for (const [i, constl] of nébuleuses.entries()) {
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
      for (const [i, constl] of nébuleuses.entries()) {
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
      for (const [i, constl] of nébuleuses.entries()) {
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
        (await nébuleuses[0].services.libp2p.libp2p()).hangUp(
          peerIdFromString(idLibp2p),
        );
      }

      const connexionsLibp2p = await obtenir<ConnexionLibp2p[]>(({ siVide }) =>
        nébuleuses[0].réseau.suivreConnexionsLibp2p({ f: siVide() }),
      );
      expect(connexionsLibp2p).to.be.empty();

      for (const constl of nébuleuses.slice(1)) {
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
          nébuleuses[0].réseau.suivreConnexionsDispositifs({ f: siVide() }),
      );
      expect(connexionsDispositifs).to.be.empty();

      for (const constl of nébuleuses.slice(1)) {
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
        nébuleuses[0].réseau.suivreConnexionsComptes({ f: siVide() }),
      );
      expect(connexionsCompte).to.be.empty();

      for (const constl of nébuleuses.slice(1)) {
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
    let nébuleuses: NébuleuseTest[];
    let fermer: Oublier;

    let idsComptes: string[];

    before(async () => {
      ({ nébuleuses, fermer } = await créerNébuleusesTest({ n: 2 }));

      idsComptes = await Promise.all(
        nébuleuses.map((c) => c.compte.obtIdCompte()),
      );
    });

    after(async () => {
      if (fermer) await fermer();
    });

    describe("membres fiables", function () {
      it("personne pour commencer", async () => {
        const fiables = await obtenir<string[]>(({ siDéfini }) =>
          nébuleuses[0].réseau.suivreComptesFiables({ f: siDéfini() }),
        );
        expect(fiables).to.be.empty();
      });

      it("faire confiance", async () => {
        const pFiables = obtenir<string[]>(({ siPasVide }) =>
          nébuleuses[0].réseau.suivreComptesFiables({ f: siPasVide() }),
        );

        await nébuleuses[0].réseau.faireConfianceAuCompte({
          idCompte: idsComptes[1],
        });
        const fiables = await pFiables;

        expect(fiables).have.members([idsComptes[1]]);
      });

      it("détecter confiance d'autre membre", async () => {
        const fiables = await obtenir<string[]>(({ siPasVide }) =>
          nébuleuses[1].réseau.suivreComptesFiables({
            f: siPasVide(),
            idCompte: idsComptes[0],
          }),
        );

        expect(fiables).have.members([idsComptes[1]]);
      });

      it("un débloquage accidental ne fait rien", async () => {
        await nébuleuses[0].réseau.débloquerCompte({ idCompte: idsComptes[1] });
        const fiables = await obtenir<string[]>(({ siPasVide }) =>
          nébuleuses[0].réseau.suivreComptesFiables({ f: siPasVide() }),
        );

        expect(fiables).have.members([idsComptes[1]]);
      });

      it("il n'était pas si chouette que ça après tout", async () => {
        const pFiables = obtenir<string[]>(({ siVide }) =>
          nébuleuses[0].réseau.suivreComptesFiables({ f: siVide() }),
        );

        await nébuleuses[0].réseau.nePlusFaireConfianceAuCompte({
          idCompte: idsComptes[1],
        });
        const fiables = await pFiables;

        expect(fiables).to.be.empty();
      });
    });

    describe("membres bloqués", function () {
      it("personne pour commencer", async () => {
        const bloqués = await obtenir<CompteBloqué[]>(({ siDéfini }) =>
          nébuleuses[0].réseau.suivreComptesBloqués({ f: siDéfini() }),
        );
        expect(bloqués).to.be.empty();
      });

      it("bloquer quelqu'un", async () => {
        const pBloqués = obtenir<CompteBloqué[]>(({ siPasVide }) =>
          nébuleuses[0].réseau.suivreComptesBloqués({ f: siPasVide() }),
        );

        await nébuleuses[0].réseau.bloquerCompte({
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
        await nébuleuses[0].réseau.nePlusFaireConfianceAuCompte({
          idCompte: idsComptes[1],
        });
        const bloqués = await obtenir<CompteBloqué[]>(({ siPasVide }) =>
          nébuleuses[0].réseau.suivreComptesBloqués({ f: siPasVide() }),
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
          nébuleuses[1].réseau.suivreComptesBloqués({ f: siPasVide() }),
        );

        await nébuleuses[1].réseau.bloquerCompte({
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
          nébuleuses[1].réseau.suivreComptesBloqués({
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
          nébuleuses[0].réseau.suivreComptesBloqués({
            f: siDéfini(),
            idCompte: idsComptes[1],
          }),
        );

        expect(bloqués).to.be.empty();
      });

      it("débloquer publique", async () => {
        const pBloqués = obtenir<CompteBloqué[]>(({ siVide }) =>
          nébuleuses[0].réseau.suivreComptesBloqués({ f: siVide() }),
        );

        await nébuleuses[0].réseau.débloquerCompte({
          idCompte: idsComptes[1],
        });
        const bloqués = await pBloqués;

        expect(bloqués).to.be.empty();
      });

      it("débloquer privé", async () => {
        const pBloqués = obtenir<CompteBloqué[]>(({ siVide }) =>
          nébuleuses[1].réseau.suivreComptesBloqués({ f: siVide() }),
        );

        await nébuleuses[1].réseau.débloquerCompte({
          idCompte: idsComptes[0],
        });
        const bloqués = await pBloqués;

        expect(bloqués).to.be.empty();
      });

      it("passer de bloqué privé à bloqué publique", async () => {
        await nébuleuses[0].réseau.bloquerCompte({
          idCompte: idsComptes[1],
          privé: true,
        });
        await obtenir<CompteBloqué[]>(({ siPasVide }) =>
          nébuleuses[0].réseau.suivreComptesBloqués({ f: siPasVide() }),
        );

        await nébuleuses[0].réseau.bloquerCompte({
          idCompte: idsComptes[1],
          privé: false,
        });
        const pBloqués = obtenir<CompteBloqué[]>(({ si }) =>
          nébuleuses[0].réseau.suivreComptesBloqués({
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
    let nébuleuses: NébuleuseTest[];
    let fermer: Oublier;

    let idsComptes: string[];

    class ServiceConfianceTest extends ServiceAppli<
      "confianceTest",
      ServicesNébuleuse
    > {
      constructor({
        services,
        options,
      }: {
        services: ServicesNébuleuse;
        options: OptionsAppli;
      }) {
        super({
          clef: "confianceTest",
          services,
          dépendances: ["réseau"],
          options,
        });
        this.service("réseau").inscrireRésolutionConfiance({
          clef: this.clef,
          résolution: this.résolutionConfiance.bind(this),
        });
      }

      async résolutionConfiance({
        de,
        f,
      }: {
        de: string;
        f: Suivi<RelationImmédiate[]>;
      }): Promise<Oublier> {
        if (de === idsComptes[0])
          await f([{ idCompte: idsComptes[1], confiance: 0.5 }]);
        else if (de === idsComptes[1])
          await f([{ idCompte: idsComptes[2], confiance: 0.5 }]);
        else await f([]);
        return faisRien;
      }
    }

    before(async () => {
      ({ nébuleuses, fermer } = await créerNébuleusesTest({
        n: 3,
        services: {
          confianceTest: ({ options, services }) =>
            new ServiceConfianceTest({ options, services }),
        },
      }));

      idsComptes = await Promise.all(
        nébuleuses.map((c) => c.compte.obtIdCompte()),
      );
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("confiance transitive", async () => {
      const comptes = await obtenir<Compte>(({ si }) =>
        nébuleuses[0].réseau.suivreComptes({
          f: si((x) => !!x && x.length >= 3),
        }),
      );

      expect(comptes.map((c) => c.idCompte)).to.have.members([
        idsComptes[1],
        idsComptes[2],
      ]);

      const confianceCompte1 = comptes.find(
        (c) => c.idCompte === idsComptes[1],
      ).confiance;
      expect(confianceCompte1).to.be.greaterThan(0);

      const confianceCompte2 = comptes.find(
        (c) => c.idCompte === idsComptes[2],
      ).confiance;
      expect(confianceCompte2)
        .to.be.greaterThan(0)
        .and.lessThan(confianceCompte1);
    });

    it("confiance bloquée transitive", async () => {
      await nébuleuses[1].réseau.bloquerCompte({ idCompte: idsComptes[2] });
      const confianceCompte2 = await obtenir(({}) =>
        nébuleuses[0].réseau.suivreConfianceCompte({
          idCompte: idsComptes[2],
          f,
        }),
      );

      expect(confianceCompte2).to.be.lessThan(0);
    });

    it("changer profondeur");

    it("priorité confiance manuelle personnelle", async () => {
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[2],
      });
      const comptes = await nébuleuses[0].réseau.suivreComptes();

      const confianceCompte2 = comptes.find(
        (c) => c.idCompte === idsComptes[2],
      ).confiance;
      expect(confianceCompte2).to.equal(1);
    });

    it("relations immédiates");
    it("relations réseau");
    it("comptes par profondeur");
  });

  describe("reconnexion après réouverture", function () {});

  describe("automatisation ajout dispositif", function () {
    let idBd: string;

    before(async () => {
      const fOublierConnexions =
        await client3.réseau.suivreConnexionsDispositifs({
          f: (x) => attendreConnectés.mettreÀJour(x),
        });
      fsOublier.push(fOublierConnexions);

      idBd = await client.créerBdIndépendante({ type: "keyvalue" });
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    });

    it("Nouveau dispositif ajouté au compte", async () => {
      const invitation = await client.générerInvitationRejoindreCompte();

      client4.demanderEtPuisRejoindreCompte({
        idCompte: invitation.idCompte,
        codeSecret: "code secret invalid:",
      });
      await client3.demanderEtPuisRejoindreCompte(invitation);

      const mesDispositifs = await obtenir<string[]>(({ si }) =>
        client.suivreDispositifs({
          f: si((x) => x.includes(idDispositif3)),
        }),
      );
      expect(mesDispositifs).to.have.members([
        idDispositif1,
        idDispositif2,
        idDispositif3,
      ]);
      expect(mesDispositifs).to.not.have.members([idDispositif4]);
    });

    it("Nouveau dispositif indique le nouveau compte", async () => {
      const idCompte3 = await client3.obtIdCompte();
      expect(idCompte3).to.equal(idCompte1);
    });

    it("Le nouveau dispositif peut modifier mes BDs", async () => {
      const { bd: bd_orbite3, fOublier } = await client3.ouvrirBdTypée({
        id: idBd,
        type: "keyvalue",
        schéma: schémaKVNumérique,
      });
      const autorisé = await orbiteTest.peutÉcrire(bd_orbite3, orbite3);
      await fOublier();
      expect(autorisé).to.be.true();
    });
  });
});
