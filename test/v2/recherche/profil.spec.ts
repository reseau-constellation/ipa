import type { Constellation } from "@/v2/index.js";

describe("Rechercher profil", function () {
  describe("selon activité", function () {
    let fermer: Oublier;
    let constls: Constellation[];
    let constl: Constellation;
    let idCompte: string;

    const rés = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<InfoRésultatVide>
    >();

    before(async () => {
      ({ fermer, constls } = await générerconstlsInternes({
        n: 1,
      }));
      constl = constls[0];
      idCompte = await constl.obtIdCompte();
      const recherche = rechercherProfilsSelonActivité();
      fOublier = await recherche(constl, idCompte, async (r) =>
        rés.mettreÀJour(r),
      );
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("Score 0 pour commencer", async () => {
      const val = await rés.attendreExiste();
      expect(val).to.deep.equal({
        type: "résultat",
        score: 0,
        de: "activité",
        info: { type: "vide" },
      });
    });

    it("On améliore le score en ajoutant notre nom", async () => {
      await constl.profil.sauvegarderNom({ langue: "த", nom: "ஜூலீஎன்" });
      const val = await rés.attendreQue((x) => !!x && x.score > 0);
      expect(val.score).to.equal(1 / 3);
    });

    it("Encore mieux avec un courriel", async () => {
      await constl.profil.sauvegarderCourriel({
        courriel: "julien.malard@mail.mcgill.ca",
      });
      const val = await rés.attendreQue((x) => !!x && x.score > 1 / 3);
      expect(val.score).to.equal(2 / 3);
    });

    it("C'est parfait avec un photo !", async () => {
      const IMAGE = await obtRessourceTest({
        nomFichier: "logo.png",
      });

      await constl.profil.sauvegarderImage({
        image: { contenu: IMAGE, nomFichier: "logo.png" },
      });
      const val = await rés.attendreQue(
        (x: RésultatObjectifRecherche<InfoRésultatVide> | undefined) =>
          x?.score === 1,
      );

      expect(val.score).to.equal(1);
    });
  });

  describe("Selon nom", function () {
    let fermer: Oublier;
    let constls: Constellation[];
    let constl: Constellation;
    let idCompte: string;

    const rés = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<InfoRésultatTexte>
    >();

    before(async () => {
      ({ fermer, constls } = await générerconstlsInternes({
        n: 1,
      }));
      constl = constls[0];
      idCompte = await constl.obtIdCompte();
      const recherche = rechercherProfilsSelonNom("Julien");
      fOublier = await recherche(constl, idCompte, async (r) =>
        rés.mettreÀJour(r),
      );
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("Rien pour commencer", async () => {
      expect(rés.val).to.be.undefined();
    });

    it("Ajout nom détecté", async () => {
      await constl.profil.sauvegarderNom({ langue: "cst", nom: "Julián" });
      await rés.attendreQue((x) => !!x && x.score > 0);

      expect(rés.val).to.deep.equal({
        type: "résultat",
        clef: "cst",
        score: 0.5,
        de: "nom",
        info: { type: "texte", texte: "Julián", début: 0, fin: 6 },
      });
    });

    it("Meilleur nom détecté", async () => {
      await constl.profil.sauvegarderNom({ langue: "fr", nom: "Julien" });
      await rés.attendreQue((x) => !!x && x.score > 0.5);

      expect(rés.val).to.deep.equal({
        type: "résultat",
        clef: "fr",
        score: 1,
        de: "nom",
        info: { type: "texte", texte: "Julien", début: 0, fin: 6 },
      });
    });
  });

  describe("Selon courriel", function () {
    let fermer: Oublier;
    let constls: Constellation[];
    let constl: Constellation;
    let idCompte: string;

    const rés = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<InfoRésultatTexte>
    >();

    before(async () => {
      ({ fermer, constls } = await générerconstlsInternes({
        n: 1,
      }));
      constl = constls[0];
      idCompte = await constl.obtIdCompte();
      const recherche = rechercherProfilsSelonCourriel("julien");
      fOublier = await recherche(constl, idCompte, async (r) =>
        rés.mettreÀJour(r),
      );
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("Rien pour commencer", async () => {
      expect(rés.val).to.be.undefined();
    });

    it("Ajout courriel détecté", async () => {
      await constl.profil.sauvegarderCourriel({
        courriel: "julien.malard@mail.mcgill.ca",
      });

      await rés.attendreQue((x) => !!x && x.score > 0);

      expect(rés.val).to.deep.equal({
        type: "résultat",
        score: 1,
        de: "courriel",
        info: {
          type: "texte",
          texte: "julien.malard@mail.mcgill.ca",
          début: 0,
          fin: 6,
        },
      });
    });
  });

  describe("Selon texte", function () {
    let fermer: Oublier;
    let constls: Constellation[];
    let constl: Constellation;
    let idCompte: string;
    const fsOublier: schémaFonctionOublier[] = [];
    const résNom = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<InfoRésultatTexte | InfoRésultatVide>
    >();
    const résCourriel = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<InfoRésultatTexte | InfoRésultatVide>
    >();

    before(async () => {
      ({ fermer, constls } = await générerconstlsInternes({
        n: 1,
      }));
      constl = constls[0];

      idCompte = await constl.obtIdCompte();
      const rechercheNom = rechercherProfilsSelonTexte("Julien Malard");
      fsOublier.push(
        await rechercheNom(constl, idCompte, async (r) =>
          résNom.mettreÀJour(r),
        ),
      );

      const rechercherCourriel = rechercherProfilsSelonTexte("julien.");
      fsOublier.push(
        await rechercherCourriel(constl, idCompte, async (r) =>
          résCourriel.mettreÀJour(r),
        ),
      );
    });

    it("Rien pour commencer", async () => {
      expect(résNom.val).to.be.undefined();
      expect(résCourriel.val).to.be.undefined();
    });

    it("Ajout nom détecté", async () => {
      await constl.profil.sauvegarderNom({
        langue: "fr",
        nom: "Julien Malard-Adam",
      });
      const valNom = await résNom.attendreExiste();
      expect(valNom).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "nom",
        info: {
          type: "texte",
          début: 0,
          fin: 13,
          texte: "Julien Malard-Adam",
        },
        score: 1,
      });

      const valCourriel = await résCourriel.attendreExiste();
      expect(valCourriel).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "nom",
        info: {
          type: "texte",
          début: 0,
          fin: 7,
          texte: "Julien Malard-Adam",
        },
        score: 1 / 3,
      });
    });

    it("Ajout courriel détecté", async () => {
      await constl.profil.sauvegarderCourriel({
        courriel: "julien.malard@mail.mcgill.ca",
      });

      const val = await résCourriel.attendreQue((x) =>
        Boolean(x && x.score > 1 / 3),
      );
      expect(val).to.deep.equal({
        type: "résultat",
        de: "courriel",
        info: {
          type: "texte",
          début: 0,
          fin: 7,
          texte: "julien.malard@mail.mcgill.ca",
        },
        score: 1,
      });
    });
  });
});
