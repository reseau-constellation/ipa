import ClientConstellation from "@/client.js";
import {
  schémaFonctionOublier,
  schémaFonctionSuivreObjectifRecherche,
  schémaFonctionSuiviRecherche,
  infoRésultatTexte,
  infoRésultatRecherche,
} from "@/utils/index.js";

import { rechercherVariableSelonNom } from "@/recherche/variable.js";
import { rechercherMotClefSelonNom } from "@/recherche/motClef.js";
import {
  combinerRecherches,
  sousRecherche,
  rechercherSelonId,
  similTexte,
} from "@/recherche/utils.js";

export const rechercherNuéeSelonNom = (
  nomNuée: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (noms: { [key: string]: string }) => {
      const corresp = similTexte(nomNuée, noms);
      if (corresp) {
        const { score, clef, info } = corresp;
        fSuivreRecherche({
          type: "résultat",
          score,
          clef,
          info,
          de: "nom",
        });
      } else {
        fSuivreRecherche();
      }
    };
    const fOublier = await client.nuées!.suivreNomsNuée({ idNuée, f: fSuivre });
    return fOublier;
  };
};

export const rechercherNuéeSelonDescr = (
  descrNuée: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (descrs: { [key: string]: string }) => {
      const corresp = similTexte(descrNuée, descrs);
      if (corresp) {
        const { score, clef, info } = corresp;
        fSuivreRecherche({
          type: "résultat",
          score,
          clef,
          info,
          de: "descr",
        });
      } else {
        fSuivreRecherche();
      }
    };
    const fOublier = await client.nuées!.suivreDescriptionsNuée({ idNuée, f: fSuivre });
    return fOublier;
  };
};

export const rechercherNuéeSelonIdVariable = (
  idVariable: string
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.nuées!.suivreVariablesNuée({
        idNuée,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idVariable);

    return await sousRecherche(
      "variable",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherNuéeSelonNomVariable = (
  nomVariable: string
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.nuées!.suivreVariablesNuée({
        idNuée,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherVariableSelonNom(nomVariable);

    return await sousRecherche(
      "variable",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherNuéeSelonVariable = (
  texte: string
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >
  ) => {
    return await combinerRecherches(
      {
        id: rechercherNuéeSelonIdVariable(texte),
        nom: rechercherNuéeSelonNomVariable(texte),
      },
      client,
      idNuée,
      fSuivreRecherche
    );
  };
};

export const rechercherNuéeSelonIdMotClef = (
  idMotClef: string
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.nuées!.suivreMotsClefsNuée({
        idNuée,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idMotClef);

    return await sousRecherche(
      "motClef",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherNuéeSelonNomMotClef = (
  nomMotClef: string
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.nuées!.suivreMotsClefsNuée({
        idNuée,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherMotClefSelonNom(nomMotClef);

    return await sousRecherche(
      "motClef",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherNuéeSelonMotClef = (
  texte: string
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >
  ) => {
    return await combinerRecherches(
      {
        id: rechercherNuéeSelonIdMotClef(texte),
        nom: rechercherNuéeSelonNomMotClef(texte),
      },
      client,
      idNuée,
      fSuivreRecherche
    );
  };
};

export const rechercherNuéeSelonTexte = (
  texte: string
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte> | infoRésultatTexte
> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte> | infoRésultatTexte
    >
  ) => {
    return await combinerRecherches<
      infoRésultatRecherche<infoRésultatTexte> | infoRésultatTexte
    >(
      {
        nom: rechercherNuéeSelonNom(texte),
        descr: rechercherNuéeSelonDescr(texte),
        variables: rechercherNuéeSelonVariable(texte),
        motsClefs: rechercherNuéeSelonMotClef(texte),
        id: rechercherSelonId(texte),
      },
      client,
      idNuée,
      fSuivreRecherche
    );
  };
};
