import chai, { expect } from "chai";
import { step } from "mocha-steps";
import chaiAsPromised from "chai-as-promised";

import all from "it-all";
import toBuffer from "it-to-buffer";

import ClientConstellation, { infoAccès } from "@/client";
import {
  adresseOrbiteValide,
  schémaFonctionSuivi,
  schémaFonctionOublier,
  faisRien,
  uneFois,
} from "@/utils"

import { MEMBRE, MODÉRATEUR } from "@/accès/consts";

import FeedStore from "orbit-db-feedstore";
import KeyValueStore from "orbit-db-kvstore";

import { testAPIs, config } from "./sfipTest";
import { générerClients, peutÉcrire, attendreRésultat } from "./utils";

chai.should();
chai.use(chaiAsPromised);

const assert = chai.assert;

Object.keys(testAPIs).forEach((API) => {
  describe("adresseOrbiteValide", function () {
    it("adresse orbite est valide", () => {
      const valide = adresseOrbiteValide(
        "/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX/7e0cde32-7fee-487c-ad6e-4247f627488e"
      );
      expect(valide).to.be.true;
    });
    it("CID SFIP n'est pas valide", () => {
      const valide = adresseOrbiteValide(
        "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ"
      );
      expect(valide).to.be.false;
    });
  });

  describe("Client Constellation", function () {
    this.timeout(config.timeout);

    let fOublierClients: () => Promise<void>;
    let clients: ClientConstellation[];
    let client: ClientConstellation,
      client2: ClientConstellation,
      client3: ClientConstellation;

    let idOrbite1: string;
    let idOrbite3: string;

    let idbdCompte1: string;
    let idbdCompte2: string;

    before(async () => {
      ({ fOublier: fOublierClients, clients } = await générerClients(3, API));
      [client, client2, client3] = clients;

      idbdCompte1 = await uneFois(
        async (
          fSuivi: schémaFonctionSuivi<string>
        ): Promise<schémaFonctionOublier> => {
          return await client.suivreIdBdCompte(fSuivi);
        }
      );

      idbdCompte2 = await uneFois(
        async (
          fSuivi: schémaFonctionSuivi<string>
        ): Promise<schémaFonctionOublier> => {
          return await client2.suivreIdBdCompte(fSuivi);
        }
      );

      idOrbite1 = await client.obtIdOrbite();
      idOrbite3 = await client3.obtIdOrbite();
    });

    after(async () => {
      if (fOublierClients) await fOublierClients();
    });

    it("Le client devrait être initialisé", async () => {
      expect(client.prêt).to.be.true;
    });

    describe("Signer", function () {
      it("La signature devrait être valide", async () => {
        const message = "Je suis un message";
        const signature = await client.signer(message);
        const valide = await client.vérifierSignature(signature, message);
        expect(valide).to.be.true;
      });
      it("La signature ne devrait pas être valide pour un autre message", async () => {
        const message = "Je suis un message";
        const autreMessage = "Je suis un message!";
        const signature = await client.signer(message);
        const valide = await client.vérifierSignature(signature, autreMessage);
        expect(valide).to.be.false;
      });
    });

    describe("Contrôle dispositifs", function () {
      let fOublierDispositifs: schémaFonctionOublier;
      let fOublierIdBdCompte: schémaFonctionOublier;

      let mesDispositifs: string[];
      let idBdCompte3EnDirecte: string | undefined;

      let idOrbiteClient3Après: string;

      before(async () => {
        fOublierDispositifs = await client.suivreDispositifs(
          (dispositifs) => (mesDispositifs = dispositifs)
        );
        fOublierIdBdCompte = await client3.suivreIdBdCompte(
          (id) => (idBdCompte3EnDirecte = id)
        );
      });
      after(async () => {
        if (fOublierDispositifs) fOublierDispositifs();
        if (fOublierIdBdCompte) fOublierIdBdCompte();
      });
      step("Mon dispositif est présent", async () => {
        expect(mesDispositifs)
          .to.be.an("array")
          .that.has.lengthOf(1)
          .and.that.includes(idOrbite1);
      });
      describe("Ajouter dispositif", function () {
        let idBd: string;

        before(async () => {
          await client.ajouterDispositif(idOrbite3);
          await client3.rejoindreCompte(idbdCompte1);
          idBd = await client.créerBdIndépendante("kvstore");
          idOrbiteClient3Après = await client3.obtIdOrbite();
        });

        it("Mes dispositifs sont mis à jour", async () => {
          expect(mesDispositifs).to.have.lengthOf(2).and.to.include(idOrbite3);
        });

        it("Le nouveau dispositif a rejoint notre compte", () => {
          expect(idBdCompte3EnDirecte).to.equal(idbdCompte1);
        });

        it("idOrbite ne change pas", async () => {
          expect(idOrbiteClient3Après).to.equal(idOrbite3);
        });

        it("Le nouveau dispositif peut modifier mes BDs", async () => {
          const {bd: bd_orbite3, fOublier } = await client3.ouvrirBd<KeyValueStore<number>>(idBd);
          const autorisé = await peutÉcrire(bd_orbite3, client3.orbite);
          fOublier();
          expect(autorisé).to.be.true;
        });
      });
    });

    describe("Suivre BD", function () {
      let idBd: string;
      let fOublier: schémaFonctionOublier;
      let bd: KeyValueStore<number>
      let fOublierBd: schémaFonctionOublier;
      let données: { [key: string]: number };

      before(async () => {
        idBd = await client.créerBdIndépendante("kvstore");
        ({ bd, fOublier: fOublierBd } = await client.ouvrirBd<KeyValueStore<number>>(idBd));
        await bd.put("a", 1);
        const fSuivre = (_bd: KeyValueStore<number>) => {
          const d = _bd.all;
          données = d;
        };
        const fOublierSuivre = await client.suivreBd(idBd, fSuivre);
        fOublier = () => {
          fOublierBd();
          fOublierSuivre();
        }
      });

      after(async () => {
        fOublier();
      });

      it("Les données initiales sont détectées", async () => {
        expect(données.a).to.equal(1);
      });

      it("Les changements sont détectés", async () => {
        await bd.put("b", 2);
        expect(données.b).to.equal(2);
      });
    });

    describe("Suivre BD de fonction", function () {
      let idBd: string;
      let idBd2: string;
      let bd: KeyValueStore<number>;
      let bd2: KeyValueStore<number>;
      let fOublierBd: schémaFonctionOublier;
      let fOublierBd2: schémaFonctionOublier;
      let données: { [key: string]: number } | undefined;
      let fSuivre: (id: string) => Promise<void>;
      let fOublier: schémaFonctionOublier;

      const changerBd = async (id: string) => {
        await fSuivre(id);
      };
      before(async () => {
        idBd = await client.créerBdIndépendante("kvstore");
        idBd2 = await client.créerBdIndépendante("kvstore");
        ({bd, fOublier: fOublierBd} = await client.ouvrirBd(idBd));
        ({bd: bd2, fOublier: fOublierBd2} = await client.ouvrirBd(idBd2));
        const fRacine = async (
          fSuivreRacine: (nouvelIdBdCible: string) => Promise<void>
        ): Promise<schémaFonctionOublier> => {
          fSuivre = fSuivreRacine;
          return faisRien;
        };
        const f = (valeurs?: {[key: string]: number}) => {
          données = valeurs;
        };
        const fSuivre_ = async (idBd_: string, fSuivreBd: schémaFonctionSuivi<{[key: string]: number}>): Promise<schémaFonctionOublier> => {
          return await client.suivreBdDic(idBd_, fSuivreBd)
        }
        const fOublierSuivre = await client.suivreBdDeFonction(fRacine, f, fSuivre_);
        fOublier = () => {
          fOublierSuivre();
          fOublierBd();
          fOublierBd2();
        }
      });
      after(async () => {
        if (bd) await bd.close();
        if (bd2) await bd2.close();
        if (fOublier) fOublier();
      });
      it("`undefined` est retourné si la fonction ne renvoie pas de BD", async () => {
        expect(données).to.be.undefined;
      });
      it("Les changements à la BD suivie sont détectés", async () => {
        await changerBd(idBd);
        await bd.put("a", 1);
        expect(données).to.not.be.undefined;
        expect(données!.a).to.equal(1);
      });
      it("Les changements à l'id de la BD suivie sont détectés", async () => {
        await bd2.put("a", 2);
        await changerBd(idBd2);
        expect(données).to.not.be.undefined;
        expect(données!.a).to.equal(2);
      });
    });

    describe("Suivre BD de clef", function () {
      let idBdBase: string;
      let bdBase: KeyValueStore<string>;
      let idBd: string | undefined;

      let données: { [key: string]: number } | undefined;

      const CLEF = "clef";
      const fsOublier: schémaFonctionOublier[] = [];


      before(async () => {
        idBdBase = await client.créerBdIndépendante("kvstore");
        const { bd: bd_, fOublier } = await client.ouvrirBd<KeyValueStore<string>>(idBdBase);
        bdBase = bd_
        fsOublier.push(fOublier);

        const f = (valeurs: {[key: string]: number} | undefined) => {
          données = valeurs
        };
        const fSuivre = async (idBd_: string, fSuivreBd: schémaFonctionSuivi<{[key: string]: number}>): Promise<schémaFonctionOublier> => {
          return await client.suivreBdDic(idBd_, fSuivreBd)
        }
        fsOublier.push(await client.suivreBdDeClef(idBdBase, CLEF, f, fSuivre));
      });

      after(async () => {
        fsOublier.forEach(f=>f());
      });

      it("`undefined` est retourné si la clef n'existe pas", async () => {
        expect(données).to.be.undefined;
      });

      it("Les changements à la BD suivie sont détectés", async () => {
        idBd = await client.obtIdBd(CLEF, idBdBase, "kvstore");
        const {bd, fOublier } = await client.ouvrirBd<KeyValueStore<number>>(idBd!);
        fsOublier.push(fOublier);

        await bd.put("a", 1);
        expect(données).to.not.be.undefined;
        expect(données!.a).to.equal(1);
      });

      it("Les changements à la clef sont détectés", async () => {
        const idBd2 = await client.créerBdIndépendante("kvstore");
        const {bd, fOublier} = await client.ouvrirBd<KeyValueStore<number>>(idBd2);
        fsOublier.push(fOublier);

        await bd.put("a", 2);
        await bdBase.put(CLEF, idBd2);
        expect(données).to.not.be.undefined;
        expect(données!.a).to.equal(2);
      });
    });

    describe("Suivre BD dic de clef", function () {
      let idBdBase: string;
      let idBd: string;
      let données: { [key: string]: number };

      const CLEF = "clef";
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBdBase = await client.créerBdIndépendante("kvstore");

        idBd = await client.créerBdIndépendante("kvstore");

        const fSuivre = (d: { [key: string]: number }) => (données = d);
        await client.suivreBdDicDeClef(idBdBase, CLEF, fSuivre);
      });

      after(async () => {
        fsOublier.forEach(f=>f());
      });

      it("`{}` est retourné si la clef n'existe pas", async () => {
        expect(données).to.be.empty;
      });

      it("Les données sont retournés en format objet", async () => {
        const {bd: bdBase, fOublier: fOublierBase} = await client.ouvrirBd<KeyValueStore<string>>(idBdBase);
        fsOublier.push(fOublierBase)
        await bdBase.put(CLEF, idBd);
        expect(données).to.be.empty;

        const {bd, fOublier} = await client.ouvrirBd<KeyValueStore<number>>(idBd);
        fsOublier.push(fOublier);
        await bd.put("a", 1);
        expect(données.a).to.equal(1);
      });
    });

    describe("Suivre BD liste de clef", function () {
      let idBdBase: string;
      let idBd: string;
      let donnéesValeur: number[];
      let données: LogEntry<number>[];

      const CLEF = "clef";
      const fsOublier: schémaFonctionOublier[] = []

      before(async () => {
        idBdBase = await client.créerBdIndépendante("kvstore");

        idBd = await client.créerBdIndépendante("feed");

        const fSuivreValeur = (d: number[]) => (donnéesValeur = d);
        const fSuivre = (d: LogEntry<number>[]) => (données = d);
        await client.suivreBdListeDeClef(idBdBase, CLEF, fSuivreValeur, true);
        await client.suivreBdListeDeClef(idBdBase, CLEF, fSuivre, false);
      });
      after(async () => {
        fsOublier.forEach(f=>f());
      });
      step("`[]` est retourné si la clef n'existe pas", async () => {
        expect(donnéesValeur).to.be.an("array").that.is.empty;
        expect(données).to.be.an("array").that.is.empty;
      });
      step("Avec renvoyer valeur", async () => {
        const {bd: bdBase, fOublier: fOublierBase} = await client.ouvrirBd<KeyValueStore<string>>(idBdBase);
        fsOublier.push(fOublierBase)

        await bdBase.put(CLEF, idBd);
        expect(donnéesValeur).to.be.empty;

        const {bd, fOublier} = await client.ouvrirBd<FeedStore<number>>(idBd);
        fsOublier.push(fOublier);

        await bd.add(1);
        await bd.add(2);
        expect(donnéesValeur).to.include.members([1, 2]);
      });
      step("Sans renvoyer valeur", async () => {
        expect(données).to.have.lengthOf(2);
        expect(données.map((d) => d.payload.value)).to.include.members([1, 2]);
      });
    });

    describe("Suivre BD liste", function () {
      let idBd: string;
      let donnéesValeur: number[];
      let données: LogEntry<number>[];

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBd = await client.créerBdIndépendante("feed");

        const fSuivreValeur = (d: number[]) => (donnéesValeur = d);
        const fSuivre = (d: LogEntry<number>[]) => (données = d);
        fsOublier.push(await client.suivreBdListe(idBd, fSuivreValeur, true));
        fsOublier.push(await client.suivreBdListe(idBd, fSuivre, false));
      });

      after(async () => {
        fsOublier.forEach(f=>f());
      });

      it("Avec renvoyer valeur", async () => {
        expect(donnéesValeur).to.be.empty;

        const {bd, fOublier} = await client.ouvrirBd<FeedStore<number>>(idBd);
        fsOublier.push(fOublier);

        await bd.add(1);
        await bd.add(2);
        expect(donnéesValeur).to.include.members([1, 2]);
      });

      it("Sans renvoyer valeur", async () => {
        expect(données).to.have.lengthOf(2);
        expect(données.map((d) => d.payload.value)).to.include.members([1, 2]);
      });
    });

    describe("Rechercher élément BD liste selon empreinte", function () {
      let idBd: string;
      let bd: FeedStore<string>;
      let fOublier: schémaFonctionOublier;

      before(async () => {
        idBd = await client.créerBdIndépendante("feed");
        ({bd, fOublier} = await client.ouvrirBd<FeedStore<string>>(idBd));
        await bd.add("abc");
      });
      after(async () => {
        if (fOublier) fOublier();
      });

      it("On retrouve le bon élément", async () => {
        const fRecherche = (e: LogEntry<string>): boolean => {
          return e.payload.value === "abc";
        };
        const résultat = await client.rechercherBdListe(idBd, fRecherche);
        expect(résultat?.payload.value).to.equal("abc");
      });

      it("`undefined` est retourné si l'empreinte n'existe pas", async () => {
        const fRecherche = (e: LogEntry<string>): boolean => {
          return e.payload.value === "def";
        };
        const résultat = await client.rechercherBdListe(idBd, fRecherche);
        expect(résultat).to.be.undefined;
      });
    });

    describe("Suivre BDs de BD liste", function () {
      let idBdListe: string;
      let idBd1: string;
      let idBd2: string;

      type branche = { [key: string]: number };
      let données: branche[];
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBdListe = await client.créerBdIndépendante("feed");
        const { bd: bdListe, fOublier } = await client.ouvrirBd<FeedStore<string>>(idBdListe);
        fsOublier.push(fOublier);

        const fBranche = async (
          id: string,
          f: schémaFonctionSuivi<branche>
        ) => {
          return await client.suivreBd<KeyValueStore<number>>(id, _bd => f(_bd.all));
        };
        const fSuivi = (x: branche[]) => {
          données = x;
        };
        fsOublier.push(await client.suivreBdsDeBdListe(idBdListe, fSuivi, fBranche));

        idBd1 = await client.créerBdIndépendante("kvstore");
        idBd2 = await client.créerBdIndépendante("kvstore");
        const {bd: bd1, fOublier: fOublier1 } = await client.ouvrirBd<KeyValueStore<number>>(idBd1);
        fsOublier.push(fOublier1)
        const {bd: bd2, fOublier: fOublier2 } = await client.ouvrirBd<KeyValueStore<number>>(idBd2);
        fsOublier.push(fOublier2)

        await bd1.put("a", 1);
        await bd2.put("b", 2);

        await bdListe.add(idBd1);
        await bdListe.add(idBd2);
      });
      after(() => {
        fsOublier.forEach(f=>f());
      });
      it("Les éléments sont retournés", async () => {
        expect(données).to.be.an("array");
        expect(données).to.deep.equal([{ a: 1 }, { b: 2 }]);
      });
    });

    describe("Suivre BDs de fonction", function () {
      describe("De liste ids BDs", function () {
        let fSuivre: (ids: string[]) => Promise<void>;
        let résultats: number[];
        let idBd1: string;
        let idBd2: string;

        const fsOublier: schémaFonctionOublier[] = [];

        const changerBds = async (ids: string[]) => {
          await fSuivre(ids);
        };

        before(async () => {
          idBd1 = await client.créerBdIndépendante("kvstore");
          idBd2 = await client.créerBdIndépendante("kvstore");
          const {bd: bd1, fOublier: fOublier1} = await client.ouvrirBd<KeyValueStore<number>>(idBd1);
          fsOublier.push(fOublier1);
          const {bd: bd2, fOublier: fOublier2} = await client.ouvrirBd<KeyValueStore<number>>(idBd2);
          fsOublier.push(fOublier2);

          await bd1.put("a", 1);
          await bd1.put("b", 2);
          await bd2.put("c", 3);

          const fListe = async (
            fSuivreRacine: (éléments: string[]) => Promise<void>
          ): Promise<schémaFonctionOublier> => {
            fSuivre = fSuivreRacine;
            return faisRien;
          };
          const f = (x: number[]) => (résultats = x);
          const fBranche = async (
            id: string,
            f: schémaFonctionSuivi<number[]>
          ): Promise<schémaFonctionOublier> => {
            return await client.suivreBd(id, (bd: KeyValueStore<number>) => {
              const vals: number[] = Object.values(bd.all);
              f(vals);
            });
          };
          fsOublier.push(await client.suivreBdsDeFonctionListe(fListe, f, fBranche));
        });
        after(() => {
          fsOublier.forEach(f=>f());
        });

        it("Sans branches", async () => {
          expect(résultats).to.be.undefined;
        });
        it("Ajout d'une branche ou deux", async () => {
          await changerBds([idBd1, idBd2]);
          expect(résultats).to.be.an("array").with.lengthOf(3);
          expect(résultats).to.include.members([1, 2, 3]);
        });
        it("Enlever une branche", async () => {
          await changerBds([idBd1]);
          expect(résultats).to.be.an("array").with.lengthOf(2);
          expect(résultats).to.include.members([1, 2]);
        });
      });

      describe("Avec branches complexes", function () {
        type branche = {
          nom: string;
          id: string;
        };
        let fSuivre: (ids: branche[]) => Promise<void>;

        let résultats: number[];

        let idBd1: string;
        let idBd2: string;

        const fsOublier: schémaFonctionOublier[] = [];

        const fListe = async (
          fSuivreRacine: (éléments: branche[]) => Promise<void>
        ): Promise<schémaFonctionOublier> => {
          fSuivre = fSuivreRacine;
          return faisRien;
        };
        const f = (x: number[]) => (résultats = x);
        const fBranche = async (
          id: string,
          f: schémaFonctionSuivi<number[]>
        ): Promise<schémaFonctionOublier> => {
          return await client.suivreBd(id, (bd: KeyValueStore<number>) => {
            const vals: number[] = Object.values(bd.all);
            f(vals);
          });
        };

        const fIdBdDeBranche = (x: branche) => x.id;
        const fCode = (x: branche) => x.id;

        const changerBds = async (ids: string[]) => {
          await fSuivre(
            ids.map((id) => {
              return { nom: "abc", id: id };
            })
          );
        };
        before(async () => {
          idBd1 = await client.créerBdIndépendante("kvstore");
          idBd2 = await client.créerBdIndépendante("kvstore");

          const {bd: bd1, fOublier: fOublier1} = await client.ouvrirBd<KeyValueStore<number>>(idBd1);
          fsOublier.push(fOublier1)
          const {bd: bd2, fOublier: fOublier2} = await client.ouvrirBd<KeyValueStore<number>>(idBd2);
          fsOublier.push(fOublier2)

          await bd1.put("a", 1);
          await bd1.put("b", 2);
          await bd2.put("c", 3);

          fsOublier.push(await client.suivreBdsDeFonctionListe(
            fListe,
            f,
            fBranche,
            fIdBdDeBranche,
            undefined,
            fCode
          ));
          await changerBds([idBd1, idBd2]);
        });
        after(() => {
          fsOublier.forEach(f=>f());
        });

        it("Ajout d'une branche ou deux", async () => {
          expect(résultats).to.be.an("array").with.lengthOf(3);
          expect(résultats).to.include.members([1, 2, 3]);
        });

        it("Avec fRéduction complèxe", async () => {
          const fRéduction = (branches: number[][]) => [
            ...branches.map((b) => b[0]),
          ];

          fsOublier.push(await client.suivreBdsDeFonctionListe(
            fListe,
            f,
            fBranche,
            fIdBdDeBranche,
            fRéduction,
            fCode
          ));
        });
      });

      describe("Avec branches complexes sans fCode", function () {
        type branche = {
          nom: string;
        };
        let fSuivre: (ids: branche[]) => Promise<void>;
        let fOublier: schémaFonctionOublier;
        const fListe = async (
          fSuivreRacine: (éléments: branche[]) => Promise<void>
        ): Promise<schémaFonctionOublier> => {
          fSuivre = fSuivreRacine;
          return faisRien;
        };
        before(async () => {
          fOublier = await client.suivreBdsDeFonctionListe(
            fListe,
            faisRien,
            async () => faisRien
          );
        });
        after(async () => {
          if (fOublier) fOublier();
        });

        it("Ajout d'une branche ou deux", async () => {
          assert.isRejected(fSuivre([{ nom: "abc" }]));
        });
      });
    });

    describe("Suivre BDs selon condition", function () {
      let idBd1: string;
      let idBd2: string;

      let sélectionnées: string[];
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBd1 = await client.créerBdIndépendante("kvstore");
        idBd2 = await client.créerBdIndépendante("kvstore");

        const fListe = async (
          fSuivreRacine: (ids: string[]) => Promise<void>
        ): Promise<schémaFonctionOublier> => {
          fSuivreRacine([idBd1, idBd2]);
          return faisRien;
        };
        const fCondition = async (
          id: string,
          fSuivreCondition: (état: boolean) => void
        ): Promise<schémaFonctionOublier> => {
          const f = (bd: KeyValueStore<number>) =>
            fSuivreCondition(Object.keys(bd.all).length > 0);
          return await client.suivreBd(id, f);
        };
        fsOublier.push(await client.suivreBdsSelonCondition(
          fListe,
          fCondition,
          (idsBds) => (sélectionnées = idsBds)
        ));
      });
      after(() => {
        fsOublier.forEach(f=>f());
      });
      it("Seules les bonnes BDs sont retournées", async () => {
        expect(sélectionnées).to.be.an("array").that.is.empty;

        const {bd: bd1, fOublier: fOublier1} = await client.ouvrirBd<KeyValueStore<number>>(idBd1);
        fsOublier.push(fOublier1)
        await bd1.put("a", 1);

        expect(sélectionnées).to.be.an("array").with.lengthOf(1);
        expect(sélectionnées).to.include.members([idBd1]);
      });
      it("Les changements aux conditions sont détectés", async () => {
        const {bd: bd2, fOublier: fOublier2} = await client.ouvrirBd<KeyValueStore<number>>(idBd2);
        fsOublier.push(fOublier2)

        await bd2.put("a", 1);
        expect(sélectionnées).to.include.members([idBd1, idBd2]);
      });
    });

    describe("Opérations SFIP", function () {
      let cid: string;
      const texte = "வணக்கம்";
      step("On ajoute un fichier au SFIP", async () => {
        cid = await client.ajouterÀSFIP(texte);
      });
      step("On télécharge le fichier du SFIP", async () => {
        const données = await client.obtFichierSFIP(cid);
        expect(données).to.not.be.null;
        expect(new TextDecoder().decode(données!)).to.equal(texte);
      });
      step("On télécharge le fichier en tant qu'itérable", async () => {
        const flux = client.obtItérableAsyncSFIP(cid);
        const données = await toBuffer(flux);
        expect(données).to.not.be.null;
        expect(new TextDecoder().decode(données!)).to.equal(texte);
      });
    });

    describe("Ouvrir BD", function () {
      let idBd: string;
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBd = await client.créerBdIndépendante("kvstore");
      });

      after(()=>{
        fsOublier.forEach(f=>f());
      })

      it("On obtient la BD", async () => {
        const {bd, fOublier} = await client.ouvrirBd(idBd);
        fsOublier.push(fOublier);
        expect(adresseOrbiteValide(bd.address.toString())).to.be.true;
      });
      it("On évite la concurrence", async () => {
        const bds = await Promise.all(
          [1, 2].map(async () => {
            const {bd, fOublier} = await client.ouvrirBd(idBd);
            fsOublier.push(fOublier);
            return bd
          })
        );
        expect(bds[0] === bds[1]).to.be.true;
      });
    });

    describe("Obtenir ID BD", function () {
      let idRacine: string;
      let idBd: string;

      let bdRacine: KeyValueStore<string>
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idRacine = await client.créerBdIndépendante("kvstore");
        const {bd,  fOublier} = await client.ouvrirBd<KeyValueStore<string>>(idRacine);
        bdRacine = bd
        fsOublier.push(fOublier);

        idBd = await client.créerBdIndépendante("feed");
        await bdRacine.put("clef", idBd);
      });

      after(()=> {
        fsOublier.forEach(f=>f());
      })

      it("Avec racine chaîne", async () => {
        const idBdRetrouvée = await client.obtIdBd("clef", idRacine);
        expect(idBdRetrouvée).to.equal(idBd);
      });

      it("Avec racine BD", async () => {
        const idBdRetrouvée = await client.obtIdBd("clef", bdRacine);
        expect(idBdRetrouvée).to.equal(idBd);
      });

      it("Avec mauvais type spécifié", async () => {
        const idBdRetrouvée = await client.obtIdBd("clef", bdRacine, "kvstore");
        expect(idBdRetrouvée).to.be.undefined;
      });

      it("On crée la BD si elle n'existait pas", async () => {
        const idBdRetrouvée = await client.obtIdBd(
          "je n'existe pas encore",
          bdRacine,
          "feed"
        );
        expect(adresseOrbiteValide(idBdRetrouvée)).to.be.true;
      });

      it("Mais on ne crée pas la BD on n'a pas la permission sur la BD racine", async () => {
        const idBdRetrouvée = await client2.obtIdBd(
          "et moi je n'existerai jamais",
          bdRacine,
          "feed"
        );
        expect(idBdRetrouvée).to.be.undefined;
      });

      it("On ne perd pas les données en cas de concurrence entre dispositifs", async () => {
        // Créons une nouvelle BD avec des données
        const NOUVELLE_CLEF = "nouvelle clef";
        const idNouvelleBd = await client.obtIdBd(
          NOUVELLE_CLEF,
          idRacine,
          "feed"
        );
        expect(idNouvelleBd).to.exist;

        const {bd, fOublier} = await client.ouvrirBd<FeedStore<string>>(idNouvelleBd!);
        fsOublier.push(fOublier);

        await bd.add("Salut !");
        await bd.add("வணக்கம்!");

        // Simulons un autre dispositif qui écrit à la même clef de manière concurrente
        const idBdConcurrente = await client.créerBdIndépendante("feed");
        const {bd: bdConcurrent, fOublier: fOublierConcurrente} = await client.ouvrirBd<FeedStore<string>>(
          idBdConcurrente
        );
        fsOublier.push(fOublierConcurrente);

        await bdConcurrent.add("કેમ છો");
        await bdRacine.put(NOUVELLE_CLEF, idBdConcurrente);

        // Il ne devrait tout de même pas y avoir perte de données
        const idBdRetrouvée = await client.obtIdBd(
          NOUVELLE_CLEF,
          idRacine,
          "feed"
        );
        const {bd: bdRetrouvée, fOublier: fOublierRetrouvée} = await client.ouvrirBd<FeedStore<string>>(
          idBdRetrouvée!
        );
        fsOublier.push(fOublierRetrouvée);

        const éléments = ClientConstellation.obtÉlémentsDeBdListe(bdRetrouvée);
        expect(éléments).to.include.members(["Salut !", "வணக்கம்!", "કેમ છો"]);
      });
    });

    describe("Créer BD indépendante", function () {
      const fsOublier: schémaFonctionOublier[] = []

      after(()=>{
        fsOublier.forEach(f=>f());
      });

      it("La BD est crée", async () => {
        const idBd = await client.créerBdIndépendante("kvstore");
        expect(adresseOrbiteValide(idBd)).to.be.true;
      });
      it("Avec sa propre bd accès l'utilisateur", async () => {
        const optionsAccès = {
          adresseBd: undefined,
          premierMod: client.bdCompte!.id,
        };
        const idBd = await client.créerBdIndépendante("kvstore", optionsAccès);

        const {bd, fOublier} = await client.ouvrirBd<KeyValueStore<number>>(idBd);
        fsOublier.push(fOublier);

        const autorisé = await peutÉcrire(bd, client.orbite);
        expect(autorisé).to.be.true;
      });
      it("Avec accès personalisé", async () => {
        const optionsAccès = { premierMod: client2.orbite!.identity.id };
        const idBd = await client.créerBdIndépendante("kvstore", optionsAccès);

        const {bd: bd_orbite2, fOublier} = await client2.ouvrirBd<KeyValueStore<number>>(idBd);
        fsOublier.push(fOublier);

        const autorisé = await peutÉcrire(bd_orbite2, client2.orbite);

        expect(autorisé).to.be.true;
      });
    });

    describe("Combiner BDs", function () {
      const fsOublier: schémaFonctionOublier[] = []

      after(()=>{
        fsOublier.forEach(f=>f());
      });

      it("Combiner BD dic", async () => {
        const idBdDic1 = await client.créerBdIndépendante("kvstore");
        const idBdDic2 = await client.créerBdIndépendante("kvstore");

        const {bd: bdDic1, fOublier: fOublierDic1 } = await client.ouvrirBd<KeyValueStore<number>>(idBdDic1);
        const {bd: bdDic2, fOublier: fOublierDic2 } = await client.ouvrirBd<KeyValueStore<number>>(idBdDic2);

        fsOublier.push(fOublierDic1);
        fsOublier.push(fOublierDic2);

        await bdDic1.put("clef 1", 1);
        await bdDic1.put("clef 2", 2);
        await bdDic2.put("clef 1", -1);
        await bdDic2.put("clef 3", 3);

        await client.combinerBdsDict(bdDic1, bdDic2);
        const données = bdDic1.all;

        expect(données).to.deep.equal({
          "clef 1": 1,
          "clef 2": 2,
          "clef 3": 3,
        });
      });

      it("Combiner BD liste", async () => {
        const idBdListe1 = await client.créerBdIndépendante("feed");
        const idBdListe2 = await client.créerBdIndépendante("feed");

        const {bd: bdListe1, fOublier: fOublierListe1} = await client.ouvrirBd<FeedStore<number>>(idBdListe1);
        const {bd: bdListe2, fOublier: fOublierListe2 } = await client.ouvrirBd<FeedStore<number>>(idBdListe2);

        fsOublier.push(fOublierListe1);
        fsOublier.push(fOublierListe2);

        await bdListe1.add(1);
        await bdListe1.add(2);
        await bdListe2.add(1);
        await bdListe2.add(3);

        await client.combinerBdsListe(bdListe1, bdListe2);
        const données = ClientConstellation.obtÉlémentsDeBdListe(bdListe1);

        expect(données).to.be.an("array").with.lengthOf(3);
        expect(données).to.include.members([1, 2, 3]);
      });

      it("Combiner BD liste avec indexe", async () => {
        const idBdListe1 = await client.créerBdIndépendante("feed");
        const idBdListe2 = await client.créerBdIndépendante("feed");


        const {bd: bdListe1, fOublier: fOublierListe1} = await client.ouvrirBd<FeedStore<{temps: number, val: number}>>(idBdListe1);
        const {bd: bdListe2, fOublier: fOublierListe2 } = await client.ouvrirBd<FeedStore<{temps: number, val: number}>>(idBdListe2);

        fsOublier.push(fOublierListe1);
        fsOublier.push(fOublierListe2);

        await bdListe1.add({ temps: 1, val: 1 });
        await bdListe1.add({ temps: 2, val: 2 });
        await bdListe2.add({ temps: 1, val: 2 });
        await bdListe2.add({ temps: 3, val: 3 });

        await client.combinerBdsListe(bdListe1, bdListe2, ["temps"]);
        const données = ClientConstellation.obtÉlémentsDeBdListe(bdListe1);

        expect(données).to.be.an("array").with.lengthOf(3);
        expect(données).to.deep.include.members([
          { temps: 1, val: 1 },
          { temps: 2, val: 2 },
          { temps: 3, val: 3 },
        ]);
      });

      it("Combiner BD dic récursif", async () => {
        const idBdDic1 = await client.créerBdIndépendante("kvstore");
        const idBdDic2 = await client.créerBdIndépendante("kvstore");

        const { bd: bdDic1, fOublier: fOublierDic1 } = await client.ouvrirBd<KeyValueStore<string>>(idBdDic1);
        const { bd: bdDic2, fOublier: fOublierDic2 } = await client.ouvrirBd<KeyValueStore<string>>(idBdDic2);

        fsOublier.push(fOublierDic1);
        fsOublier.push(fOublierDic2);

        const idBdListe1 = await client.créerBdIndépendante("feed");
        const idBdListe2 = await client.créerBdIndépendante("feed");

        const {bd: bdListe1, fOublier: fOublierListe1} = await client.ouvrirBd<FeedStore<number>>(idBdListe1);
        const {bd: bdListe2, fOublier: fOublierListe2} = await client.ouvrirBd<FeedStore<number>>(idBdListe2);

        fsOublier.push(fOublierListe1);
        fsOublier.push(fOublierListe2);

        await bdListe1.add(1);
        await bdListe2.add(1);
        await bdListe2.add(2);

        await bdDic1.put("clef", idBdListe1);
        await bdDic2.put("clef", idBdListe2);

        await client.combinerBdsDict(bdDic1, bdDic2);

        const idBdListeFinale = bdDic1.get("clef");
        const {bd: bdListeFinale, fOublier: fOublierBdListeFinale} = await client.ouvrirBd<FeedStore<number>>(
          idBdListeFinale
        );

        fsOublier.push(fOublierBdListeFinale);

        const données = ClientConstellation.obtÉlémentsDeBdListe(bdListeFinale);

        expect(données).to.be.an("array").with.lengthOf(2);
        expect(données).to.deep.include.members([1, 2]);
      });

      it("Combiner BD liste récursif", async () => {
        const idBdListe1 = await client.créerBdIndépendante("feed");
        const idBdListe2 = await client.créerBdIndépendante("feed");

        const {bd: bdListe1, fOublier: fOublierBdListe1} = await client.ouvrirBd<FeedStore<{indexe: number, idBd: string}>>(idBdListe1);
        const {bd: bdListe2, fOublier: fOublierBdListe2} = await client.ouvrirBd<FeedStore<{indexe: number, idBd: string}>>(idBdListe2);

        fsOublier.push(fOublierBdListe1);
        fsOublier.push(fOublierBdListe2);

        const idSubBd1 = await client.créerBdIndépendante("feed");
        const idSubBd2 = await client.créerBdIndépendante("feed");

        const { bd: subBd1, fOublier: fOublierSubBd1 } = await client.ouvrirBd<FeedStore<number>>(idSubBd1);
        const { bd: subBd2, fOublier: fOublierSubBd2 } = await client.ouvrirBd<FeedStore<number>>(idSubBd2);

        fsOublier.push(fOublierSubBd1);
        fsOublier.push(fOublierSubBd2);

        await subBd1.add(1);
        await subBd2.add(1);
        await subBd2.add(2);

        type élément = { indexe: number; idBd: string };
        await bdListe1.add({ indexe: 1, idBd: idSubBd1 });
        await bdListe2.add({ indexe: 1, idBd: idSubBd2 });

        await client.combinerBdsListe(bdListe1, bdListe2, ["indexe"]);

        const donnéesBdListe: élément[] =
          ClientConstellation.obtÉlémentsDeBdListe(bdListe1);
        expect(donnéesBdListe).to.be.an("array").with.lengthOf(1);

        const idBdListeFinale = donnéesBdListe[0]!.idBd;
        const {bd: subBdFinale, fOublier: fOublierSubBdFinale } = await client.ouvrirBd<FeedStore<number>>(
          idBdListeFinale
        );

        fsOublier.push(fOublierSubBdFinale);

        const données = ClientConstellation.obtÉlémentsDeBdListe(subBdFinale);

        expect(données).to.be.an("array").with.lengthOf(2);
        expect(données).to.deep.include.members([1, 2]);
      });
    });

    describe("Effacer BD", function () {

      let idBd: string;
      const fsOublier: schémaFonctionOublier[] = []

      before(async () => {
        idBd = await client.créerBdIndépendante("kvstore");
        const {bd, fOublier} = await client.ouvrirBd<KeyValueStore<number>>(idBd);
        fsOublier.push(fOublier);

        await bd.put("test", 123);
        await bd.close();
      });

      after(()=>{
        fsOublier.forEach(f=>f());
      });

      it("Les données n'existent plus", async () => {
        await client.effacerBd(idBd);
        const {bd, fOublier} = await client.ouvrirBd<KeyValueStore<string>>(idBd);

        fsOublier.push(fOublier);

        const val = bd.get("test");

        expect(val).to.be.undefined;
      });
    });

    describe("Suivre mes permissions", function () {
      const rés = { ultat: undefined as string | undefined };
      let idBd: string;

      const fsOublier: schémaFonctionOublier[] = []

      before(async () => {
        idBd = await client.créerBdIndépendante("kvstore", {
          adresseBd: undefined,
          premierMod: client.bdCompte!.id,
        });

        fsOublier.push(await client2.suivrePermission(idBd, (p) => {
          rés.ultat = p;
        }));
      });

      after(()=>{
        fsOublier.forEach(f=>f());
      });

      step("On n'a pas d'accès avant", async () => {
        expect(rés.ultat).to.be.undefined;
      });

      step("On détecte l'ajout d'une permission membre", async () => {
        await client.donnerAccès(idBd, idbdCompte2, MEMBRE);
        await attendreRésultat(rés, "ultat");
        expect(rés.ultat).to.equal(MEMBRE);
      });

      step("Le nouveau membre peut modifier la BD", async () => {
        const {bd, fOublier} = await client2.ouvrirBd<KeyValueStore<number>>(idBd);

        fsOublier.push(fOublier);

        const permission = await peutÉcrire(bd, client2.orbite);
        expect(permission).to.be.true;
      });

      step("On détecte l'ajout d'une permission modératrice", async () => {
        await client.donnerAccès(idBd, idbdCompte2, MODÉRATEUR);
        await attendreRésultat(rés, "ultat", MODÉRATEUR);
        expect(rés.ultat).to.equal(MODÉRATEUR);
      });

    });

    describe("Suivre accès et permissions BD", function () {
      let fOublier: schémaFonctionOublier;
      let fOublierÉcrire: schémaFonctionOublier;
      let fOublierPermission: schémaFonctionOublier;

      let lAccès: infoAccès[];
      let idBd: string;
      const résultatPermission = {
        permission: undefined as typeof MODÉRATEUR | typeof MEMBRE | undefined,
      };
      let permissionÉcrire = false;

      before(async () => {
        idBd = await client.créerBdIndépendante("kvstore", {
          adresseBd: undefined,
          premierMod: client.bdCompte!.id,
        });
        const f = (accès: infoAccès[]) => {
          lAccès = accès;
        };
        fOublier = await client.suivreAccèsBd(idBd, f);

        const fÉcrire = (accès: boolean) => {
          permissionÉcrire = accès;
        };
        fOublierÉcrire = await client2.suivrePermissionÉcrire(idBd, fÉcrire);

        const fPermission = (accès?: typeof MODÉRATEUR | typeof MEMBRE) => {
          résultatPermission.permission = accès;
        };
        fOublierPermission = await client2.suivrePermission(idBd, fPermission);
      });
      after(async () => {
        if (fOublier) fOublier();
        if (fOublierÉcrire) fOublierÉcrire();
        if (fOublierPermission) fOublierPermission();
      });
      step("On détecte l'ajout d'une permission membre", async () => {
        await client.donnerAccès(idBd, idbdCompte2, MEMBRE);
        await attendreRésultat(résultatPermission, "permission", MEMBRE);

        const infoInvité = lAccès.find((a) => a.idBdCompte === idbdCompte2);
        expect(infoInvité?.rôle).to.equal(MEMBRE);
      });

      step("L'invité détecte l'ajout de sa permission membre", async () => {
        expect(permissionÉcrire).to.be.true;
        expect(résultatPermission.permission).to.equal(MEMBRE);
      });

      step("On détecte l'ajout d'une permission modératrice", async () => {
        await client.donnerAccès(idBd, idbdCompte2, MODÉRATEUR);
        await attendreRésultat(résultatPermission, "permission", MODÉRATEUR);

        const infoInvité = lAccès.find((a) => a.idBdCompte === idbdCompte2);
        expect(infoInvité?.rôle).to.equal(MODÉRATEUR);
      });

      step(
        "L'invité détecte l'ajout de sa permission modératrice",
        async () => {
          expect(permissionÉcrire).to.be.true;
          expect(résultatPermission.permission).to.equal(MODÉRATEUR);
        }
      );
    });

    describe("Épingler BD", function () {
      let idBdKv: string;
      let idBdListe: string;
      let idBdKv2: string;

      let cidTexte: string;

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBdKv = await client.créerBdIndépendante("kvstore");
        const {bd: bdKv, fOublier: fOublierKv } = await client.ouvrirBd<KeyValueStore<string>>(idBdKv);

        fsOublier.push(fOublierKv);

        idBdListe = await client.créerBdIndépendante("feed");
        const {bd: bdListe, fOublier: fOublierBdListe } = await client.ouvrirBd<FeedStore<string>>(idBdListe);

        fsOublier.push(fOublierBdListe);

        idBdKv2 = await client.créerBdIndépendante("kvstore");

        await bdKv.put("ma bd liste", idBdListe);
        await bdListe.add(idBdKv2);

        cidTexte = (await client2.sfip!.add("Bonjour !")).cid.toString(); // Utiliser ipfs2 pour ne pas l'ajouter à ipfs1 directement (simuler adition d'un autre membre)
        await bdListe.add(cidTexte);

        await client.épingles!.épinglerBd(idBdKv);
      });

      after(() => {
        fsOublier.forEach(f=>f());
      });

      step("La BD est épinglée", async () => {
        expect(client._bds[idBdKv]).to.exist;
      });
      step("Récursion KVStore", async () => {
        expect(client._bds[idBdListe]).to.exist;
      });
      step("Récursion FeedStore", async () => {
        expect(client._bds[idBdKv2]).to.exist;
      });
      step("Les fichiers SFIP sont également épinglés", async () => {
        let fichierEstÉpinglé = false;
        await new Promise<void>((résoudre) => {
          const interval = setInterval(async () => {
            const épinglés = await all(client.sfip!.pin.ls());
            fichierEstÉpinglé = épinglés
              .map((x) => x.cid.toString())
              .includes(cidTexte);
            if (fichierEstÉpinglé) {
              clearInterval(interval);
              résoudre();
            }
          }, 50);
        });

        expect(fichierEstÉpinglé).to.be.true;
      });
    });
  });
});
