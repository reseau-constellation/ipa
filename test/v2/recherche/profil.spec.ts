import { expect } from "aegir/chai";
import {
  rechercherProfilsSelonActivité,
  rechercherProfilsSelonNom,
  rechercherProfilsSelonCourriel,
  rechercherProfilsSelonTexte,
} from "@/v2/recherche/fonctions/profils.js";
import { rechercherVariablesSelonTexte } from "@/v2/recherche/fonctions/variables.js";
import { obtRessourceTest } from "test/ressources/index.js";
import { créerConstellationsTest, obtenir } from "../utils.js";
import type {
  RésultatObjectifRecherche,
  InfoRésultatVide,
  InfoRésultatTexte,
  SuivreObjectifRecherche,
} from "@/v2/recherche/types.js";
import type { Oublier } from "@/v2/crabe/types.js";
import type { Constellation } from "@/v2/index.js";

describe("Rechercher profil", function () {
  describe("selon activité", function () {
    let constls: Constellation[];
    let constl: Constellation;
    let fermer: Oublier;

    let idCompte: string;
    let recherche: SuivreObjectifRecherche<InfoRésultatVide>;

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 1,
        avecMandataire: false,
      }));
      constl = constls[0] as Constellation;

      idCompte = await constl.compte.obtIdCompte();
      recherche = rechercherProfilsSelonActivité();
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("score de 0 pour commencer", async () => {
      const résultat = await obtenir<
        RésultatObjectifRecherche<InfoRésultatVide>
      >(({ siDéfini }) =>
        recherche({
          constl,
          idObjet: idCompte,
          f: siDéfini(),
        }),
      );

      const réf: RésultatObjectifRecherche<InfoRésultatVide> = {
        type: "résultat",
        score: 0,
        de: "activité",
        info: { type: "vide" },
      };
      expect(résultat).to.deep.equal(réf);
    });

    it("on améliore le score en ajoutant notre nom", async () => {
      const pRésultat = obtenir<RésultatObjectifRecherche<InfoRésultatVide>>(
        ({ si }) =>
          recherche({
            constl,
            idObjet: idCompte,
            f: si((r) => !!r && r.score > 0),
          }),
      );

      await constl.profil.sauvegarderNom({ langue: "த", nom: "ஜூலீஎன்" });

      const résultat = await pRésultat;

      const réf: RésultatObjectifRecherche<InfoRésultatVide> = {
        type: "résultat",
        score: 1 / 3,
        de: "activité",
        info: { type: "vide" },
      };
      expect(résultat).to.deep.equal(réf);
    });

    it("encore mieux avec une adresse courriel", async () => {
      const pRésultat = obtenir<RésultatObjectifRecherche<InfoRésultatVide>>(
        ({ si }) =>
          recherche({
            constl,
            idObjet: idCompte,
            f: si((r) => !!r && r.score > 1 / 3),
          }),
      );

      await constl.profil.sauvegarderCourriel({
        courriel: "julien.malard@mail.mcgill.ca",
      });

      const résultat = await pRésultat;

      const réf: RésultatObjectifRecherche<InfoRésultatVide> = {
        type: "résultat",
        score: 2 / 3,
        de: "activité",
        info: { type: "vide" },
      };
      expect(résultat).to.deep.equal(réf);
    });

    it("...et c'est parfait avec un photo !", async () => {
      const pRésultat = obtenir<RésultatObjectifRecherche<InfoRésultatVide>>(
        ({ si }) =>
          recherche({
            constl,
            idObjet: idCompte,
            f: si((r) => !!r && r.score > 2 / 3),
          }),
      );

      const IMAGE = await obtRessourceTest({
        nomFichier: "logo.png",
      });
      await constl.profil.sauvegarderImage({
        image: { contenu: IMAGE, nomFichier: "logo.png" },
      });

      const résultat = await pRésultat;

      const réf: RésultatObjectifRecherche<InfoRésultatVide> = {
        type: "résultat",
        score: 1,
        de: "activité",
        info: { type: "vide" },
      };
      expect(résultat).to.deep.equal(réf);
    });
  });

  describe("selon nom", function () {
    let constls: Constellation[];
    let constl: Constellation;
    let fermer: Oublier;

    let idCompte: string;
    let recherche: SuivreObjectifRecherche<InfoRésultatTexte>;

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 1,
        avecMandataire: false,
      }));
      constl = constls[0] as Constellation;

      idCompte = await constl.compte.obtIdCompte();
      recherche = rechercherProfilsSelonNom("Julien");
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("rien pour commencer", async () => {
      const résultat = await obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte>
      >(({ siNonDéfini }) =>
        recherche({
          constl,
          idObjet: idCompte,
          f: siNonDéfini(),
        }),
      );
      expect(résultat).to.be.undefined();
    });

    it("ajout nom détecté", async () => {
      const pRésultat = obtenir<RésultatObjectifRecherche<InfoRésultatTexte>>(
        ({ siDéfini }) =>
          recherche({ constl, idObjet: idCompte, f: siDéfini() }),
      );

      await constl.profil.sauvegarderNom({ langue: "cst", nom: "Julián" });

      const résultat = await pRésultat;

      const réf: RésultatObjectifRecherche<InfoRésultatTexte> = {
        type: "résultat",
        clef: "cst",
        score: 0.5,
        de: "nom",
        info: { type: "texte", texte: "Julián", début: 0, fin: 6 },
      };
      expect(résultat).to.deep.equal(réf);
    });

    it("meilleur nom détecté", async () => {
      const pRésultat = obtenir<RésultatObjectifRecherche<InfoRésultatTexte>>(
        ({ si }) =>
          recherche({
            constl,
            idObjet: idCompte,
            f: si((r) => !!r && r.score > 0.5),
          }),
      );
      await constl.profil.sauvegarderNom({ langue: "fr", nom: "Julien" });

      const résultat = await pRésultat;

      const réf: RésultatObjectifRecherche<InfoRésultatTexte> = {
        type: "résultat",
        clef: "fr",
        score: 1,
        de: "nom",
        info: { type: "texte", texte: "Julien", début: 0, fin: 6 },
      };
      expect(résultat).to.deep.equal(réf);
    });
  });

  describe("selon courriel", function () {
    let constls: Constellation[];
    let constl: Constellation;
    let fermer: Oublier;

    let idCompte: string;
    let recherche: SuivreObjectifRecherche<InfoRésultatTexte>;

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 1,
        avecMandataire: false,
      }));
      constl = constls[0] as Constellation;

      idCompte = await constl.compte.obtIdCompte();
      recherche = rechercherProfilsSelonCourriel("julien");
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("rien pour commencer", async () => {
      const résultat = await obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte>
      >(({ siNonDéfini }) =>
        recherche({
          constl,
          idObjet: idCompte,
          f: siNonDéfini(),
        }),
      );
      expect(résultat).to.be.undefined();
    });

    it("ajout courriel détecté", async () => {
      const pRésultat = obtenir<RésultatObjectifRecherche<InfoRésultatTexte>>(
        ({ si }) =>
          recherche({
            constl,
            idObjet: idCompte,
            f: si((r) => !!r && r.score > 0),
          }),
      );

      await constl.profil.sauvegarderCourriel({
        courriel: "julien.malard@mail.mcgill.ca",
      });

      const résultat = await pRésultat;

      const réf: RésultatObjectifRecherche<InfoRésultatTexte> = {
        type: "résultat",
        score: 1,
        de: "courriel",
        info: {
          type: "texte",
          texte: "julien.malard@mail.mcgill.ca",
          début: 0,
          fin: 6,
        },
      };

      expect(résultat).to.deep.equal(réf);
    });
  });

  describe("selon texte", function () {
    let constls: Constellation[];
    let constl: Constellation;
    let fermer: Oublier;

    let idCompte: string;

    type TypeRésultat = InfoRésultatTexte | InfoRésultatVide;

    let rechercheId: SuivreObjectifRecherche<TypeRésultat>;
    let rechercheNom: SuivreObjectifRecherche<TypeRésultat>;
    let rechercheCourriel: SuivreObjectifRecherche<TypeRésultat>;
    let rechercheVide: SuivreObjectifRecherche<TypeRésultat>;

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 1,
        avecMandataire: false,
      }));
      constl = constls[0] as Constellation;

      idCompte = await constl.compte.obtIdCompte();
      rechercheId = rechercherProfilsSelonTexte(idCompte.slice(0, 15));
      rechercheNom = rechercherProfilsSelonTexte("Julien Malard");
      rechercheCourriel = rechercherProfilsSelonTexte("julien.");
      rechercheVide = rechercherVariablesSelonTexte("");
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("résultat id détecté", async () => {
      const résultatId = await obtenir<RésultatObjectifRecherche<TypeRésultat>>(
        ({ siDéfini }) =>
          rechercheId({ constl, idObjet: idCompte, f: siDéfini() }),
      );

      const réf: RésultatObjectifRecherche<TypeRésultat> = {
        type: "résultat",
        de: "id",
        info: {
          type: "texte",
          début: 0,
          fin: 15,
          texte: idCompte,
        },
        score: 1,
      };
      expect(résultatId).to.deep.equal(réf);
    });

    it("rien d'autre pour commencer", async () => {
      const résultatId = await obtenir<RésultatObjectifRecherche<TypeRésultat>>(
        ({ siNonDéfini }) =>
          rechercheId({
            constl,
            idObjet: idCompte,
            f: siNonDéfini(),
          }),
      );
      const résultatNom = await obtenir<
        RésultatObjectifRecherche<TypeRésultat>
      >(({ siNonDéfini }) =>
        rechercheNom({
          constl,
          idObjet: idCompte,
          f: siNonDéfini(),
        }),
      );
      const résultatCourriel = await obtenir<
        RésultatObjectifRecherche<TypeRésultat>
      >(({ siNonDéfini }) =>
        rechercheCourriel({
          constl,
          idObjet: idCompte,
          f: siNonDéfini(),
        }),
      );

      expect(résultatId).to.be.undefined();
      expect(résultatNom).to.be.undefined();
      expect(résultatCourriel).to.be.undefined();
    });

    it("ajout nom détecté", async () => {
      const pRésultatNom = obtenir<RésultatObjectifRecherche<TypeRésultat>>(
        ({ siDéfini }) =>
          rechercheNom({ constl, idObjet: idCompte, f: siDéfini() }),
      );
      const pRésultatCourriel = obtenir<
        RésultatObjectifRecherche<TypeRésultat>
      >(({ siDéfini }) =>
        rechercheCourriel({ constl, idObjet: idCompte, f: siDéfini() }),
      );

      await constl.profil.sauvegarderNom({
        langue: "fr",
        nom: "Julien Malard-Adam",
      });

      const résultatNom = pRésultatNom;
      const résultatCourriel = pRésultatCourriel;

      const réfNom: RésultatObjectifRecherche<TypeRésultat> = {
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
      };
      expect(résultatNom).to.deep.equal(réfNom);

      const réfCourriel: RésultatObjectifRecherche<TypeRésultat> = {
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
      };
      expect(résultatCourriel).to.deep.equal(réfCourriel);
    });

    it("ajout courriel détecté", async () => {
      const pRésultatCourriel = obtenir<
        RésultatObjectifRecherche<TypeRésultat>
      >(({ si }) =>
        rechercheCourriel({
          constl,
          idObjet: idCompte,
          f: si((r) => !!r && r.score > 1 / 3),
        }),
      );

      await constl.profil.sauvegarderCourriel({
        courriel: "julien.malard@mail.mcgill.ca",
      });

      const résultatCourriel = await pRésultatCourriel;

      const réf: RésultatObjectifRecherche<TypeRésultat> = {
        type: "résultat",
        de: "courriel",
        info: {
          type: "texte",
          début: 0,
          fin: 7,
          texte: "julien.malard@mail.mcgill.ca",
        },
        score: 1,
      };
      expect(résultatCourriel).to.deep.equal(réf);
    });

    it("résultat recherche vide", async () => {
      const résultat = await obtenir<RésultatObjectifRecherche<TypeRésultat>>(
        ({ siDéfini }) =>
          rechercheVide({ constl, idObjet: idCompte, f: siDéfini() }),
      );

      const réf: RésultatObjectifRecherche<InfoRésultatVide> = {
        type: "résultat",
        de: "*",
        info: {
          type: "vide",
        },
        score: 1,
      };
      expect(résultat).to.deep.equal(réf);
    });
  });
});
