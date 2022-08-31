import ClientConstellation from "@/client.js";
import {
  schémaFonctionOublier,
  schémaFonctionSuivreObjectifRecherche,
  schémaFonctionSuiviRecherche,
  infoRésultatTexte,
} from "@/utils/index.js";

import { similTexte, combinerRecherches, rechercherSelonId } from "./utils.js";

export const rechercherVariableSelonNom = (
  nom: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idVariable: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (nomsVariable: { [key: string]: string }) => {
      const résultat = similTexte(nom, nomsVariable);
      if (résultat) {
        const { score, clef, info } = résultat;
        fSuivreRecherche({
          type: "résultat",
          score,
          de: "nom",
          clef,
          info,
        });
      } else {
        fSuivreRecherche();
      }
    };
    const fOublier = await client.variables!.suivreNomsVariable({
      id: idVariable,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherVariableSelonDescr = (
  descr: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idVariable: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (nomsVariable: { [key: string]: string }) => {
      const résultat = similTexte(descr, nomsVariable);
      if (résultat) {
        const { score, clef, info } = résultat;
        fSuivreRecherche({
          type: "résultat",
          score,
          de: "descr",
          clef,
          info,
        });
      } else {
        fSuivreRecherche();
      }
    };
    const fOublier = await client.variables!.suivreDescrVariable({
      id: idVariable,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherVariableSelonTexte = (
  texte: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
  ): Promise<schémaFonctionOublier> => {
    const fRechercherNoms = rechercherVariableSelonNom(texte);
    const fRechercherDescr = rechercherVariableSelonDescr(texte);
    const fRechercherId = rechercherSelonId(texte);

    return await combinerRecherches(
      { noms: fRechercherNoms, descr: fRechercherDescr, id: fRechercherId },
      client,
      idCompte,
      fSuivreRecherche
    );
  };
};
