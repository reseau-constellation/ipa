import { ignorerNonDéfinis } from "@constl/utils-ipa";
import type { Constellation } from "@/v2/index.js";
import type { Oublier } from "@/v2/crabe/types.js";
import type { SuivreObjectifRecherche, InfoRésultatVide, SuiviRecherche, InfoRésultatTexte, RésultatObjectifRecherche } from "../types.js";
import {
  combinerRecherches,
  rechercherDansTexte,
  rechercherSelonId,
  rechercherTousSiVide,
  similImages,
  similTexte,
} from "@/v2/recherche/fonctions/utils.js";

export const rechercherProfilsSelonActivité =
  (): SuivreObjectifRecherche<InfoRésultatVide> => {
    return async ({ constl, idObjet, f }: {
      constl: Constellation,
      idObjet: string,
      f: SuiviRecherche<InfoRésultatVide>,
    }): Promise<Oublier> => {
      const infosCompte: {
        noms?: { [key: string]: string };
        image?: Uint8Array | null;
        courriel?: string | null;
      } = {
        noms: undefined,
        image: undefined,
        courriel: undefined,
      };
      const calculerScore = (): RésultatObjectifRecherche<InfoRésultatVide> => {
        const score =
          [
            Object.keys(infosCompte.noms || {}).length > 0,
            infosCompte.image,
            infosCompte.courriel,
          ].filter(Boolean).length / 3;

        return {
          type: "résultat",
          score,
          de: "activité",
          info: { type: "vide" },
        };
      };
      const fSuivreNoms = (noms: { [key: string]: string }) => {
        infosCompte.noms = noms;
        f(calculerScore());
      };
      const fSuivreImage = (
        infoImage: { image: Uint8Array; idImage: string } | null,
      ) => {
        infosCompte.image = infoImage?.image;
        f(calculerScore());
      };
      const fSuivreCourriel = (courriel: string | null | undefined) => {
        infosCompte.courriel = courriel;
        f(calculerScore());
      };

      const fOublierNoms = await constl.profil.suivreNoms({
        idCompte: idObjet,
        f: ignorerNonDéfinis(fSuivreNoms),
      });
      const fOublierImage = await constl.profil.suivreImage({
        idCompte: idObjet,
        f: fSuivreImage,
      });
      const fOublierCourriel = await constl.profil.suivreCourriel({
        idCompte: idObjet,
        f: fSuivreCourriel,
      });

      const fOublier = async () => {
        await Promise.allSettled([
          fOublierNoms(),
          fOublierImage(),
          fOublierCourriel(),
        ]);
      };

      return fOublier;
    };
  };

export const rechercherProfilsSelonNom = (
  nom: string,
): SuivreObjectifRecherche<InfoRésultatTexte> => {
  return async ({ constl, idObjet, f }: {
    constl: Constellation,
    idObjet: string,
    f: SuiviRecherche<InfoRésultatTexte>,
  }): Promise<Oublier> => {
    const fSuivre = (noms: { [key: string]: string }) => {
      const corresp = similTexte(nom, noms);
      if (corresp) {
        const { score, clef, info } = corresp;
        f({
          type: "résultat",
          score,
          clef,
          info,
          de: "nom",
        });
      } else {
        f();
      }
    };
    const fOublier = await constl.profil.suivreNoms({
      idCompte: idObjet,
      f: ignorerNonDéfinis(fSuivre),
    });
    return fOublier;
  };
};

export const rechercherProfilsSelonCourriel = (
  courriel: string,
): SuivreObjectifRecherche<InfoRésultatTexte> => {
  return async ({ constl, idObjet, f }: {
    constl: Constellation,
    idObjet: string,
    f: SuiviRecherche<InfoRésultatTexte>,
  }): Promise<Oublier> => {
    const fSuivre = (courrielProfil: string | null | undefined) => {
      const corresp = courrielProfil
        ? rechercherDansTexte(courriel, courrielProfil)
        : undefined;

      if (corresp && courrielProfil) {
        const { score, début, fin } = corresp;
        f({
          type: "résultat",
          score,
          de: "courriel",
          info: { type: "texte", début, fin, texte: courrielProfil },
        });
      } else {
        f();
      }
    };
    const fOublier = await constl.profil.suivreCourriel({
      idCompte: idObjet,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherProfilsSelonTexte = (
  texte: string,
): SuivreObjectifRecherche<InfoRésultatTexte | InfoRésultatVide> => {
  return async ({ constl, idObjet, f }: {
    constl: Constellation,
    idObjet: string,
    f: SuiviRecherche<InfoRésultatTexte | InfoRésultatVide>,
  }): Promise<Oublier> => {
    const fRechercherNoms = rechercherProfilsSelonNom(texte);
    const fRechercherCourriel = rechercherProfilsSelonCourriel(texte);
    const fRechercherId = rechercherSelonId(texte);
    const fRechercherTous = rechercherTousSiVide(texte);

    return await combinerRecherches(
      {
        noms: fRechercherNoms,
        courriel: fRechercherCourriel,
        id: fRechercherId,
        vide: fRechercherTous,
      },
      constl,
      idObjet,
      f,
    );
  };
};

export const rechercherProfilsSelonImage = (
  image: Uint8Array,
): SuivreObjectifRecherche<InfoRésultatVide> => {
  return async ({ constl, idObjet, f }: {
    constl: Constellation,
    idObjet: string,
    f: SuiviRecherche<InfoRésultatVide>,
  }): Promise<Oublier> => {
    const fSuivre = (imageCompte: Uint8Array | null) => {
      const score = similImages(image, imageCompte);
      f({
        type: "résultat",
        score,
        de: "image",
        info: { type: "vide" },
      });
    };
    const fOublier = await constl.profil.suivreImage({
      idCompte: idObjet,
      f: (x) => fSuivre(x?.image || null),
    });
    return fOublier;
  };
};
