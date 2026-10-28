import { expect } from "aegir/chai";
import { faisRien, uneFois } from "@constl/utils-ipa";
import { obtenirAdresseRelai } from "@constl/utils-tests";
import { peerIdFromString } from "@libp2p/peer-id";
import { v4 as uuidv4 } from "uuid";
import { ServiceAppli } from "@/v2/nébuleuse/appli/services.js";
import {
  FACTEUR_ATÉNUATION_CONFIANCE_NÉGATIVE,
  FACTEUR_ATÉNUATION_CONFIANCE_POSITIVE,
} from "@/v2/nébuleuse/services/consts.js";
import {
  RÉSOLVEUR_CONFIANCE,
  type CompteBloqué,
  type CompteRéseau,
  type ConnexionCompte,
  type ConnexionDispositif,
  type ConnexionLibp2p,
  type DispositifCompte,
  type RelationImmédiate,
  type RelationRéseau,
} from "@/v2/nébuleuse/services/réseau/réseau.js";
import { MODÉRATRICE } from "@/v2/nébuleuse/services/compte/accès/consts.js";
import {
  ACCEPTATION_INVITATION_REJOINDRE_COMPTE,
  type MessageAcceptationInvitationRejoindreCompte,
  type MessageRéseau,
  type MessageRéseauAvecExpéditeur,
} from "@/v2/nébuleuse/services/réseau/messages.js";
import { obtEmpreinteCode } from "@/v2/nébuleuse/services/utils.js";
import { obtenir, rechercherProfondeur } from "../../utils.js";
import { créerNébuleusesTest } from "../utils.js";
import type { ObtRechercheProfondeur } from "../../utils.js";
import type {
  OptionsAppli,
  ServicesAppli,
} from "@/v2/nébuleuse/appli/appli.js";
import type { NébuleuseTest } from "../utils.js";
import type { Oublier, Suivi } from "@/v2/nébuleuse/types.js";
import type { Nébuleuse, ServicesNébuleuse } from "@/v2/nébuleuse/nébuleuse.js";

