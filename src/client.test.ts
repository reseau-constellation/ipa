import isArray from "lodash/isArray";

import all from "it-all";
import toBuffer from "it-to-buffer";

import ClientConstellation, { infoAccès } from "@/client.js";
import {
  adresseOrbiteValide,
  schémaFonctionSuivi,
  schémaFonctionOublier,
  faisRien,
} from "@/utils/index.js";

import { MEMBRE, MODÉRATEUR } from "@/accès/consts";

import FeedStore from "orbit-db-feedstore";
import KeyValueStore from "orbit-db-kvstore";

import {
  générerClients,
  peutÉcrire,
  AttendreRésultat,
  clientsConnectés,
} from "@/utilsTests";
import { config } from "@/utilsTests/sfipTest";
import type { OptionsContrôleurConstellation } from "@/accès/cntrlConstellation";

describe("adresseOrbiteValide", function () {
  test("adresse orbite est valide", () => {
    const valide = adresseOrbiteValide(
      "/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX/7e0cde32-7fee-487c-ad6e-4247f627488e"
    );
    expect(valide).toBe(true);
  });
  test("CID SFIP n'est pas valide", () => {
    const valide = adresseOrbiteValide(
      "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ"
    );
    expect(valide).toBe(false);
  });
});

describe("Contrôle dispositifs", function () {
  let fOublierClients: () => Promise<void>;
  let clients: ClientConstellation[];
  let client: ClientConstellation,
    client2: ClientConstellation,
    client3: ClientConstellation;

  let fOublierDispositifs: schémaFonctionOublier;
  let fOublierIdBdCompte: schémaFonctionOublier;

  let idOrbite1: string;
  let idOrbite2: string;
  let idOrbite3: string;

  let idBdCompte1: string;

  let mesDispositifs: string[];
  let idBdCompte2EnDirecte: string | undefined;

  beforeAll(async () => {
    ({ fOublier: fOublierClients, clients } = await générerClients(3));
    [client, client2, client3] = clients;

    idBdCompte1 = await client.obtIdCompte();

    idOrbite1 = await client.obtIdOrbite();
    idOrbite2 = await client2.obtIdOrbite();
    idOrbite3 = await client3.obtIdOrbite();
    fOublierDispositifs = await client.suivreDispositifs({
      f: (dispositifs) => (mesDispositifs = dispositifs),
    });
    fOublierIdBdCompte = await client2.suivreIdBdCompte({
      f: (id) => (idBdCompte2EnDirecte = id),
    });
  }, config.patienceInit * 3);
  afterAll(async () => {
    if (fOublierDispositifs) fOublierDispositifs();
    if (fOublierIdBdCompte) fOublierIdBdCompte();
    if (fOublierClients) fOublierClients();
  });
  test("Mon dispositif est présent", async () => {
    expect(isArray(mesDispositifs)).toBe(true);
    expect(mesDispositifs).toHaveLength(1);
    expect(mesDispositifs).toEqual(expect.arrayContaining([idOrbite1]));
  });

  describe("Ajouter dispositif manuellement", function () {
    let idBd: string;

    beforeAll(async () => {
      await client.ajouterDispositif({ idOrbite: idOrbite2 });
      await client2.rejoindreCompte({ idBdCompte: idBdCompte1 });
      idBd = await client.créerBdIndépendante({ type: "kvstore" });
    }, config.patienceInit);

    test("Mes dispositifs sont mis à jour", async () => {
      expect(mesDispositifs).toHaveLength(2);
      expect(mesDispositifs).toEqual(expect.arrayContaining([idOrbite2]));
    });

    test("Le nouveau dispositif a rejoint notre compte", () => {
      expect(idBdCompte2EnDirecte).toEqual(idBdCompte1);
    });

    test("idOrbite ne change pas", async () => {
      const idOrbiteClient2Après = await client2.obtIdOrbite();
      expect(idOrbiteClient2Après).toEqual(idOrbite2);
    });

    test("Le nouveau dispositif peut modifier mes BDs", async () => {
      const { bd: bd_orbite2, fOublier } = await client2.ouvrirBd<
        KeyValueStore<number>
      >({ id: idBd });
      const autorisé = await peutÉcrire(bd_orbite2, client2.orbite);
      fOublier();
      expect(autorisé).toBe(true);
    });
  });

  describe("Automatiser ajout dispositif", function () {
    let idBd: string;

    beforeAll(async () => {
      idBd = await client.créerBdIndépendante({ type: "kvstore" });
      await clientsConnectés(client3, client);
      const invitation = await client.générerInvitationRejoindreCompte();
      await client3.demanderEtPuisRejoindreCompte(invitation);
    }, config.patienceInit);

    test("Nouveau dispositif ajouté au compte", async () => {
      expect(mesDispositifs).toEqual(
        expect.arrayContaining([idOrbite1, idOrbite2, idOrbite3])
      );
    });

    test("Nouveau dispositif indique le nouveau compte", async () => {
      expect(client3.idBdCompte).toEqual(client.idBdCompte);
    });

    test("Le nouveau dispositif peut modifier mes BDs", async () => {
      const { bd: bd_orbite3, fOublier } = await client3.ouvrirBd<
        KeyValueStore<number>
      >({ id: idBd });
      const autorisé = await peutÉcrire(bd_orbite3, client3.orbite);
      fOublier();
      expect(autorisé).toBe(true);
    });
  });
});

