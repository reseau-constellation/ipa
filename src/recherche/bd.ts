import type { default as ClientConstellation } from "@/client.js";
import type {
  schémaFonctionOublier,
  schémaFonctionSuivreObjectifRecherche,
  schémaFonctionSuiviRecherche,
  infoRésultatTexte,
  infoRésultatRecherche,
} from "@/types.js";

import { rechercherVariablesSelonNom } from "@/recherche/variable.js";
import { rechercherMotsClefsSelonNom } from "@/recherche/motClef.js";
import {
  combinerRecherches,
  sousRecherche,
  rechercherSelonId,
  similTexte,
} from "@/recherche/utils.js";

export const rechercherBdsSelonNom = (
  nomBd: string,
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>,
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = async (noms: { [key: string]: string }) => {
      const corresp = similTexte(nomBd, noms);
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
    const fOublier = await client.bds.suivreNomsBd({ idBd, f: fSuivre });
    return fOublier;
  };
};

export const rechercherBdsSelonDescr = (
  descrBd: string,
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>,
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = async (descrs: { [key: string]: string }) => {
      const corresp = similTexte(descrBd, descrs);
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
    const fOublier = await client.bds.suivreDescriptionsBd({
      idBd,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherBdsSelonIdVariable = (
  idVariable: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >,
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void,
    ): Promise<schémaFonctionOublier> => {
      return await client.bds.suivreVariablesBd({
        idBd,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idVariable);

    return await sousRecherche(
      "variable",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche,
    );
  };
};

export const rechercherBdsSelonNomVariable = (
  nomVariable: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >,
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void,
    ): Promise<schémaFonctionOublier> => {
      return await client.bds.suivreVariablesBd({
        idBd,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherVariablesSelonNom(nomVariable);

    return await sousRecherche(
      "variable",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche,
    );
  };
};

export const rechercherBdsSelonVariable = (
  texte: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >,
  ) => {
    return await combinerRecherches(
      {
        id: rechercherBdsSelonIdVariable(texte),
        nom: rechercherBdsSelonNomVariable(texte),
      },
      client,
      idBd,
      fSuivreRecherche,
    );
  };
};

export const rechercherBdsSelonIdMotClef = (
  idMotClef: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >,
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void,
    ): Promise<schémaFonctionOublier> => {
      return await client.bds.suivreMotsClefsBd({
        idBd,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idMotClef);

    return await sousRecherche(
      "motClef",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche,
    );
  };
};

export const rechercherBdsSelonNomMotClef = (
  nomMotClef: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >,
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void,
    ): Promise<schémaFonctionOublier> => {
      return await client.bds.suivreMotsClefsBd({
        idBd,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherMotsClefsSelonNom(nomMotClef);

    return await sousRecherche(
      "motClef",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche,
    );
  };
};

export const rechercherBdsSelonMotClef = (
  texte: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >,
  ) => {
    return await combinerRecherches(
      {
        id: rechercherBdsSelonIdMotClef(texte),
        nom: rechercherBdsSelonNomMotClef(texte),
      },
      client,
      idBd,
      fSuivreRecherche,
    );
  };
};

export const rechercherBdsSelonTexte = (
  texte: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte> | infoRésultatTexte
> => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte> | infoRésultatTexte
    >,
  ) => {
    return await combinerRecherches<
      infoRésultatRecherche<infoRésultatTexte> | infoRésultatTexte
    >(
      {
        nom: rechercherBdsSelonNom(texte),
        descr: rechercherBdsSelonDescr(texte),
        variables: rechercherBdsSelonVariable(texte),
        motsClefs: rechercherBdsSelonMotClef(texte),
        id: rechercherSelonId(texte),
      },
      client,
      idBd,
      fSuivreRecherche,
    );
  };
};
