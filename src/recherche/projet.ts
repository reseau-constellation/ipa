import type { Constellation } from "@/client.js";
import type {
  schémaFonctionOublier,
  schémaFonctionSuivreObjectifRecherche,
  schémaFonctionSuiviRecherche,
  infoRésultatRecherche,
  infoRésultatTexte,
  infoRésultatVide,
} from "@/types.js";

import { rechercherBdsSelonTexte } from "@/recherche/bd.js";
import {
  rechercherVariablesSelonTexte,
  rechercherVariablesSelonNom,
} from "@/recherche/variable.js";
import {
  rechercherMotsClefsSelonTexte,
  rechercherMotsClefsSelonNom,
} from "@/recherche/motClef.js";
import {
  similTexte,
  combinerRecherches,
  sousRecherche,
  rechercherSelonId,
  rechercherTousSiVide,
} from "@/recherche/utils.js";

export const rechercherProjetsSelonNom = (
  nomProjet: string,
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: Constellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>,
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (noms: { [key: string]: string }) => {
      const corresp = similTexte(nomProjet, noms);
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
    const fOublier = await client.projets.suivreNomsProjet({
      idProjet,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherProjetsSelonDescr = (
  descProjet: string,
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: Constellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>,
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (descrs: { [key: string]: string }) => {
      const corresp = similTexte(descProjet, descrs);
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
    const fOublier = await client.projets.suivreDescriptionsProjet({
      idProjet,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherProjetsSelonIdBd = (
  idBd: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: Constellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >,
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void,
    ): Promise<schémaFonctionOublier> => {
      return await client.projets.suivreBdsProjet({
        idProjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idBd);

    return await sousRecherche(
      "bd",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche,
    );
  };
};

export const rechercherProjetsSelonBd = (
  texte: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<
    | infoRésultatTexte
    | infoRésultatRecherche<infoRésultatTexte>
    | infoRésultatVide
  >
> => {
  return async (
    client: Constellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<infoRésultatTexte>
        | infoRésultatVide
      >
    >,
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void,
    ): Promise<schémaFonctionOublier> => {
      return await client.projets.suivreBdsProjet({
        idProjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherBdsSelonTexte(texte);

    return await sousRecherche(
      "bd",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche,
    );
  };
};

export const rechercherProjetsSelonIdVariable = (
  idVariable: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: Constellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >,
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void,
    ): Promise<schémaFonctionOublier> => {
      return await client.projets.suivreVariablesProjet({
        idProjet,
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

export const rechercherProjetsSelonNomVariable = (
  nomVariable: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: Constellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >,
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void,
    ): Promise<schémaFonctionOublier> => {
      return await client.projets.suivreVariablesProjet({
        idProjet,
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

export const rechercherProjetsSelonVariable = (
  texte: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte | infoRésultatVide>
> => {
  return async (
    client: Constellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte | infoRésultatVide>
    >,
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void,
    ): Promise<schémaFonctionOublier> => {
      return await client.projets.suivreVariablesProjet({
        idProjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherVariablesSelonTexte(texte);

    return await sousRecherche(
      "variable",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche,
    );
  };
};

export const rechercherProjetsSelonIdMotClef = (
  idMotClef: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: Constellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >,
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (motsClefs: string[]) => void,
    ): Promise<schémaFonctionOublier> => {
      return await client.projets.suivreMotsClefsProjet({
        idProjet,
        f: (motsClefs) => fSuivreRacine(motsClefs.map((m) => m.idMotClef)),
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

export const rechercherProjetsSelonNomMotClef = (
  nomMotClef: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: Constellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >,
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (motsClefs: string[]) => void,
    ): Promise<schémaFonctionOublier> => {
      return await client.projets.suivreMotsClefsProjet({
        idProjet,
        f: (motsClefs) => fSuivreRacine(motsClefs.map((m) => m.idMotClef)),
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

export const rechercherProjetsSelonMotClef = (
  texte: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte | infoRésultatVide>
> => {
  return async (
    client: Constellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte | infoRésultatVide>
    >,
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (motsClefs: string[]) => void,
    ): Promise<schémaFonctionOublier> => {
      return await client.projets.suivreMotsClefsProjet({
        idProjet,
        f: (motsClefs) => fSuivreRacine(motsClefs.map((m) => m.idMotClef)),
      });
    };

    const fRechercher = rechercherMotsClefsSelonTexte(texte);

    return await sousRecherche(
      "motClef",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche,
    );
  };
};

export const rechercherProjetsSelonTexte = (
  texte: string,
): schémaFonctionSuivreObjectifRecherche<
  | infoRésultatTexte
  | infoRésultatRecherche<
      | infoRésultatTexte
      | infoRésultatRecherche<infoRésultatTexte | infoRésultatVide>
      | infoRésultatVide
    >
  | infoRésultatVide
> => {
  return async (
    client: Constellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      | infoRésultatTexte
      | infoRésultatRecherche<
          | infoRésultatTexte
          | infoRésultatRecherche<infoRésultatTexte | infoRésultatVide>
          | infoRésultatVide
        >
      | infoRésultatVide
    >,
  ): Promise<schémaFonctionOublier> => {
    const fRechercherNoms = rechercherProjetsSelonNom(texte);
    const fRechercherDescr = rechercherProjetsSelonDescr(texte);
    const fRechercherBd = rechercherProjetsSelonBd(texte);
    const fRechercherVariable = rechercherProjetsSelonVariable(texte);
    const fRechercherMotClef = rechercherProjetsSelonMotClef(texte);
    const fRechercherId = rechercherSelonId(texte);
    const fRechercherTous = rechercherTousSiVide(texte);

    return await combinerRecherches<
      | infoRésultatTexte
      | infoRésultatRecherche<
          | infoRésultatTexte
          | infoRésultatVide
          | infoRésultatRecherche<infoRésultatTexte | infoRésultatVide>
        >
      | infoRésultatVide
    >(
      {
        noms: fRechercherNoms,
        descr: fRechercherDescr,
        bd: fRechercherBd,
        variable: fRechercherVariable,
        motClef: fRechercherMotClef,
        id: fRechercherId,
        tous: fRechercherTous,
      },
      client,
      idCompte,
      fSuivreRecherche,
    );
  };
};
