import type { default as ClientConstellation } from "@/client.js";
import type {
  schémaFonctionOublier,
  schémaFonctionSuivreObjectifRecherche,
  schémaFonctionSuiviRecherche,
  infoRésultatTexte,
} from "@/types.js";

import {
  similTexte,
  combinerRecherches,
  rechercherSelonId,
} from "@/recherche/utils.js";

export const rechercherVariablesSelonNom = (
  nom: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idVariable: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
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
    const fOublier = await client.variables!.suivreNomsVariable({
      idVariable,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherVariablesSelonDescr = (
  descr: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idVariable: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
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
    const fOublier = await client.variables!.suivreDescrVariable({
      idVariable,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherVariablesSelonTexte = (
  texte: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
  ): Promise<schémaFonctionOublier> => {
    const fRechercherNoms = rechercherVariablesSelonNom(texte);
    const fRechercherDescr = rechercherVariablesSelonDescr(texte);
    const fRechercherId = rechercherSelonId(texte);

    return await combinerRecherches(
      { noms: fRechercherNoms, descr: fRechercherDescr, id: fRechercherId },
      client,
      idCompte,
      fSuivreRecherche
    );
  };
};
