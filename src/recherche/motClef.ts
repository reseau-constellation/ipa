import {
  combinerRecherches,
  rechercherSelonId,
  rechercherTousSiVide,
  similTexte,
} from "@/recherche/utils.js";
import type { Constellation } from "@/client.js";
import type {
  infoRésultatTexte,
  infoRésultatVide,
  schémaFonctionOublier,
  schémaFonctionSuiviRecherche,
  schémaFonctionSuivreObjectifRecherche,
} from "@/types.js";

export const rechercherMotsClefsSelonNom = (
  nomMotClef: string,
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: Constellation,
    idMotClef: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>,
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = async (noms: { [key: string]: string }) => {
      const corresp = similTexte(nomMotClef, noms);
      if (corresp) {
        const { score, clef, info } = corresp;
        return await fSuivreRecherche({
          type: "résultat",
          score,
          clef,
          info,
          de: "nom",
        });
      } else {
        return await fSuivreRecherche();
      }
    };
    const fOublier = await client.motsClefs.suivreNomsMotClef({
      idMotClef,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherMotsClefsSelonDescr = (
  desrcMotClef: string,
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: Constellation,
    idMotClef: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>,
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = async (noms: { [key: string]: string }) => {
      const corresp = similTexte(desrcMotClef, noms);
      if (corresp) {
        const { score, clef, info } = corresp;
        return await fSuivreRecherche({
          type: "résultat",
          score,
          clef,
          info,
          de: "descr",
        });
      } else {
        return await fSuivreRecherche();
      }
    };
    const fOublier = await client.motsClefs.suivreDescriptionsMotClef({
      idMotClef,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherMotsClefsSelonTexte = (
  texte: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatTexte | infoRésultatVide
> => {
  return async (
    client: Constellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatTexte | infoRésultatVide
    >,
  ): Promise<schémaFonctionOublier> => {
    const fRechercherNoms = rechercherMotsClefsSelonNom(texte);
    const fRechercherDescr = rechercherMotsClefsSelonDescr(texte);
    const fRechercherId = rechercherSelonId(texte);
    const fRechercherTous = rechercherTousSiVide(texte);

    return await combinerRecherches(
      {
        noms: fRechercherNoms,
        id: fRechercherId,
        descr: fRechercherDescr,
        vide: fRechercherTous,
      },
      client,
      idCompte,
      fSuivreRecherche,
    );
  };
};