describe("Réseau", function () {
  describe("suivre connexions", function () {
    let nébuleuses: NébuleuseTest<Record<string, never>, ServicesAppli>[];
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
      for (const [i, nébuleuse] of nébuleuses.entries()) {
        const autresIds = idsLibp2p.filter((id) => id !== idsLibp2p[i]);

        const connexionsLibp2p = await obtenir<ConnexionLibp2p[]>(({ si }) =>
          nébuleuse.réseau.suivreConnexionsLibp2p({
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

    it("suivre connexions dispositifs", async () => {
      for (const [i, nébuleuse] of nébuleuses.entries()) {
        const autresIds = idsDispositifs.filter(
          (id) => id !== idsDispositifs[i],
        );

        const connexionsDispositifs = await obtenir<ConnexionDispositif[]>(
          ({ si }) =>
            nébuleuse.réseau.suivreConnexionsDispositifs({
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
      for (const [i, nébuleuse] of nébuleuses.entries()) {
        const autresIds = idsComptes.filter((id) => id !== idsComptes[i]);

        const connexionsComptes = await obtenir<ConnexionCompte[]>(({ si }) =>
          nébuleuse.réseau.suivreConnexionsComptes({
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
        const hélia = await nébuleuse.services.hélia.hélia();
        await nébuleuse.fermer();
        await hélia.stop();
      }

      const idRelai = obtenirAdresseRelai().split("/").pop();
      const connexionsLibp2p = await obtenir<ConnexionLibp2p[]>(({ si }) =>
        nébuleuses[0].réseau.suivreConnexionsLibp2p({
          f: si((x) => !x?.find((c) => c.pair !== idRelai)),
        }),
      );
      expect(connexionsLibp2p.filter((c) => c.pair !== idRelai)).to.be.empty();
    });

    it("déconnexion - suivi connexions dispositifs", async () => {
      const connexionsDispositifs = await obtenir<ConnexionDispositif[]>(
        ({ siVide }) =>
          nébuleuses[0].réseau.suivreConnexionsDispositifs({ f: siVide() }),
      );
      expect(connexionsDispositifs).to.be.empty();
    });

    it("déconnexion - suivi connexions comptes", async () => {
      const connexionsCompte = await obtenir<ConnexionCompte[]>(({ siVide }) =>
        nébuleuses[0].réseau.suivreConnexionsComptes({ f: siVide() }),
      );
      expect(connexionsCompte).to.be.empty();
    });
  });

  describe("suivre dispositifs", function () {
    let nébuleuses: NébuleuseTest<Record<string, never>, ServicesAppli>[];
    let fermer: Oublier;

    let idsDispositifs: string[];
    let idsComptes: string[];

    before(async () => {
      ({ nébuleuses, fermer } = await créerNébuleusesTest({ n: 3 }));

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

    it("un dispositif sur mon compte", async () => {
      const dispositifs = await obtenir<DispositifCompte[]>(({ si }) =>
        nébuleuses[0].réseau.suivreDispositifsCompte({
          f: si((x) => !!x?.length && x[0].statut === "accepté"),
        }),
      );

      const réf: DispositifCompte[] = [
        {
          idDispositif: idsDispositifs[0],
          statut: "accepté",
        },
      ];
      expect(dispositifs).to.have.deep.members(réf);
    });

    it("un dispositif sur autre compte", async () => {
      const dispositifs = await obtenir<DispositifCompte[]>(({ si }) =>
        nébuleuses[0].réseau.suivreDispositifsCompte({
          f: si((x) => !!x?.length && x[0].statut === "accepté"),
          idCompte: idsComptes[1],
        }),
      );
      const réf: DispositifCompte[] = [
        {
          idDispositif: idsDispositifs[1],
          statut: "accepté",
        },
      ];
      expect(dispositifs).to.have.deep.members(réf);
    });

    it("ajout dispositif - invité", async () => {
      const réf: DispositifCompte[] = [
        {
          idDispositif: idsDispositifs[1],
          statut: "accepté",
        },
        {
          idDispositif: idsDispositifs[2],
          statut: "invité",
        },
      ];
      await nébuleuses[1].compte.ajouterDispositif({
        idDispositif: idsDispositifs[2],
      });
      const dispositifs = await obtenir<DispositifCompte[]>(
        ({ siLongueurAuMoins }) =>
          nébuleuses[0].réseau.suivreDispositifsCompte({
            idCompte: idsComptes[1],
            f: siLongueurAuMoins(réf.length),
          }),
      );

      expect(dispositifs).to.have.deep.members(réf);
    });

    it("ajout dispositif - accepté", async () => {
      const réf: DispositifCompte[] = [
        {
          idDispositif: idsDispositifs[1],
          statut: "accepté",
        },
        {
          idDispositif: idsDispositifs[2],
          statut: "accepté",
        },
      ];
      await nébuleuses[2].compte.rejoindreCompte({ idCompte: idsComptes[1] });
      await nébuleuses[2].réseau.annoncerIdCompte();

      const dispositifs = await obtenir<DispositifCompte[]>(({ si }) =>
        nébuleuses[0].réseau.suivreDispositifsCompte({
          idCompte: idsComptes[1],
          f: si(
            (x) =>
              !!x && x?.length >= 2 && x.every((d) => d.statut === "accepté"),
          ),
        }),
      );
      expect(dispositifs).to.have.deep.members(réf);
    });
  });

  describe("confiance - manuelle", function () {
    let nébuleuses: NébuleuseTest[];
    let fermer: Oublier;

    let idsComptes: string[];

    before(async () => {
      ({ nébuleuses, fermer } = await créerNébuleusesTest({
        n: 2,
        persistante: true,
      }));

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
      }

      async fermer() {
        await this.service("réseau").désinscrireRésolutionConfiance({
          clef: this.clef,
        });
        return await super.fermer();
      }

      async [RÉSOLVEUR_CONFIANCE]({
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
      const comptes = await obtenir<CompteRéseau[]>(({ siLongueurAuMoins }) =>
        nébuleuses[0].réseau.suivreComptes({
          f: siLongueurAuMoins(3),
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

  describe("automatisation ajout dispositif", function () {
    let nébuleuses: NébuleuseTest[];
    let fermer: Oublier;

    let idsDispositifs: string[];
    let idsComptes: string[];

    let idBd: string;

    describe("requête du nouveau dispositif", async () => {
      before(async () => {
        ({ nébuleuses, fermer } = await créerNébuleusesTest({ n: 3 }));

        idsDispositifs = await Promise.all(
          nébuleuses.map((c) => c.compte.obtIdDispositif()),
        );
        idsComptes = await Promise.all(
          nébuleuses.map((c) => c.compte.obtIdCompte()),
        );

        const { bd, oublier } = await nébuleuses[0].compte.créerObjet({
          type: "keyvalue",
        });
        idBd = bd.address;
        await oublier();

        // Attendre que les dispositifs soient bien connectés
        await uneFois<ConnexionDispositif[]>(
          (fSuivi) =>
            nébuleuses[0].réseau.suivreConnexionsDispositifs({ f: fSuivi }),
          {
            condition: (connexions) =>
              !!connexions?.find((c) => c.idDispositif === idsDispositifs[1]),
          },
        );
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
          nébuleuses[0].compte.suivreDispositifsAutorisés({
            f: si((x) => !!x?.includes(idsDispositifs[1])),
          }),
        );
        expect(dispositifsCompte).to.have.members([
          idsDispositifs[0],
          idsDispositifs[1],
        ]);
      });

      it("le nouveau dispositif indique le nouveau compte", async () => {
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

        // Vérifier permission
        const permission = await obtenir(({ siDéfini }) =>
          nébuleuses[1].compte.suivrePermission({
            idObjet: idBd,
            f: siDéfini(),
          }),
        );
        expect(permission).to.equal(MODÉRATRICE);

        // Vérifier écriture données
        await bdSurNébuleuse2.set("a", 1);
        const données = await bdSurNébuleuse2.get("a");

        await oublier();
        expect(données).to.equal(1);
      });

      it("changement de compte propagé sur le réseau - suivi connexions comptes", async () => {
        const connexionCompte0 = await uneFois<ConnexionCompte>(
          async (fSuivi) =>
            nébuleuses[2].réseau.suivreConnexionsComptes({
              f: (connexions) =>
                fSuivi(
                  connexions.filter((c) => c.idCompte === idsComptes[0])[0],
                ),
            }),
          {
            condition: (connexion) =>
              !!connexion &&
              connexion.dispositifs.length >= 2 &&
              connexion.dispositifs.some(
                (d) => d.idDispositif === idsDispositifs[1],
              ),
          },
        );
        expect(
          connexionCompte0.dispositifs.map((d) => d.idDispositif),
        ).to.have.members([idsDispositifs[0], idsDispositifs[1]]);
      });

      it("changement de compte propagé sur le réseau - suivi dispositifs compte", async () => {
        const réf: DispositifCompte[] = [
          { idDispositif: idsDispositifs[0], statut: "accepté" },
          { idDispositif: idsDispositifs[1], statut: "accepté" },
        ];
        const dispositifsCompte1 = await obtenir<DispositifCompte[]>(({ si }) =>
          nébuleuses[2].réseau.suivreDispositifsCompte({
            f: si(
              (x) =>
                !!x && x.length >= 2 && x.every((d) => d.statut === "accepté"),
            ),
            idCompte: idsComptes[0],
          }),
        );
        expect(dispositifsCompte1).to.have.deep.members(réf);
      });
    });

    describe("requête du compte existant", async () => {
      before(async () => {
        ({ nébuleuses, fermer } = await créerNébuleusesTest({ n: 3 }));

        idsDispositifs = await Promise.all(
          nébuleuses.map((c) => c.compte.obtIdDispositif()),
        );
        idsComptes = await Promise.all(
          nébuleuses.map((c) => c.compte.obtIdCompte()),
        );

        const { bd, oublier } = await nébuleuses[0].compte.créerObjet({
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
          nébuleuses[0].compte.suivreDispositifsAutorisés({
            f: si((x) => !!x?.includes(idsDispositifs[1])),
          }),
        );
        expect(dispositifsCompte).to.have.members([
          idsDispositifs[0],
          idsDispositifs[1],
        ]);
      });

      it("le nouveau dispositif indique le nouveau compte", async () => {
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
          nébuleuses[1].compte.suivrePermission({
            idObjet: idBd,
            f: siDéfini(),
          }),
        );
        expect(permission).to.equal(MODÉRATRICE);

        await bdSurNébuleuse2.set("a", 1);
        await oublier();
      });

      it("changement de compte propagé sur le réseau", async () => {
        const connexionCompte0 = await uneFois<ConnexionCompte>(
          async (fSuivi) =>
            nébuleuses[2].réseau.suivreConnexionsComptes({
              f: (connexions) =>
                fSuivi(
                  connexions.filter((c) => c.idCompte === idsComptes[0])[0],
                ),
            }),
          {
            condition: (connexion) =>
              !!connexion &&
              connexion.dispositifs.length >= 2 &&
              connexion.dispositifs.some(
                (d) => d.idDispositif === idsDispositifs[1],
              ),
          },
        );

        expect(
          connexionCompte0.dispositifs.map((d) => d.idDispositif),
        ).to.have.members([idsDispositifs[0], idsDispositifs[1]]);
      });

      it("ça ne fonctionne pas avec le mauvais mot de passe", async () => {
        const invitation =
          await nébuleuses[0].réseau.générerInvitationRejoindreCompte();

        const { idPair } = invitation;

        const message: MessageAcceptationInvitationRejoindreCompte = {
          type: ACCEPTATION_INVITATION_REJOINDRE_COMPTE,
          idDispositif: idsDispositifs[2],
          empreinteCode: obtEmpreinteCode({
            codeSecret: "Mauvais code",
            identifiant: idsDispositifs[2],
          }),
        };
        await nébuleuses[2].réseau.envoyerMessageAuPair({ idPair, message });

        // À faire...test plus robuste qui attent que nébuleuses[0] reçoive bien le message
        const dispositifsCompte = await obtenir<string[]>(({ si }) =>
          nébuleuses[0].compte.suivreDispositifsAutorisés({
            f: si((x) => !!x?.includes(idsDispositifs[1])),
          }),
        );
        expect(dispositifsCompte).to.not.include(idsDispositifs[2]);
      });
    });
  });

  describe("messages", async () => {
    let fermer: () => Promise<void>;
    let nébuleuses: Nébuleuse[];

    let idsLibp2p: string[];
    let idsDispositifs: string[];
    let idsComptes: string[];

    before(async () => {
      ({ nébuleuses, fermer } = await créerNébuleusesTest({ n: 3 }));

      idsLibp2p = await Promise.all(
        nébuleuses.map(async (c) => await c.compte.obtIdLibp2p()),
      );
      idsDispositifs = await Promise.all(
        nébuleuses.map(async (c) => await c.compte.obtIdDispositif()),
      );
      idsComptes = await Promise.all(
        nébuleuses.map(async (c) => await c.compte.obtIdCompte()),
      );
    });

    after(async () => {
      await fermer?.();
    });

    const messageReçu = async ({
      de,
      à,
    }: {
      de: string;
      à: string | string[];
    }): Promise<{
      réception: Promise<{ [clef: string]: boolean }>;
      message: MessageRéseau;
    }> => {
      const messageÀEnvoyer = `C'est bien moi : ${de} ${uuidv4()}`;
      if (typeof à === "string") à = [à];

      const générerPromesseRéception = (
        d: string,
        signal?: AbortSignal,
      ): Promise<MessageRéseauAvecExpéditeur> => {
        const nébuleuse = nébuleuses[idsLibp2p.indexOf(d)];
        return uneFois<MessageRéseauAvecExpéditeur>(
          async (fSuivi) =>
            await nébuleuse.réseau.suivreMessages({
              f: fSuivi,
            }),
          {
            condition: (message) => {
              if (message?.message.type === "texte") {
                const corresp =
                  message.message.message === messageÀEnvoyer &&
                  message.expéditeur === de;
                return corresp;
              }
              return false;
            },
            signal,
          },
        );
      };

      const signaleur = new AbortController();
      const nonDestinataires = idsLibp2p.filter((n) => !à.includes(n));
      const réceptionsAttendues = à.map((d) => ({
        id: d,
        reçue: générerPromesseRéception(d),
      }));
      const réceptionsNonAttendues = nonDestinataires.map((d) => ({
        id: d,
        reçue: générerPromesseRéception(d, signaleur.signal),
      }));

      const promesseAttendues = Promise.allSettled(
        réceptionsAttendues.map((r) => r.reçue),
      );
      const promesseNonAttendues = Promise.allSettled(
        réceptionsNonAttendues.map((r) => r.reçue),
      );
      promesseAttendues.then(() => signaleur.abort());

      const réception = new Promise<{ [clef: string]: boolean }>((résoudre) => {
        Promise.all([promesseAttendues, promesseNonAttendues]).then(
          ([attendues, nonAttendues]) => {
            résoudre(
              Object.fromEntries([
                ...attendues.map((r, i) => [à[i], r.status === "fulfilled"]),
                ...nonAttendues.map((r, i) => [
                  nonDestinataires[i],
                  r.status === "fulfilled",
                ]),
              ]),
            );
          },
        );
      });

      return {
        réception,
        message: {
          type: "texte",
          message: messageÀEnvoyer,
        },
      };
    };

    const vérifierEnvoieMessage = async ({
      expéditeur,
      envoie,
      destinataires,
    }: {
      expéditeur: string;
      envoie: (msg: MessageRéseau) => Promise<void>;
      destinataires: Nébuleuse[];
    }) => {
      const idsLibp2pDestinataires: string[] = await Promise.all(
        destinataires.map((d) => d.compte.obtIdLibp2p()),
      );

      // Expéditeur
      const { réception, message } = await messageReçu({
        de: expéditeur,
        à: idsLibp2pDestinataires,
      });
      await envoie(message);

      const résultat = await réception;

      // Vérifier que uniquement reçu par les destinataires voulus
      expect(résultat).to.deep.equal(
        Object.fromEntries([
          ...idsLibp2pDestinataires.map((id) => [id, true]),
          ...idsLibp2p
            .filter((id) => !idsLibp2pDestinataires.includes(id))
            .map((id) => [id, false]),
        ]),
      );
    };

    it("envoyer message à une adresse libp2p", async () => {
      await vérifierEnvoieMessage({
        expéditeur: idsLibp2p[1],
        destinataires: [nébuleuses[0]],
        envoie: async (message) =>
          await nébuleuses[1].réseau.envoyerMessageAuPair({
            message,
            idPair: idsLibp2p[0],
          }),
      });
    });

    it("envoyer message à une adresse libp2p - retour", async () => {
      await vérifierEnvoieMessage({
        expéditeur: idsLibp2p[1],
        destinataires: [nébuleuses[0]],
        envoie: async (message) =>
          await nébuleuses[1].réseau.envoyerMessageAuPair({
            message,
            idPair: idsLibp2p[0],
          }),
      });
    });

    it("envoyer message à un autre dispositif", async () => {
      // Attendre que les dispositifs soient bien connectés
      await uneFois<ConnexionDispositif[]>(
        (fSuivi) =>
          nébuleuses[0].réseau.suivreConnexionsDispositifs({ f: fSuivi }),
        {
          condition: (connexions) =>
            !!connexions?.find((c) => c.idDispositif === idsDispositifs[1]),
        },
      );

      // Là on envoie le message
      await vérifierEnvoieMessage({
        expéditeur: idsLibp2p[0],
        destinataires: [nébuleuses[1]],
        envoie: async (message) =>
          await nébuleuses[0].réseau.envoyerMessageAuDispositif({
            message,
            idDispositif: idsDispositifs[1],
          }),
      });
    });

    it("envoyer message à un autre membre", async () => {
      // Attendre que les comptes soient bien connectés
      await uneFois<ConnexionCompte[]>(
        (fSuivi) => nébuleuses[0].réseau.suivreConnexionsComptes({ f: fSuivi }),
        {
          condition: (connexions) =>
            !!connexions?.find((c) => c.idCompte === idsComptes[1]),
        },
      );

      // Là on envoie le message
      await vérifierEnvoieMessage({
        expéditeur: idsLibp2p[0],
        destinataires: [nébuleuses[1]],
        envoie: async (message) =>
          await nébuleuses[0].réseau.envoyerMessageAuCompte({
            message,
            idCompte: idsComptes[1],
          }),
      });
    });

    it.skip("envoyer message à un autre membre qui a plusieurs dispositifs", async () => {
      const { promesseBienReçu, messageÀEnvoyer } = await messageReçu({
        de: idsDispositifs[0],
        à: [nébuleuses[1], nébuleuses[2]],
      });
      const invitation =
        await nébuleuses[1].réseau.générerInvitationRejoindreCompte();
      await nébuleuses[2].réseau.rejoindreCompteParInvitation({ invitation });
      await uneFois(
        async (fSuivi: Suivi<DispositifCompte[]>) => {
          return await nébuleuses[0].réseau.suivreDispositifsCompte({
            idCompte: idsComptes[1],
            f: fSuivi,
          });
        },
        { condition: (ids) => !!ids && ids.length > 1 },
      );

      await nébuleuses[0].réseau.envoyerMessageAuCompte({
        message: {
          type: "texte",
          message: messageÀEnvoyer,
        },
        idCompte: idsComptes[1],
      });

      const bienReçu = await promesseBienReçu;
      expect(bienReçu).to.be.true();
    });

    it.skip("message envoyé au compte non envoyé à dispositif non autorisé", async () => {
      throw new Error("à faire !!");
    });

    it.skip("erreur si envoyé à compte sans aucun dispositif connu", async () => {
      throw new Error("à faire !!");
    });

    it.skip("erreur si envoyé à dispositif sans pair libp2p connu", async () => {
      throw new Error("à faire !!");
    });

    it.skip("envoyer après reconnexion", async () => {
      const { promesseBienReçu, messageÀEnvoyer } = await messageReçu({
        de: idsDispositifs[0],
        à: nébuleuses[1],
      });
      const idLibp2pCompte2 = peerIdFromString(idsLibp2p[1]);
      const libp2pCompte1 = await nébuleuses[0].services["libp2p"].libp2p();

      await libp2pCompte1.hangUp(idLibp2pCompte2);
      await libp2pCompte1.dial(idLibp2pCompte2);

      await nébuleuses[0].réseau.envoyerMessageAuDispositif({
        message: {
          type: "texte",
          message: messageÀEnvoyer,
        },
        idDispositif: idsDispositifs[1],
      });
      const bienReçu = await promesseBienReçu;
      expect(bienReçu).to.be.true();
    });
  });

  describe("suivre relations réseau", function () {
    let fermer: () => Promise<void>;
    let nébuleuses: NébuleuseTest[];

    let rechercheRelations: ObtRechercheProfondeur<RelationRéseau>;

    let idsComptes: string[];

    const idCompteInexistant =
      "/nébuleuse/compte/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX";

    before(async () => {
      ({ nébuleuses, fermer } = await créerNébuleusesTest({ n: 3 }));

      idsComptes = await Promise.all(
        nébuleuses.map(async (c) => await c.compte.obtIdCompte()),
      );

      rechercheRelations = await rechercherProfondeur<RelationRéseau>(({ f }) =>
        nébuleuses[0].réseau.suivreRelationsRéseau({
          f,
        }),
      );
    });

    after(async () => {
      await fermer?.();
    });

    afterEach(async () => {
      await Promise.all(nébuleuses.map((n) => n.réseau.effacerConfiances()));
      rechercheRelations.p(Infinity);
    });

    it("rien pour commencer", async () => {
      const relations = await rechercheRelations.siVide();
      expect(relations).to.be.empty();
    });

    it("ajout relation", async () => {
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[1],
      });
      const relations = await rechercheRelations.siPasVide();

      const réf: RelationRéseau[] = [
        {
          de: idsComptes[0],
          pour: idsComptes[1],
          confiance: 1,
          profondeur: 0,
        },
      ];
      expect(relations).to.have.deep.members(réf);
    });

    it("enlever relation", async () => {
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[1],
      });
      await rechercheRelations.siPasVide();

      await nébuleuses[0].réseau.nePlusFaireConfianceAuCompte({
        idCompte: idsComptes[1],
      });
      const relations = await rechercheRelations.siVide();

      expect(relations).to.be.empty();
    });

    it("relations transitives", async () => {
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[1],
      });
      await nébuleuses[1].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[2],
      });

      const relations = await rechercheRelations.siAuMoins(2);

      const réf: RelationRéseau[] = [
        {
          de: idsComptes[0],
          pour: idsComptes[1],
          confiance: 1,
          profondeur: 0,
        },
        {
          de: idsComptes[1],
          pour: idsComptes[2],
          confiance: 1,
          profondeur: 1,
        },
      ];
      expect(relations).to.have.deep.members(réf);
    });

    it("diminuer profondeur", async () => {
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[1],
      });
      await nébuleuses[1].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[2],
      });

      await rechercheRelations.siAuMoins(2);
      await rechercheRelations.p(0);

      const relations = await rechercheRelations.siPasPlusQue(1);

      const réf: RelationRéseau[] = [
        {
          de: idsComptes[0],
          pour: idsComptes[1],
          confiance: 1,
          profondeur: 0,
        },
      ];
      expect(relations).to.have.deep.members(réf);
    });

    it.skip("augmenter profondeur", async () => {
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[1],
      });
      await nébuleuses[1].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[2],
      });
      await rechercheRelations.p(0);
      await rechercheRelations.siPasPlusQue(1);

      await rechercheRelations.p(5);

      const relations = await rechercheRelations.siAuMoins(2);

      const réf: RelationRéseau[] = [
        {
          de: idsComptes[0],
          pour: idsComptes[1],
          confiance: 1,
          profondeur: 0,
        },
        {
          de: idsComptes[1],
          pour: idsComptes[2],
          confiance: 1,
          profondeur: 1,
        },
      ];
      expect(relations).to.have.deep.members(réf);
    });

    it("changement relation transitive", async () => {
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[1],
      });
      await nébuleuses[1].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[2],
      });
      await rechercheRelations.siAuMoins(2);

      await nébuleuses[1].réseau.nePlusFaireConfianceAuCompte({
        idCompte: idsComptes[2],
      });

      const relations = await rechercheRelations.siPasPlusQue(1);

      const réf: RelationRéseau[] = [
        {
          de: idsComptes[0],
          pour: idsComptes[1],
          confiance: 1,
          profondeur: 0,
        },
      ];
      expect(relations).to.have.deep.members(réf);
    });

    it("membre non disponible", async () => {
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[1],
      });
      await nébuleuses[1].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[2],
      });
      await nébuleuses[2].réseau.faireConfianceAuCompte({
        idCompte: idCompteInexistant,
      });

      const relations = await rechercheRelations.siAuMoins(3);

      const réf: RelationRéseau[] = [
        {
          de: idsComptes[0],
          pour: idsComptes[1],
          confiance: 1,
          profondeur: 0,
        },
        {
          de: idsComptes[1],
          pour: idsComptes[2],
          confiance: 1,
          profondeur: 1,
        },
        {
          de: idsComptes[2],
          pour: idCompteInexistant,
          confiance: 1,
          profondeur: 2,
        },
      ];
      expect(relations).to.have.deep.members(réf);
    });

    it("circulairité", async () => {
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[1],
      });
      await nébuleuses[1].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[2],
      });
      await nébuleuses[2].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[0],
      });

      const relations = await rechercheRelations.siAuMoins(3);

      const réf: RelationRéseau[] = [
        {
          de: idsComptes[0],
          pour: idsComptes[1],
          confiance: 1,
          profondeur: 0,
        },
        {
          de: idsComptes[1],
          pour: idsComptes[2],
          confiance: 1,
          profondeur: 1,
        },
        {
          de: idsComptes[2],
          pour: idsComptes[0],
          confiance: 1,
          profondeur: 2,
        },
      ];
      expect(relations).to.have.deep.members(réf);
    });

    it("suivi réseau d'un tiers", async () => {
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[1],
      });
      await nébuleuses[1].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[2],
      });
      await nébuleuses[2].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[0],
      });

      const rechercheRelationsTiers =
        await rechercherProfondeur<RelationRéseau>(({ f }) =>
          nébuleuses[0].réseau.suivreRelationsRéseau({
            f,
            idCompte: idsComptes[1],
          }),
        );

      const relations = await rechercheRelationsTiers.siAuMoins(2);

      const réf: RelationRéseau[] = [
        {
          de: idsComptes[1],
          pour: idsComptes[2],
          confiance: 1,
          profondeur: 0,
        },
        {
          de: idsComptes[2],
          pour: idsComptes[0],
          confiance: 1,
          profondeur: 1,
        },
      ];
      expect(relations).to.have.deep.members(réf);
    });

    it("profondeur négative", async () => {
      expect(rechercheRelations.p(-1)).to.eventually.be.rejectedWith(
        "La profondeur ne peut pas être négative",
      );
    });

    it("profondeur fraction < 1", async () => {
      expect(rechercheRelations.p(0.4)).to.eventually.be.rejectedWith(
        "La profondeur doit être un nombre entier",
      );
    });

    it("profondeur fraction > 1", async () => {
      expect(rechercheRelations.p(1.4)).to.eventually.be.rejectedWith(
        "La profondeur doit être un nombre entier",
      );
    });

    it.skip("changement id compte original", async () => {
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[1],
      });
      await nébuleuses[1].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[2],
      });
      await nébuleuses[2].réseau.faireConfianceAuCompte({
        idCompte: idCompteInexistant,
      });
      await rechercheRelations.siAuMoins(2);

      await nébuleuses[1].compte.ajouterDispositif({
        idDispositif: await nébuleuses[0].compte.obtIdDispositif(),
      });

      await nébuleuses[0].compte.rejoindreCompte({ idCompte: idsComptes[1] });

      const relations = await rechercheRelations.si(
        (x) =>
          !!x &&
          x.length === 2 &&
          !!x.find((r) => r.de === idsComptes[1] && r.profondeur === 0),
      );

      const réf: RelationRéseau[] = [
        {
          de: idsComptes[1],
          pour: idsComptes[2],
          confiance: 1,
          profondeur: 0,
        },
        {
          de: idsComptes[2],
          pour: idCompteInexistant,
          confiance: 1,
          profondeur: 1,
        },
      ];
      expect(relations).to.have.deep.members(réf);
    });
  });

  describe("suivre comptes par profondeur", function () {
    let fermer: () => Promise<void>;
    let nébuleuses: NébuleuseTest[];

    let rechercheComptes: ObtRechercheProfondeur<CompteRéseau>;

    let idsComptes: string[];

    before(async () => {
      ({ nébuleuses, fermer } = await créerNébuleusesTest({ n: 3 }));

      idsComptes = await Promise.all(
        nébuleuses.map(async (c) => await c.compte.obtIdCompte()),
      );

      rechercheComptes = await rechercherProfondeur<CompteRéseau>(({ f }) =>
        nébuleuses[0].réseau.suivreComptesRéseau({
          f,
        }),
      );
    });

    after(async () => {
      await fermer?.();
    });

    afterEach(async () => {
      await Promise.all(nébuleuses.map((n) => n.réseau.effacerConfiances()));
      rechercheComptes.p(Infinity);
    });

    it("priorité score fiable", async () => {
      // 1 bloque 2
      await nébuleuses[1].réseau.bloquerCompte({ idCompte: idsComptes[2] });

      // 0 fait confiance à 1 et à 2
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[1],
      });
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[2],
      });

      const comptes = await rechercheComptes.siAuMoins(2);

      const réf: CompteRéseau[] = [
        {
          idCompte: idsComptes[1],
          confiance: 1,
          profondeur: 0,
        },
        {
          idCompte: idsComptes[2],
          confiance: 1,
          profondeur: 0,
        },
      ];
      expect(comptes).to.have.deep.members(réf);
    });

    it("priorité score bloqué", async () => {
      // 0 bloque 2, fait confiance à 1
      await nébuleuses[0].réseau.bloquerCompte({ idCompte: idsComptes[2] });
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[1],
      });

      // 1 fait confiance à 2
      await nébuleuses[1].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[2],
      });

      const comptes = await rechercheComptes.siAuMoins(2);
      const réf: CompteRéseau[] = [
        {
          idCompte: idsComptes[1],
          confiance: 1,
          profondeur: 0,
        },
        {
          idCompte: idsComptes[2],
          confiance: -1,
          profondeur: 0,
        },
      ];
      expect(comptes).to.have.deep.members(réf);
    });

    it("confiance transitive", async () => {
      // 0 fait confiance à 1
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[1],
      });

      // 1 fait confiance à 2
      await nébuleuses[1].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[2],
      });

      const comptes = await rechercheComptes.siAuMoins(2);
      const réf: CompteRéseau[] = [
        {
          idCompte: idsComptes[1],
          confiance: 1,
          profondeur: 0,
        },
        {
          idCompte: idsComptes[2],
          confiance: FACTEUR_ATÉNUATION_CONFIANCE_POSITIVE,
          profondeur: 1,
        },
      ];
      expect(comptes).to.have.deep.members(réf);
    });

    it("confiance négative transitive", async () => {
      // 0 fait confiance à 1
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[1],
      });

      // 1 bloque 2
      await nébuleuses[1].réseau.bloquerCompte({ idCompte: idsComptes[2] });

      const comptes = await rechercheComptes.si(
        (r) =>
          !!r &&
          r.length >= 2 &&
          r.filter((x) => x.idCompte === idsComptes[2])[0].confiance < 0,
      );
      const réf: CompteRéseau[] = [
        {
          idCompte: idsComptes[1],
          confiance: 1,
          profondeur: 0,
        },
        {
          idCompte: idsComptes[2],
          confiance: -FACTEUR_ATÉNUATION_CONFIANCE_NÉGATIVE,
          profondeur: 1,
        },
      ];
      expect(comptes).to.have.deep.members(réf);
    });

    it("diminuer profondeur", async () => {
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[1],
      });
      await nébuleuses[1].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[2],
      });

      await rechercheComptes.siAuMoins(2);
      await rechercheComptes.p(0);

      const comptes = await rechercheComptes.siPasPlusQue(1);

      const réf: CompteRéseau[] = [
        {
          idCompte: idsComptes[1],
          confiance: 1,
          profondeur: 0,
        },
      ];
      expect(comptes).to.have.deep.members(réf);
    });

    it.skip("augmenter profondeur", async () => {
      await nébuleuses[0].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[1],
      });
      await nébuleuses[1].réseau.faireConfianceAuCompte({
        idCompte: idsComptes[2],
      });

      await rechercheComptes.siAuMoins(2);
      await rechercheComptes.p(0);

      await rechercheComptes.siPasPlusQue(1);

      await rechercheComptes.p(5);

      const comptes = await rechercheComptes.siAuMoins(2);

      const réf: CompteRéseau[] = [
        {
          idCompte: idsComptes[1],
          confiance: 1,
          profondeur: 0,
        },
        {
          idCompte: idsComptes[2],
          confiance: FACTEUR_ATÉNUATION_CONFIANCE_POSITIVE,
          profondeur: 1,
        },
      ];
      expect(comptes).to.have.deep.members(réf);
    });
  });
});
