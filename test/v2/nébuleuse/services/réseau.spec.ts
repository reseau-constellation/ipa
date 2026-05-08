import { expect } from "aegir/chai";
import { faisRien } from "@constl/utils-ipa";
import { obtenirAdresseRelai } from "@constl/utils-tests";
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
} from "@/v2/nébuleuse/services/réseau/réseau.js";
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
      }
    });

    it.skip("suivre connexions dispositifs", async () => {
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

    it.skip("suivre connexions compte", async () => {
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
      for (const nébuleuse of nébuleuses.slice(1)) {
        await nébuleuse.fermer();
      }

      const idRelai = obtenirAdresseRelai().split("/").pop();
      const connexionsLibp2p = await obtenir<ConnexionLibp2p[]>(({ si }) =>
        nébuleuses[0].réseau.suivreConnexionsLibp2p({
          f: si((x) => !x?.find((c) => c.pair !== idRelai)),
        }),
      );
      expect(connexionsLibp2p.filter((c) => c.pair !== idRelai)).to.be.empty();
    });

    it.skip("déconnexion - suivi connexions dispositifs", async () => {
      const connexionsDispositifs = await obtenir<ConnexionDispositif[]>(
        ({ siVide }) =>
          nébuleuses[0].réseau.suivreConnexionsDispositifs({ f: siVide() }),
      );
      expect(connexionsDispositifs).to.be.empty();
    });

    it.skip("déconnexion - suivi connexions comptes", async () => {
      const connexionsCompte = await obtenir<ConnexionCompte[]>(({ siVide }) =>
        nébuleuses[0].réseau.suivreConnexionsComptes({ f: siVide() }),
      );
      expect(connexionsCompte).to.be.empty();
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

      it("persistance après redémarrage", async () => {
        const compteBloquéPublique =
          "/nébuleuse/compte/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX";
        const compteBloquéPrivé =
          "/nébuleuse/compte/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidY";
        const compteFiable =
          "/nébuleuse/compte/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidZ";

        await nébuleuses[0].réseau.bloquerCompte({
          idCompte: compteBloquéPublique,
        });
        await nébuleuses[0].réseau.bloquerCompte({
          idCompte: compteBloquéPrivé,
          privé: true,
        });
        await nébuleuses[0].réseau.faireConfianceAuCompte({
          idCompte: compteFiable,
        });
        await nébuleuses[0].fermer();
        await nébuleuses[0].démarrer();

        const bloqués = await obtenir<CompteBloqué[]>(({ si }) =>
          nébuleuses[0].réseau.suivreComptesBloqués({
            f: si(
              (x) =>
                !!x &&
                [compteBloquéPrivé, compteBloquéPublique].every((id) =>
                  x.find(({ idCompte }) => idCompte === id),
                ),
            ),
          }),
        );

        const réfBloqués: CompteBloqué[] = [
          { idCompte: compteBloquéPrivé, privé: true },
          { idCompte: compteBloquéPublique, privé: false },
        ];
        expect(bloqués).to.include.deep.members(réfBloqués);

        const fiables = await obtenir<string[]>(({ si }) =>
          nébuleuses[0].réseau.suivreComptesFiables({
            f: si((x) => !!x?.includes(compteFiable)),
          }),
        );
        expect(fiables).to.include.members([compteFiable]);
      });
    });
  });

  describe.skip("confiance - automatique", function () {
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

  describe.skip("connexion", function () {
    it("");
  });

  describe.skip("reconnexion après réouverture", function () {});

  describe.skip("automatisation ajout dispositif", function () {
    let nébuleuses: NébuleuseTest[];
    let fermer: Oublier;

    let idsLibp2p: string[];
    let idsDispositifs: string[];
    let idsComptes: string[];

    let idBd: string;

    describe("requête du nouveau dispositif", async () => {
      before(async () => {
        ({ nébuleuses, fermer } = await créerNébuleusesTest({ n: 2 }));

        idsLibp2p = await Promise.all(
          nébuleuses.map((c) => c.compte.obtIdLibp2p()),
        );
        idsDispositifs = await Promise.all(
          nébuleuses.map((c) => c.compte.obtIdDispositif()),
        );
        idsComptes = await Promise.all(
          nébuleuses.map((c) => c.compte.obtIdCompte()),
        );

        const { bd, oublier } = await nébuleuses[0].orbite.créerBd({
          type: "keyvalue",
        });
        idBd = bd.address;
        await oublier();
      });

      after(async () => {
        if (fermer) await fermer();
      });

      it("nouveau dispositif ajouté au compte", async () => {
        const requête =
          await nébuleuses[1].réseau.générerRequêteRejoindreCompte();

        // Compte 1 obtient la requête du dispositif 2 par code R2 ou autre moyen
        await nébuleuses[0].réseau.accepterRequêteRejoindreCompte({ requête });

        // Compte 1 a bien ajouté le dispositif 2
        const dispositifsCompte = await obtenir<string[]>(({ si }) =>
          nébuleuses[0].compte.suivreMesDispositifs({
            f: si((x) => !!x?.includes(idsDispositifs[1])),
          }),
        );
        expect(dispositifsCompte).to.have.members([
          idsDispositifs[0],
          idsDispositifs[1],
        ]);
      });

      it("le  nouveau dispositif indique le nouveau compte", async () => {
        const idCompte = await obtenir(({ si }) =>
          nébuleuses[1].compte.suivreIdCompte({
            f: si((id) => id !== idsComptes[1]),
          }),
        );
        expect(idCompte).to.equal(idsComptes[0]);
      });

      it("le nouveau dispositif peut modifier mes données", async () => {
        const { bd: bdSurNébuleuse2, oublier } =
          await nébuleuses[1].orbite.ouvrirBd({
            id: idBd,
            type: "keyvalue",
          });
        const permission = await obtenir(({ siDéfini }) =>
          bdSurNébuleuse2.suivrePermission({
            idObjet: idBd,
            idDispositif: idsDispositifs[1],
            f: siDéfini(),
          }),
        );
        expect(permission).to.be.true();

        await bdSurNébuleuse2.set("a", 1);
        await oublier();
      });
    });

    describe("requête du compte existant", async () => {
      before(async () => {
        ({ nébuleuses, fermer } = await créerNébuleusesTest({ n: 2 }));

        idsLibp2p = await Promise.all(
          nébuleuses.map((c) => c.compte.obtIdLibp2p()),
        );
        idsDispositifs = await Promise.all(
          nébuleuses.map((c) => c.compte.obtIdDispositif()),
        );
        idsComptes = await Promise.all(
          nébuleuses.map((c) => c.compte.obtIdCompte()),
        );

        const { bd, oublier } = await nébuleuses[0].orbite.créerBd({
          type: "keyvalue",
        });
        idBd = bd.address;
        await oublier();
      });

      after(async () => {
        if (fermer) await fermer();
      });

      it("nouveau dispositif ajouté au compte", async () => {
        const invitation =
          await nébuleuses[0].réseau.générerInvitationRejoindreCompte();

        // Dispositif 2 obtient l'id et l'addresse du compte 1 par code R2 ou autre moyen
        await nébuleuses[1].réseau.rejoindreCompteParInvitation({ invitation });

        // Compte 1 a bien ajouté le dispositif 2
        const dispositifsCompte = await obtenir<string[]>(({ si }) =>
          nébuleuses[0].compte.suivreMesDispositifs({
            f: si((x) => !!x?.includes(idsDispositifs[1])),
          }),
        );
        expect(dispositifsCompte).to.have.members([
          idsDispositifs[0],
          idsDispositifs[1],
        ]);
      });

      it("le  nouveau dispositif indique le nouveau compte", async () => {
        const idCompte = await obtenir(({ si }) =>
          nébuleuses[1].compte.suivreIdCompte({
            f: si((id) => id !== idsComptes[1]),
          }),
        );
        expect(idCompte).to.equal(idsComptes[0]);
      });

      it("le nouveau dispositif peut modifier mes données", async () => {
        const { bd: bdSurNébuleuse2, oublier } =
          await nébuleuses[1].orbite.ouvrirBd({
            id: idBd,
            type: "keyvalue",
          });
        const permission = await obtenir(({ siDéfini }) =>
          bdSurNébuleuse2.suivrePermission({
            idObjet: idBd,
            idDispositif: idsDispositifs[1],
            f: siDéfini(),
          }),
        );
        expect(permission).to.be.true();

        await bdSurNébuleuse2.set("a", 1);
        await oublier();
      });
    });

    it("ça ne fonctionne pas avec le mauvais mot de passe", async () => {
      const dispositifsCompte = await obtenir<string[]>(({ si }) =>
        nébuleuses[0].compte.suivreMesDispositifs({
          f: si((x) => !!x?.includes(idsDispositifs[1])),
        }),
      );
      expect(dispositifsCompte).to.not.include(idsDispositifs[2]);
    });
  });
});
