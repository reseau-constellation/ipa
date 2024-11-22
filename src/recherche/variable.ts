import type { Constellation } from "@/client.js";
import type {
  infoRésultatTexte,
  infoRésultatVide,
  schémaFonctionOublier,
  schémaFonctionSuiviRecherche,
  schémaFonctionSuivreObjectifRecherche,
} from "@/types.js";

import {
  combinerRecherches,
  rechercherSelonId,
  rechercherTousSiVide,
  similTexte,
} from "@/recherche/utils.js";

export const rechercherVariablesSelonNom = (
  nom: string,
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: Constellation,
    idVariable: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>,
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = async (nomsVariable: { [key: string]: string }) => {
      const résultat = similTexte(nom, nomsVariable);
      if (résultat) {
        const { score, clef, info } = résultat;
        return await fSuivreRecherche({
          type: "résultat",
          score,
          de: "nom",
          clef,
          info,
        });
      } else {
        return await fSuivreRecherche();
      }
    };
    const fOublier = await client.variables.suivreNomsVariable({
      idVariable,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherVariablesSelonDescr = (
  descr: string,
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: Constellation,
    idVariable: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>,
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = async (nomsVariable: { [key: string]: string }) => {
      const résultat = similTexte(descr, nomsVariable);
      if (résultat) {
        const { score, clef, info } = résultat;
        return await fSuivreRecherche({
          type: "résultat",
          score,
          de: "descr",
          clef,
          info,
        });
      } else {
        return await fSuivreRecherche();
      }
    };
    const fOublier = await client.variables.suivreDescriptionsVariable({
      idVariable,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherVariablesSelonTexte = (
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
    const fRechercherNoms = rechercherVariablesSelonNom(texte);
    const fRechercherDescr = rechercherVariablesSelonDescr(texte);
    const fRechercherId = rechercherSelonId(texte);
    const fRechercherTous = rechercherTousSiVide(texte);

    return await combinerRecherches(
      {
        noms: fRechercherNoms,
        descr: fRechercherDescr,
        id: fRechercherId,
        vide: fRechercherTous,
      },
      client,
      idCompte,
      fSuivreRecherche,
    );
  };
};