describe("Fonctionalités client", function () {
  let fOublierClients: () => Promise<void>;
  let clients: ClientConstellation[];
  let client: ClientConstellation, client2: ClientConstellation;

  let idbdCompte2: string;

  beforeAll(async () => {
    ({ fOublier: fOublierClients, clients } = await générerClients(2));
    [client, client2] = clients;

    idbdCompte2 = await client2.obtIdCompte();
  }, config.patienceInit * 2);

  afterAll(async () => {
    if (fOublierClients) await fOublierClients();
  });

  test("Le client devrait être initialisé", async () => {
    expect(client.prêt).toBe(true);
  });

  describe("Signer", function () {
    test("La signature devrait être valide", async () => {
      const message = "Je suis un message";
      const signature = await client.signer({ message });
      const valide = await client.vérifierSignature({ signature, message });
      expect(valide).toBe(true);
    });
    test("La signature ne devrait pas être valide pour un autre message", async () => {
      const message = "Je suis un message";
      const autreMessage = "Je suis un message!";
      const signature = await client.signer({ message });
      const valide = await client.vérifierSignature({
        signature,
        message: autreMessage,
      });
      expect(valide).toBe(false);
    });
  });

  describe("Suivre BD", function () {
    let idBd: string;
    let fOublier: schémaFonctionOublier;
    let bd: KeyValueStore<number>;
    let fOublierBd: schémaFonctionOublier;
    let données: { [key: string]: number };

    beforeAll(async () => {
      idBd = await client.créerBdIndépendante({ type: "kvstore" });
      ({ bd, fOublier: fOublierBd } = await client.ouvrirBd<
        KeyValueStore<number>
      >({ id: idBd }));
      await bd.put("a", 1);
      const fSuivre = (_bd: KeyValueStore<number>) => {
        const d = _bd.all;
        données = d;
      };
      const fOublierSuivre = await client.suivreBd({ id: idBd, f: fSuivre });
      fOublier = async () => {
        await fOublierBd();
        await fOublierSuivre();
      };
    }, config.patience);

    afterAll(async () => {
      await fOublier();
    });

    test("Les données initiales sont détectées", async () => {
      expect(données.a).toEqual(1);
    });

    test("Les changements sont détectés", async () => {
      await bd.put("b", 2);
      expect(données.b).toEqual(2);
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
    beforeAll(async () => {
      idBd = await client.créerBdIndépendante({ type: "kvstore" });
      idBd2 = await client.créerBdIndépendante({ type: "kvstore" });
      ({ bd, fOublier: fOublierBd } = await client.ouvrirBd<
        KeyValueStore<number>
      >({ id: idBd }));
      ({ bd: bd2, fOublier: fOublierBd2 } = await client.ouvrirBd<
        KeyValueStore<number>
      >({
        id: idBd2,
      }));
      const fRacine = async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (nouvelIdBdCible: string) => Promise<void>;
      }): Promise<schémaFonctionOublier> => {
        fSuivre = fSuivreRacine;
        return faisRien;
      };
      const f = (valeurs?: { [key: string]: number }) => {
        données = valeurs;
      };
      const fSuivre_ = async ({
        id,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: schémaFonctionSuivi<{ [key: string]: number }>;
      }): Promise<schémaFonctionOublier> => {
        return await client.suivreBdDic({ id, f: fSuivreBd });
      };
      const fOublierSuivre = await client.suivreBdDeFonction({
        fRacine,
        f,
        fSuivre: fSuivre_,
      });
      fOublier = async () => {
        await fOublierSuivre();
        await fOublierBd();
        await fOublierBd2();
      };
    }, config.patience);
    afterAll(async () => {
      if (bd) await bd.close();
      if (bd2) await bd2.close();
      if (fOublier) await fOublier();
    });
    test("`undefined` est retourné si la fonction ne renvoie pas de BD", async () => {
      expect(données).toBeUndefined();
    });
    test("Les changements à la BD suivie sont détectés", async () => {
      await changerBd(idBd);
      await bd.put("a", 1);
      expect(données).not.toBeUndefined();
      expect(données!.a).toEqual(1);
    });
    test("Les changements à l'id de la BD suivie sont détectés", async () => {
      await bd2.put("a", 2);
      await changerBd(idBd2);
      expect(données).not.toBeUndefined();
      expect(données!.a).toEqual(2);
    });
  });

  describe("Suivre BD de clef", function () {
    let idBdBase: string;
    let bdBase: KeyValueStore<string>;
    let idBd: string | undefined;

    let données: { [key: string]: number } | undefined;

    const CLEF = "clef";
    const fsOublier: schémaFonctionOublier[] = [];

    beforeAll(async () => {
      idBdBase = await client.créerBdIndépendante({ type: "kvstore" });
      const { bd: bd_, fOublier } = await client.ouvrirBd<
        KeyValueStore<string>
      >({ id: idBdBase });
      bdBase = bd_;
      fsOublier.push(fOublier);

      const f = (valeurs: { [key: string]: number } | undefined) => {
        données = valeurs;
      };
      const fSuivre = async ({
        id,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: schémaFonctionSuivi<{ [key: string]: number }>;
      }): Promise<schémaFonctionOublier> => {
        return await client.suivreBdDic({ id, f: fSuivreBd });
      };
      fsOublier.push(
        await client.suivreBdDeClef({ id: idBdBase, clef: CLEF, f, fSuivre })
      );
    }, config.patience);

    afterAll(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    test("`undefined` est retourné si la clef n'existe pas", async () => {
      expect(données).toBeUndefined();
    });

    test("Les changements à la BD suivie sont détectés", async () => {
      idBd = await client.obtIdBd({
        nom: CLEF,
        racine: idBdBase,
        type: "kvstore",
      });
      const { bd, fOublier } = await client.ouvrirBd<KeyValueStore<number>>({
        id: idBd!,
      });
      fsOublier.push(fOublier);

      await bd.put("a", 1);
      expect(données).not.toBeUndefined();
      expect(données!.a).toEqual(1);
    });

    test("Les changements à la clef sont détectés", async () => {
      const idBd2 = await client.créerBdIndépendante({ type: "kvstore" });
      const { bd, fOublier } = await client.ouvrirBd<KeyValueStore<number>>({
        id: idBd2,
      });
      fsOublier.push(fOublier);

      await bd.put("a", 2);
      await bdBase.put(CLEF, idBd2);
      expect(données).not.toBeUndefined();
      expect(données!.a).toEqual(2);
    });
  });

  describe("Suivre BD dic de clef", function () {
    let idBdBase: string;
    let idBd: string;
    let données: { [key: string]: number };

    const CLEF = "clef";
    const fsOublier: schémaFonctionOublier[] = [];

    beforeAll(async () => {
      idBdBase = await client.créerBdIndépendante({ type: "kvstore" });

      idBd = await client.créerBdIndépendante({ type: "kvstore" });

      const fSuivre = (d: { [key: string]: number }) => (données = d);
      await client.suivreBdDicDeClef({
        id: idBdBase,
        clef: CLEF,
        f: fSuivre,
      });
    }, config.patience);

    afterAll(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    test("`{}` est retourné si la clef n'existe pas", async () => {
      expect(Object.keys(données)).toHaveLength(0);
    });

    test("Les données sont retournés en format objet", async () => {
      const { bd: bdBase, fOublier: fOublierBase } = await client.ouvrirBd<
        KeyValueStore<string>
      >({ id: idBdBase });
      fsOublier.push(fOublierBase);
      await bdBase.put(CLEF, idBd);
      expect(Object.keys(données)).toHaveLength(0);

      const { bd, fOublier } = await client.ouvrirBd<KeyValueStore<number>>({
        id: idBd,
      });
      fsOublier.push(fOublier);
      await bd.put("a", 1);
      expect(données.a).toEqual(1);
    });
  });

  describe("Suivre BD liste de clef", function () {
    let idBdBase: string;
    let idBd: string;
    let donnéesValeur: number[];
    let données: LogEntry<number>[];

    const CLEF = "clef";
    const fsOublier: schémaFonctionOublier[] = [];

    beforeAll(async () => {
      idBdBase = await client.créerBdIndépendante({ type: "kvstore" });

      idBd = await client.créerBdIndépendante({ type: "feed" });

      const fSuivreValeur = (d: number[]) => (donnéesValeur = d);
      const fSuivre = (d: LogEntry<number>[]) => (données = d);
      await client.suivreBdListeDeClef({
        id: idBdBase,
        clef: CLEF,
        f: fSuivreValeur,
        renvoyerValeur: true,
      });
      await client.suivreBdListeDeClef({
        id: idBdBase,
        clef: CLEF,
        f: fSuivre,
        renvoyerValeur: false,
      });
    }, config.patience);
    afterAll(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });
    test("`[]` est retourné si la clef n'existe pas", async () => {
      expect(isArray(donnéesValeur)).toBe(true);
      expect(donnéesValeur).toHaveLength(0);
      expect(isArray(données)).toBe(true);
      expect(données).toHaveLength(0);
    });
    test("Avec renvoyer valeur", async () => {
      const { bd: bdBase, fOublier: fOublierBase } = await client.ouvrirBd<
        KeyValueStore<string>
      >({ id: idBdBase });
      fsOublier.push(fOublierBase);

      await bdBase.put(CLEF, idBd);
      expect(donnéesValeur).toHaveLength(0);

      const { bd, fOublier } = await client.ouvrirBd<FeedStore<number>>({
        id: idBd,
      });
      fsOublier.push(fOublier);

      await bd.add(1);
      await bd.add(2);
      expect(donnéesValeur).toEqual(expect.arrayContaining([1, 2]));
    });
    test("Sans renvoyer valeur", async () => {
      expect(données).toHaveLength(2);
      expect(données.map((d) => d.payload.value)).toEqual(
        expect.arrayContaining([1, 2])
      );
    });
  });

  describe("Suivre BD liste", function () {
    let idBd: string;
    let donnéesValeur: number[];
    let données: LogEntry<number>[];

    const fsOublier: schémaFonctionOublier[] = [];

    beforeAll(async () => {
      idBd = await client.créerBdIndépendante({ type: "feed" });

      const fSuivreValeur = (d: number[]) => (donnéesValeur = d);
      const fSuivre = (d: LogEntry<number>[]) => (données = d);
      fsOublier.push(
        await client.suivreBdListe({
          id: idBd,
          f: fSuivreValeur,
          renvoyerValeur: true,
        })
      );
      fsOublier.push(
        await client.suivreBdListe({
          id: idBd,
          f: fSuivre,
          renvoyerValeur: false,
        })
      );
    }, config.patience);

    afterAll(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    test("Avec renvoyer valeur", async () => {
      expect(donnéesValeur).toHaveLength(0);

      const { bd, fOublier } = await client.ouvrirBd<FeedStore<number>>({
        id: idBd,
      });
      fsOublier.push(fOublier);

      await bd.add(1);
      await bd.add(2);
      expect(donnéesValeur).toEqual(expect.arrayContaining([1, 2]));
    });

    test("Sans renvoyer valeur", async () => {
      expect(données).toHaveLength(2);
      expect(données.map((d) => d.payload.value)).toEqual(
        expect.arrayContaining([1, 2])
      );
    });
  });

  describe("Suivre BDs récursives", function () {
    let idBd: string;
    let idBdListe: string;
    let idBd2: string;
    let fOublier: schémaFonctionOublier;

    const rés = new AttendreRésultat<string[]>();

    beforeAll(async () => {
      idBd = await client.créerBdIndépendante({ type: "kvstore" });
      idBdListe = await client.créerBdIndépendante({ type: "feed" });
      idBd2 = await client.créerBdIndépendante({ type: "feed" });

      fOublier = await client.suivreBdsRécursives({
        idBd,
        f: (ids_) => rés.mettreÀJour(ids_),
      });
    }, config.patience);

    afterAll(async () => {
      if (fOublier) await fOublier();
      rés.toutAnnuler();
    });

    test("Ajout idBd", async () => {
      const { bd, fOublier } = await client.ouvrirBd<KeyValueStore<string>>({
        id: idBd,
      });
      await bd.set("clef", idBd2);
      fOublier();

      const val = await rés.attendreQue((x) => !!x && x.length > 1);
      expect(val).toEqual(expect.arrayContaining([idBd, idBd2]));
    });

    test("Enlever idBd", async () => {
      const { bd, fOublier } = await client.ouvrirBd<KeyValueStore<string>>({
        id: idBd,
      });
      await bd.del("clef");
      fOublier();

      const val = await rés.attendreQue((x) => !!x && x.length === 1);
      expect(val).toEqual(expect.arrayContaining([idBd]));
    });

    test("Ajout récursif", async () => {
      const { bd, fOublier } = await client.ouvrirBd<KeyValueStore<string>>({
        id: idBd,
      });
      await bd.set("clef", idBdListe);
      fOublier();

      const { bd: bdListe, fOublier: fOublierBdListe } = await client.ouvrirBd<
        FeedStore<string>
      >({ id: idBdListe });
      await bdListe.add(idBd2);
      fOublierBdListe();

      const val = await rés.attendreQue((x) => !!x && x.length === 3);
      expect(val).toEqual(expect.arrayContaining([idBd, idBdListe, idBd2]));
    });

    test("Enlever récursif", async () => {
      const { bd: bdListe, fOublier: fOublierBdListe } = await client.ouvrirBd<
        FeedStore<string>
      >({ id: idBdListe });
      await client.effacerÉlémentDeBdListe({ bd: bdListe, élément: idBd2 });
      fOublierBdListe();

      const val = await rés.attendreQue((x) => !!x && x.length === 2);
      expect(val).toEqual(expect.arrayContaining([idBd, idBdListe]));
    });
  });

  describe("Suivre empreinte têtes", function () {
    let idBd: string;
    let idBdListe: string;
    let idBd2: string;
    let fOublier: schémaFonctionOublier;

    const rés = new AttendreRésultat<string>();

    beforeAll(async () => {
      idBd = await client.créerBdIndépendante({ type: "kvstore" });
      idBdListe = await client.créerBdIndépendante({ type: "feed" });
      idBd2 = await client.créerBdIndépendante({ type: "feed" });

      fOublier = await client.suivreEmpreinteTêtesBdRécursive({
        idBd,
        f: (empr) => rés.mettreÀJour(empr),
      });
    }, config.patience);

    afterAll(async () => {
      if (fOublier) await fOublier();
      rés.toutAnnuler();
    });

    test("Ajout élément", async () => {
      const empreinteAvant = await rés.attendreExiste();

      const { bd, fOublier } = await client.ouvrirBd<KeyValueStore<string>>({
        id: idBd,
      });
      await bd.set("clef", idBd2);
      fOublier();

      await rés.attendreQue((x) => !!x && x !== empreinteAvant);
    });

    test("Enlever élément", async () => {
      const empreinteAvant = await rés.attendreExiste();

      const { bd, fOublier } = await client.ouvrirBd<KeyValueStore<string>>({
        id: idBd,
      });
      await bd.del("clef");
      fOublier();

      await rés.attendreQue((x) => !!x && x !== empreinteAvant);
    });

    test("Ajout récursif", async () => {
      const { bd, fOublier } = await client.ouvrirBd<KeyValueStore<string>>({
        id: idBd,
      });
      await bd.set("clef", idBdListe);
      fOublier();

      const empreinteDébut = await rés.attendreExiste();

      const { bd: bdListe, fOublier: fOublierBdListe } = await client.ouvrirBd<
        FeedStore<string>
      >({ id: idBdListe });
      await bdListe.add(idBd2);
      fOublierBdListe();

      const empreinteAvant = await rés.attendreQue(
        (x) => !!x && x !== empreinteDébut
      );

      const { bd: bd2, fOublier: fOublierBd2 } = await client.ouvrirBd<
        FeedStore<string>
      >({ id: idBd2 });
      await bd2.add("abc");
      fOublierBd2();

      await rés.attendreQue((x) => !!x && x !== empreinteAvant);
    });

    test("Enlever récursif", async () => {
      const empreinteAvant = await rés.attendreExiste();

      const { bd: bdListe, fOublier: fOublierBdListe } = await client.ouvrirBd<
        FeedStore<string>
      >({ id: idBdListe });
      await client.effacerÉlémentDeBdListe({ bd: bdListe, élément: idBd2 });
      fOublierBdListe();

      await rés.attendreQue((x) => !!x && x !== empreinteAvant);
    });
  });

  describe("Rechercher élément BD liste selon empreinte", function () {
    let idBd: string;
    let bd: FeedStore<string>;
    let fOublier: schémaFonctionOublier;

    beforeAll(async () => {
      idBd = await client.créerBdIndépendante({ type: "feed" });
      ({ bd, fOublier } = await client.ouvrirBd<FeedStore<string>>({
        id: idBd,
      }));
      await bd.add("abc");
    }, config.patience);

    afterAll(async () => {
      if (fOublier) await fOublier();
    });

    test("On retrouve le bon élément", async () => {
      const fRecherche = (e: LogEntry<string>): boolean => {
        return e.payload.value === "abc";
      };
      const résultat = await client.rechercherBdListe({
        id: idBd,
        f: fRecherche,
      });
      expect(résultat?.payload.value).toEqual("abc");
    });

    test("`undefined` est retourné si l'empreinte n'existe pas", async () => {
      const fRecherche = (e: LogEntry<string>): boolean => {
        return e.payload.value === "def";
      };
      const résultat = await client.rechercherBdListe({
        id: idBd,
        f: fRecherche,
      });
      expect(résultat).toBeUndefined();
    });
  });

  describe("Suivre BDs de BD liste", function () {
    let idBdListe: string;
    let idBd1: string;
    let idBd2: string;

    type branche = { [key: string]: number };
    let données: branche[];
    const fsOublier: schémaFonctionOublier[] = [];

    beforeAll(async () => {
      idBdListe = await client.créerBdIndépendante({ type: "feed" });
      const { bd: bdListe, fOublier } = await client.ouvrirBd<
        FeedStore<string>
      >({ id: idBdListe });
      fsOublier.push(fOublier);

      const fBranche = async (id: string, f: schémaFonctionSuivi<branche>) => {
        return await client.suivreBd<KeyValueStore<number>>({
          id,
          f: (_bd) => f(_bd.all),
        });
      };
      const fSuivi = (x: branche[]) => {
        données = x;
      };
      fsOublier.push(
        await client.suivreBdsDeBdListe({
          id: idBdListe,
          f: fSuivi,
          fBranche,
        })
      );

      idBd1 = await client.créerBdIndépendante({ type: "kvstore" });
      idBd2 = await client.créerBdIndépendante({ type: "kvstore" });
      const { bd: bd1, fOublier: fOublier1 } = await client.ouvrirBd<
        KeyValueStore<number>
      >({ id: idBd1 });
      fsOublier.push(fOublier1);
      const { bd: bd2, fOublier: fOublier2 } = await client.ouvrirBd<
        KeyValueStore<number>
      >({ id: idBd2 });
      fsOublier.push(fOublier2);

      await bd1.put("a", 1);
      await bd2.put("b", 2);

      await bdListe.add(idBd1);
      await bdListe.add(idBd2);
    }, config.patience);
    afterAll(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });
    test("Les éléments sont retournés", async () => {
      expect(isArray(données)).toBe(true);
      expect(données).toEqual([{ a: 1 }, { b: 2 }]);
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

      beforeAll(async () => {
        idBd1 = await client.créerBdIndépendante({ type: "kvstore" });
        idBd2 = await client.créerBdIndépendante({ type: "kvstore" });
        const { bd: bd1, fOublier: fOublier1 } = await client.ouvrirBd<
          KeyValueStore<number>
        >({ id: idBd1 });
        fsOublier.push(fOublier1);
        const { bd: bd2, fOublier: fOublier2 } = await client.ouvrirBd<
          KeyValueStore<number>
        >({ id: idBd2 });
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
          return await client.suivreBd({
            id,
            f: (bd: KeyValueStore<number>) => {
              const vals: number[] = Object.values(bd.all);
              f(vals);
            },
          });
        };
        fsOublier.push(
          await client.suivreBdsDeFonctionListe({ fListe, f, fBranche })
        );
      }, config.patience);
      afterAll(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });

      test("Sans branches", async () => {
        expect(résultats).toBeUndefined();
      });
      test("Ajout d'une branche ou deux", async () => {
        await changerBds([idBd1, idBd2]);
        expect(isArray(résultats)).toBe(true);
        expect(résultats).toHaveLength(3);
        expect(résultats).toEqual(expect.arrayContaining([1, 2, 3]));
      });
      test("Enlever une branche", async () => {
        await changerBds([idBd1]);
        expect(isArray(résultats)).toBe(true);
        expect(résultats).toHaveLength(2);
        expect(résultats).toEqual(expect.arrayContaining([1, 2]));
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
        return await client.suivreBd({
          id,
          f: (bd: KeyValueStore<number>) => {
            const vals: number[] = Object.values(bd.all);
            f(vals);
          },
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
      beforeAll(async () => {
        idBd1 = await client.créerBdIndépendante({ type: "kvstore" });
        idBd2 = await client.créerBdIndépendante({ type: "kvstore" });

        const { bd: bd1, fOublier: fOublier1 } = await client.ouvrirBd<
          KeyValueStore<number>
        >({ id: idBd1 });
        fsOublier.push(fOublier1);
        const { bd: bd2, fOublier: fOublier2 } = await client.ouvrirBd<
          KeyValueStore<number>
        >({ id: idBd2 });
        fsOublier.push(fOublier2);

        await bd1.put("a", 1);
        await bd1.put("b", 2);
        await bd2.put("c", 3);

        fsOublier.push(
          await client.suivreBdsDeFonctionListe({
            fListe,
            f,
            fBranche,
            fIdBdDeBranche,
            fCode,
          })
        );
        await changerBds([idBd1, idBd2]);
      }, config.patience);
      afterAll(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });

      test("Ajout d'une branche ou deux", async () => {
        expect(isArray(résultats)).toEqual(true);
        expect(résultats).toHaveLength(3);
        expect(résultats).toEqual(expect.arrayContaining([1, 2, 3]));
      });

      test("Avec fRéduction complèxe", async () => {
        const fRéduction = (branches: number[][]) => [
          ...branches.map((b) => b[0]),
        ];

        fsOublier.push(
          await client.suivreBdsDeFonctionListe({
            fListe,
            f,
            fBranche,
            fIdBdDeBranche,
            fRéduction,
            fCode,
          })
        );
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

      beforeAll(async () => {
        fOublier = await client.suivreBdsDeFonctionListe({
          fListe,
          f: faisRien,
          fBranche: async () => faisRien,
        });
      });
      afterAll(async () => {
        if (fOublier) await fOublier();
      });

      test("Ajout d'une branche ou deux", async () => {
        await expect(() => fSuivre([{ nom: "abc" }])).rejects.toThrow();
      });
    });
  });

  describe("Suivre BDs selon condition", function () {
    let idBd1: string;
    let idBd2: string;

    let sélectionnées: string[];
    const fsOublier: schémaFonctionOublier[] = [];

    beforeAll(async () => {
      idBd1 = await client.créerBdIndépendante({ type: "kvstore" });
      idBd2 = await client.créerBdIndépendante({ type: "kvstore" });

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
        return await client.suivreBd({ id, f });
      };
      fsOublier.push(
        await client.suivreBdsSelonCondition({
          fListe,
          fCondition,
          f: (idsBds) => (sélectionnées = idsBds),
        })
      );
    }, config.patience);
    afterAll(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });
    test("Seules les bonnes BDs sont retournées", async () => {
      expect(isArray(sélectionnées));
      expect(sélectionnées).toHaveLength(0);

      const { bd: bd1, fOublier: fOublier1 } = await client.ouvrirBd<
        KeyValueStore<number>
      >({ id: idBd1 });
      fsOublier.push(fOublier1);
      await bd1.put("a", 1);

      expect(isArray(sélectionnées));
      expect(sélectionnées).toHaveLength(1);
      expect(sélectionnées).toEqual(expect.arrayContaining([idBd1]));
    });
    test("Les changements aux conditions sont détectés", async () => {
      const { bd: bd2, fOublier: fOublier2 } = await client.ouvrirBd<
        KeyValueStore<number>
      >({ id: idBd2 });
      fsOublier.push(fOublier2);

      await bd2.put("a", 1);
      expect(sélectionnées).toEqual(expect.arrayContaining([idBd1, idBd2]));
    });
  });

  describe("Opérations SFIP", function () {
    let cid: string;
    const texte = "வணக்கம்";
    test(
      "On ajoute un fichier au SFIP",
      async () => {
        cid = await client.ajouterÀSFIP({ fichier: texte });
      },
      config.patience
    );
    test("On télécharge le fichier du SFIP", async () => {
      const données = await client.obtFichierSFIP({ id: cid });
      expect(new TextDecoder().decode(données!)).toEqual(texte);
    });
    test("On télécharge le fichier en tant qu'itérable", async () => {
      const flux = client.obtItérableAsyncSFIP({ id: cid });
      const données = await toBuffer(flux);
      expect(new TextDecoder().decode(données!)).toEqual(texte);
    });
  });

  describe("Ouvrir BD", function () {
    let idBd: string;
    const fsOublier: schémaFonctionOublier[] = [];

    beforeAll(async () => {
      idBd = await client.créerBdIndépendante({ type: "kvstore" });
    });

    afterAll(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    test("On obtient la BD", async () => {
      const { bd, fOublier } = await client.ouvrirBd({ id: idBd });
      fsOublier.push(fOublier);
      expect(adresseOrbiteValide(bd.address.toString())).toBe(true);
    });
    test("On évite la concurrence", async () => {
      const bds = await Promise.all(
        [1, 2].map(async () => {
          const { bd, fOublier } = await client.ouvrirBd({ id: idBd });
          fsOublier.push(fOublier);
          return bd;
        })
      );
      expect(bds[0] === bds[1]).toBe(true);
    });
  });

  describe("Obtenir ID BD", function () {
    let idRacine: string;
    let idBd: string;

    let bdRacine: KeyValueStore<string>;
    const fsOublier: schémaFonctionOublier[] = [];

    beforeAll(async () => {
      idRacine = await client.créerBdIndépendante({ type: "kvstore" });
      const { bd, fOublier } = await client.ouvrirBd<KeyValueStore<string>>({
        id: idRacine,
      });
      bdRacine = bd;
      fsOublier.push(fOublier);

      idBd = await client.créerBdIndépendante({ type: "feed" });
      await bdRacine.put("clef", idBd);
    }, config.patience);

    afterAll(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    test("Avec racine chaîne", async () => {
      const idBdRetrouvée = await client.obtIdBd({
        nom: "clef",
        racine: idRacine,
      });
      expect(idBdRetrouvée).toEqual(idBd);
    });

    test("Avec racine BD", async () => {
      const idBdRetrouvée = await client.obtIdBd({
        nom: "clef",
        racine: bdRacine,
      });
      expect(idBdRetrouvée).toEqual(idBd);
    });

    test("Avec mauvais type spécifié", async () => {
      const idBdRetrouvée = await client.obtIdBd({
        nom: "clef",
        racine: bdRacine,
        type: "kvstore",
      });
      expect(idBdRetrouvée).toBeUndefined();
    });

    test("On crée la BD si elle n'existait pas", async () => {
      const idBdRetrouvée = await client.obtIdBd({
        nom: "je n'existe pas encore",
        racine: bdRacine,
        type: "feed",
      });
      expect(adresseOrbiteValide(idBdRetrouvée)).toBe(true);
    });

    test("Mais on ne crée pas la BD on n'a pas la permission sur la BD racine", async () => {
      const idBdRetrouvée = await client2.obtIdBd({
        nom: "et moi je n'existerai jamais",
        racine: bdRacine,
        type: "feed",
      });
      expect(idBdRetrouvée).toBeUndefined();
    });

    test(
      "On ne perd pas les données en cas de concurrence entre dispositifs",
      async () => {
        // Créons une nouvelle BD avec des données
        const NOUVELLE_CLEF = "nouvelle clef";
        const idNouvelleBd = await client.obtIdBd({
          nom: NOUVELLE_CLEF,
          racine: idRacine,
          type: "feed",
        });
        expect(idNouvelleBd).toBeTruthy();

        const { bd, fOublier } = await client.ouvrirBd<FeedStore<string>>({
          id: idNouvelleBd!,
        });
        fsOublier.push(fOublier);

        await bd.add("Salut !");
        await bd.add("வணக்கம்!");

        // Simulons un autre dispositif qui écrit à la même clef de manière concurrente
        const idBdConcurrente = await client.créerBdIndépendante({
          type: "feed",
        });
        const { bd: bdConcurrent, fOublier: fOublierConcurrente } =
          await client.ouvrirBd<FeedStore<string>>({ id: idBdConcurrente });
        fsOublier.push(fOublierConcurrente);

        await bdConcurrent.add("કેમ છો");
        await bdRacine.put(NOUVELLE_CLEF, idBdConcurrente);

        // Il ne devrait tout de même pas y avoir perte de données
        const idBdRetrouvée = await client.obtIdBd({
          nom: NOUVELLE_CLEF,
          racine: idRacine,
          type: "feed",
        });
        const { bd: bdRetrouvée, fOublier: fOublierRetrouvée } =
          await client.ouvrirBd<FeedStore<string>>({ id: idBdRetrouvée! });
        fsOublier.push(fOublierRetrouvée);

        const éléments = ClientConstellation.obtÉlémentsDeBdListe({
          bd: bdRetrouvée,
        });
        expect(éléments).toEqual(
          expect.arrayContaining(["Salut !", "வணக்கம்!", "કેમ છો"])
        );
      },
      config.patience * 2
    );
  });

  describe("Créer BD indépendante", function () {
    const fsOublier: schémaFonctionOublier[] = [];

    afterAll(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    test(
      "La BD est crée",
      async () => {
        const idBd = await client.créerBdIndépendante({ type: "kvstore" });
        expect(adresseOrbiteValide(idBd)).toBe(true);
      },
      config.patience
    );
    test(
      "Avec sa propre bd accès utilisateur",
      async () => {
        const optionsAccès: OptionsContrôleurConstellation = {
          address: undefined,
          premierMod: client.bdCompte!.id,
        };
        const idBd = await client.créerBdIndépendante({
          type: "kvstore",
          optionsAccès,
        });

        const { bd, fOublier } = await client.ouvrirBd<KeyValueStore<number>>({
          id: idBd,
        });
        fsOublier.push(fOublier);

        const autorisé = await peutÉcrire(bd, client.orbite);
        expect(autorisé).toBe(true);
      },
      config.patience
    );
    test(
      "Avec accès personalisé",
      async () => {
        const optionsAccès = { premierMod: client2.orbite!.identity.id };
        const idBd = await client.créerBdIndépendante({
          type: "kvstore",
          optionsAccès,
        });

        const { bd: bd_orbite2, fOublier } = await client2.ouvrirBd<
          KeyValueStore<number>
        >({ id: idBd });
        fsOublier.push(fOublier);

        const autorisé = await peutÉcrire(bd_orbite2, client2.orbite);

        expect(autorisé).toBe(true);
      },
      config.patience
    );
  });

  describe("Combiner BDs", function () {
    const fsOublier: schémaFonctionOublier[] = [];

    afterAll(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    test(
      "Combiner BD dic",
      async () => {
        const idBdDic1 = await client.créerBdIndépendante({ type: "kvstore" });
        const idBdDic2 = await client.créerBdIndépendante({ type: "kvstore" });

        const { bd: bdDic1, fOublier: fOublierDic1 } = await client.ouvrirBd<
          KeyValueStore<number>
        >({ id: idBdDic1 });
        const { bd: bdDic2, fOublier: fOublierDic2 } = await client.ouvrirBd<
          KeyValueStore<number>
        >({ id: idBdDic2 });

        fsOublier.push(fOublierDic1);
        fsOublier.push(fOublierDic2);

        await bdDic1.put("clef 1", 1);
        await bdDic1.put("clef 2", 2);
        await bdDic2.put("clef 1", -1);
        await bdDic2.put("clef 3", 3);

        await client.combinerBdsDict({ bdBase: bdDic1, bd2: bdDic2 });
        const données = bdDic1.all;

        expect(données).toEqual({
          "clef 1": 1,
          "clef 2": 2,
          "clef 3": 3,
        });
      },
      config.patience
    );

    test(
      "Combiner BD liste",
      async () => {
        const idBdListe1 = await client.créerBdIndépendante({ type: "feed" });
        const idBdListe2 = await client.créerBdIndépendante({ type: "feed" });

        const { bd: bdListe1, fOublier: fOublierListe1 } =
          await client.ouvrirBd<FeedStore<number>>({ id: idBdListe1 });
        const { bd: bdListe2, fOublier: fOublierListe2 } =
          await client.ouvrirBd<FeedStore<number>>({ id: idBdListe2 });

        fsOublier.push(fOublierListe1);
        fsOublier.push(fOublierListe2);

        await bdListe1.add(1);
        await bdListe1.add(2);
        await bdListe2.add(1);
        await bdListe2.add(3);

        await client.combinerBdsListe({ bdBase: bdListe1, bd2: bdListe2 });
        const données = ClientConstellation.obtÉlémentsDeBdListe({
          bd: bdListe1,
        });

        expect(isArray(données)).toBe(true);
        expect(données).toHaveLength(3);
        expect(données).toEqual(expect.arrayContaining([1, 2, 3]));
      },
      config.patience
    );

    test(
      "Combiner BD liste avec indexe",
      async () => {
        const idBdListe1 = await client.créerBdIndépendante({ type: "feed" });
        const idBdListe2 = await client.créerBdIndépendante({ type: "feed" });

        const { bd: bdListe1, fOublier: fOublierListe1 } =
          await client.ouvrirBd<FeedStore<{ temps: number; val: number }>>({
            id: idBdListe1,
          });
        const { bd: bdListe2, fOublier: fOublierListe2 } =
          await client.ouvrirBd<FeedStore<{ temps: number; val: number }>>({
            id: idBdListe2,
          });

        fsOublier.push(fOublierListe1);
        fsOublier.push(fOublierListe2);

        await bdListe1.add({ temps: 1, val: 1 });
        await bdListe1.add({ temps: 2, val: 2 });
        await bdListe2.add({ temps: 1, val: 2 });
        await bdListe2.add({ temps: 3, val: 3 });

        await client.combinerBdsListe({
          bdBase: bdListe1,
          bd2: bdListe2,
          index: ["temps"],
        });
        const données = ClientConstellation.obtÉlémentsDeBdListe({
          bd: bdListe1,
        });

        expect(isArray(données)).toBe(true);
        expect(données).toHaveLength(3);
        expect(données).toEqual(
          expect.arrayContaining([
            { temps: 1, val: 1 },
            { temps: 2, val: 2 },
            { temps: 3, val: 3 },
          ])
        );
      },
      config.patience
    );

    test(
      "Combiner BD dic récursif",
      async () => {
        const idBdDic1 = await client.créerBdIndépendante({ type: "kvstore" });
        const idBdDic2 = await client.créerBdIndépendante({ type: "kvstore" });

        const { bd: bdDic1, fOublier: fOublierDic1 } = await client.ouvrirBd<
          KeyValueStore<string>
        >({ id: idBdDic1 });
        const { bd: bdDic2, fOublier: fOublierDic2 } = await client.ouvrirBd<
          KeyValueStore<string>
        >({ id: idBdDic2 });

        fsOublier.push(fOublierDic1);
        fsOublier.push(fOublierDic2);

        const idBdListe1 = await client.créerBdIndépendante({ type: "feed" });
        const idBdListe2 = await client.créerBdIndépendante({ type: "feed" });

        const { bd: bdListe1, fOublier: fOublierListe1 } =
          await client.ouvrirBd<FeedStore<number>>({ id: idBdListe1 });
        const { bd: bdListe2, fOublier: fOublierListe2 } =
          await client.ouvrirBd<FeedStore<number>>({ id: idBdListe2 });

        fsOublier.push(fOublierListe1);
        fsOublier.push(fOublierListe2);

        await bdListe1.add(1);
        await bdListe2.add(1);
        await bdListe2.add(2);

        await bdDic1.put("clef", idBdListe1);
        await bdDic2.put("clef", idBdListe2);

        await client.combinerBdsDict({ bdBase: bdDic1, bd2: bdDic2 });

        const idBdListeFinale = bdDic1.get("clef");
        const { bd: bdListeFinale, fOublier: fOublierBdListeFinale } =
          await client.ouvrirBd<FeedStore<number>>({ id: idBdListeFinale });

        fsOublier.push(fOublierBdListeFinale);

        const données = ClientConstellation.obtÉlémentsDeBdListe({
          bd: bdListeFinale,
        });

        expect(isArray(données)).toBe(true);
        expect(données).toHaveLength(2);
        expect(données).toEqual(expect.arrayContaining([1, 2]));
      },
      config.patience * 2
    );

    test(
      "Combiner BD liste récursif",
      async () => {
        const idBdListe1 = await client.créerBdIndépendante({ type: "feed" });
        const idBdListe2 = await client.créerBdIndépendante({ type: "feed" });

        const { bd: bdListe1, fOublier: fOublierBdListe1 } =
          await client.ouvrirBd<FeedStore<{ indexe: number; idBd: string }>>({
            id: idBdListe1,
          });
        const { bd: bdListe2, fOublier: fOublierBdListe2 } =
          await client.ouvrirBd<FeedStore<{ indexe: number; idBd: string }>>({
            id: idBdListe2,
          });

        fsOublier.push(fOublierBdListe1);
        fsOublier.push(fOublierBdListe2);

        const idSubBd1 = await client.créerBdIndépendante({ type: "feed" });
        const idSubBd2 = await client.créerBdIndépendante({ type: "feed" });

        const { bd: subBd1, fOublier: fOublierSubBd1 } = await client.ouvrirBd<
          FeedStore<number>
        >({ id: idSubBd1 });
        const { bd: subBd2, fOublier: fOublierSubBd2 } = await client.ouvrirBd<
          FeedStore<number>
        >({ id: idSubBd2 });

        fsOublier.push(fOublierSubBd1);
        fsOublier.push(fOublierSubBd2);

        await subBd1.add(1);
        await subBd2.add(1);
        await subBd2.add(2);

        type élément = { indexe: number; idBd: string };
        await bdListe1.add({ indexe: 1, idBd: idSubBd1 });
        await bdListe2.add({ indexe: 1, idBd: idSubBd2 });

        await client.combinerBdsListe({
          bdBase: bdListe1,
          bd2: bdListe2,
          index: ["indexe"],
        });

        const donnéesBdListe: élément[] =
          ClientConstellation.obtÉlémentsDeBdListe({ bd: bdListe1 });
        expect(isArray(donnéesBdListe)).toBe(true);
        expect(donnéesBdListe).toHaveLength(1);

        const idBdListeFinale = donnéesBdListe[0]!.idBd;
        const { bd: subBdFinale, fOublier: fOublierSubBdFinale } =
          await client.ouvrirBd<FeedStore<number>>({ id: idBdListeFinale });

        fsOublier.push(fOublierSubBdFinale);

        const données = ClientConstellation.obtÉlémentsDeBdListe({
          bd: subBdFinale,
        });

        expect(isArray(données)).toBe(true);
        expect(données).toHaveLength(2);
        expect(données).toEqual(expect.arrayContaining([1, 2]));
      },
      config.patience
    );
  });

  describe("Effacer BD", function () {
    let idBd: string;
    const fsOublier: schémaFonctionOublier[] = [];

    beforeAll(async () => {
      idBd = await client.créerBdIndépendante({ type: "kvstore" });
      const { bd, fOublier } = await client.ouvrirBd<KeyValueStore<number>>({
        id: idBd,
      });
      fsOublier.push(fOublier);

      await bd.put("test", 123);
      await bd.close();
    }, config.patience);

    afterAll(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    test("Les données n'existent plus", async () => {
      await client.effacerBd({ id: idBd });
      const { bd, fOublier } = await client.ouvrirBd<KeyValueStore<string>>({
        id: idBd,
      });

      fsOublier.push(fOublier);

      const val = bd.get("test");

      expect(val).toBeUndefined();
    });
  });

  describe("Suivre mes permissions", function () {
    const rés = new AttendreRésultat<string>();
    let idBd: string;

    const fsOublier: schémaFonctionOublier[] = [];

    beforeAll(async () => {
      idBd = await client.créerBdIndépendante({
        type: "kvstore",
        optionsAccès: {
          address: undefined,
          premierMod: client.bdCompte!.id,
        },
      });

      fsOublier.push(
        await client2.suivrePermission({
          idObjet: idBd,
          f: (p) => {
            rés.mettreÀJour(p);
          },
        })
      );
    }, config.patience);

    afterAll(async () => {
      await Promise.all(fsOublier.map((f) => f()));
      rés.toutAnnuler();
    });

    test("On n'a pas d'accès avant", async () => {
      expect(rés.val).toBeUndefined();
    });

    test(
      "On détecte l'ajout d'une permission membre",
      async () => {
        await client.donnerAccès({ idBd, identité: idbdCompte2, rôle: MEMBRE });
        const val = await rés.attendreExiste();
        expect(val).toEqual(MEMBRE);
      },
      config.patience
    );

    test("Le nouveau membre peut modifier la BD", async () => {
      const { bd, fOublier } = await client2.ouvrirBd<KeyValueStore<number>>({
        id: idBd,
      });

      fsOublier.push(fOublier);

      const permission = await peutÉcrire(bd, client2.orbite);
      expect(permission).toBe(true);
    });

    test(
      "On détecte l'ajout d'une permission modératrice",
      async () => {
        await client.donnerAccès({
          idBd,
          identité: idbdCompte2,
          rôle: MODÉRATEUR,
        });
        await rés.attendreQue((x) => x === MODÉRATEUR);
      },
      config.patience
    );
  });

  describe("Suivre accès et permissions BD", function () {
    let fOublier: schémaFonctionOublier;
    let fOublierÉcrire: schémaFonctionOublier;
    let fOublierPermission: schémaFonctionOublier;

    let lAccès: infoAccès[];
    let idBd: string;
    const résultatPermission = new AttendreRésultat<
      typeof MODÉRATEUR | typeof MEMBRE
    >();

    let permissionÉcrire = false;

    beforeAll(async () => {
      idBd = await client.créerBdIndépendante({
        type: "kvstore",
        optionsAccès: {
          address: undefined,
          premierMod: client.bdCompte!.id,
        },
      });
      const f = (accès: infoAccès[]) => {
        lAccès = accès;
      };
      fOublier = await client.suivreAccèsBd({ id: idBd, f });

      const fÉcrire = (accès: boolean) => {
        permissionÉcrire = accès;
      };
      fOublierÉcrire = await client2.suivrePermissionÉcrire({
        id: idBd,
        f: fÉcrire,
      });

      const fPermission = (accès?: typeof MODÉRATEUR | typeof MEMBRE) => {
        résultatPermission.mettreÀJour(accès);
      };
      fOublierPermission = await client2.suivrePermission({
        idObjet: idBd,
        f: fPermission,
      });
    }, config.patience);
    afterAll(async () => {
      if (fOublier) await fOublier();
      if (fOublierÉcrire) fOublierÉcrire();
      if (fOublierPermission) fOublierPermission();

      résultatPermission.toutAnnuler();
    });
    test(
      "On détecte l'ajout d'une permission membre",
      async () => {
        await client.donnerAccès({ idBd, identité: idbdCompte2, rôle: MEMBRE });
        await résultatPermission.attendreQue((x) => x === MEMBRE);

        const infoInvité = lAccès.find((a) => a.idBdCompte === idbdCompte2);
        expect(infoInvité?.rôle).toEqual(MEMBRE);
      },
      config.patience
    );

    test("L'invité détecte l'ajout de sa permission membre", async () => {
      expect(permissionÉcrire).toBe(true);
      expect(résultatPermission.val).toEqual(MEMBRE);
    });

    test(
      "On détecte l'ajout d'une permission modératrice",
      async () => {
        await client.donnerAccès({
          idBd,
          identité: idbdCompte2,
          rôle: MODÉRATEUR,
        });
        await résultatPermission.attendreQue((x) => x === MODÉRATEUR);

        const infoInvité = lAccès.find((a) => a.idBdCompte === idbdCompte2);
        expect(infoInvité?.rôle).toEqual(MODÉRATEUR);
      },
      config.patience
    );

    test("L'invité détecte l'ajout de sa permission modératrice", async () => {
      expect(permissionÉcrire).toBe(true);
      expect(résultatPermission.val).toEqual(MODÉRATEUR);
    });
  });

  describe("Épingler BD", function () {
    let idBdKv: string;
    let idBdListe: string;
    let idBdKv2: string;

    let cidTexte: string;
    let interval: NodeJS.Timer | undefined = undefined;

    const fsOublier: schémaFonctionOublier[] = [];

    beforeAll(async () => {
      idBdKv = await client.créerBdIndépendante({ type: "kvstore" });
      const { bd: bdKv, fOublier: fOublierKv } = await client.ouvrirBd<
        KeyValueStore<string>
      >({ id: idBdKv });

      fsOublier.push(fOublierKv);

      idBdListe = await client.créerBdIndépendante({ type: "feed" });
      const { bd: bdListe, fOublier: fOublierBdListe } = await client.ouvrirBd<
        FeedStore<string>
      >({ id: idBdListe });

      fsOublier.push(fOublierBdListe);

      idBdKv2 = await client.créerBdIndépendante({ type: "kvstore" });

      await bdKv.put("ma bd liste", idBdListe);
      await bdListe.add(idBdKv2);

      cidTexte = (await client2.sfip!.add("Bonjour !")).cid.toString(); // Utiliser ipfs2 pour ne pas l'ajouter à ipfs1 directement (simuler adition d'un autre membre)
      await bdListe.add(cidTexte);

      await client.épingles!.épinglerBd({ id: idBdKv });
    }, config.patience);

    afterAll(async () => {
      if (interval) clearInterval(interval);
      await Promise.all(fsOublier.map((f) => f()));
    });

    test("La BD est épinglée", async () => {
      expect(client._bds[idBdKv]).toBeTruthy();
    });
    test("Récursion KVStore", async () => {
      expect(client._bds[idBdListe]).toBeTruthy();
    });
    test("Récursion FeedStore", async () => {
      expect(client._bds[idBdKv2]).toBeTruthy();
    });
    test("Les fichiers SFIP sont également épinglés", async () => {
      let fichierEstÉpinglé = false;
      await new Promise<void>((résoudre) => {
        interval = setInterval(async () => {
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

      expect(fichierEstÉpinglé).toBe(true);
    });
  });
});
