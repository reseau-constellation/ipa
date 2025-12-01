import {
  attendreStabilité,
  faisRien,
  ignorerNonDéfinis,
  suivreFonctionImbriquée,
  suivreDeFonctionListe,
  traduire,
  uneFois,
} from "@constl/utils-ipa";
import Base64 from "crypto-js/enc-base64.js";
import md5 from "crypto-js/md5.js";
import { utils } from "xlsx";

import {
  schémaStructureBdMétadonnées,
  schémaStructureBdNoms,
} from "@/types.js";

import { ComposanteClientListe } from "./v2/nébuleuse/services.js";
import type {
  donnéesTableauExportation,
  élémentDonnées,
  différenceTableaux,
  InfoCol,
  InfoColAvecCatégorie,
  élémentBdListeDonnées,
} from "@/tableaux.js";
import type { Constellation } from "@/client.js";
import type { TypedKeyValue } from "@constl/bohr-db";
import type { BookType } from "xlsx";
import type {
  différenceBds,
  différenceTableauxBds,
  donnéesBdExportées,
  infoTableauAvecId,
  schémaSpécificationBd,
} from "@/bds.js";
import type { élémentDeMembreAvecValid } from "@/reseau.js";
import type {
  TraducsTexte,
  schémaRetourFonctionRechercheParN,
  élémentsBd,
  infoAuteur,
  infoRésultatVide,
  résultatRecherche,
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaFonctionSuiviRecherche,
  schémaRetourFonctionRechercheParProfondeur,
} from "@/types.js";
import type { erreurValidation, règleColonne, règleVariable } from "@/valid.js";
import {
  cacheRechercheParN,
  cacheRechercheParProfondeur,
  cacheSuivi,
} from "@/décorateursCache.js";
import { schémaBdTableauxDeBd } from "@/bds.js";

export type correspondanceBdEtNuée = {
  nuée: string;
  différences: différenceBds[];
};

export type statutMembreNuée = {
  idCompte: string;
  statut: "exclus" | "accepté";
};

export type donnéesNuéeExportation = {
  nomNuée: string;
  tableaux: donnéesTableauExportation[];
};

export class Nuées extends ComposanteClientListe<string> {
  constructor({ client }: { client: Constellation }) {
    super({ client, clef: "nuées", schémaBdPrincipale: { type: "string" } });
  }

  async suivreMétadonnéesNuée({
    idNuée,
    f,
    hériter = true,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<{ [clef: string]: élémentsBd }>;
    hériter?: boolean;
  }): Promise<schémaFonctionOublier> {
    if (hériter) {
      const fFinale = async (métadonnées: { [key: string]: élémentsBd }[]) => {
        await f(Object.assign({}, ...métadonnées));
      };

      return await this.suivreDeParents({
        idNuée,
        f: fFinale,
        fParents: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: schémaFonctionSuivi<{ [key: string]: élémentsBd }>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.suivreBdDicDeClef({
            id,
            clef: "métadonnées",
            schéma: schémaStructureBdMétadonnées,
            f: fSuivreBranche,
          });
        },
      });
    } else {
      return await this.client.suivreBdDicDeClef({
        id: idNuée,
        clef: "métadonnées",
        schéma: schémaStructureBdMétadonnées,
        f,
      });
    }
  }

  async suivreNomsNuée({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (noms: { [key: string]: string }[]) => {
      await f(Object.assign({}, ...noms));
    };

    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents: async ({
        id,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: schémaFonctionSuivi<{ [key: string]: string }>;
      }): Promise<schémaFonctionOublier> => {
        return await this.client.suivreBdDicDeClef({
          id,
          clef: "noms",
          schéma: schémaStructureBdNoms,
          f: fSuivreBranche,
        });
      },
    });
  }

  @cacheSuivi
  async suivreDescriptionsNuée({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (noms: { [key: string]: string }[]) => {
      await f(Object.assign({}, ...noms));
    };

    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents: async ({
        id,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: schémaFonctionSuivi<{ [key: string]: string }>;
      }): Promise<schémaFonctionOublier> => {
        return await this.client.suivreBdDicDeClef({
          id,
          clef: "descriptions",
          schéma: schémaStructureBdNoms,
          f: fSuivreBranche,
        });
      },
    });
  }

  @cacheSuivi
  async suivreMotsClefsNuée({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (motsClefs: string[][]) => {
      await f([...new Set(motsClefs.flat())]);
    };

    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents: async ({
        id,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: schémaFonctionSuivi<string[]>;
      }): Promise<schémaFonctionOublier> => {
        return await this.client.suivreBdListeDeClef({
          id,
          clef: "motsClefs",
          schéma: { type: "string" },
          f: fSuivreBranche,
        });
      },
    });
  }

  async changerPhisolophieAutorisation({
    idAutorisation,
    philosophie,
  }: {
    idAutorisation: string;
    philosophie: "IJPC" | "CJPI";
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idAutorisation,
      type: "keyvalue",
      schéma: schémaStructureBdAutorisation,
    });
    await bd.set("philosophie", philosophie);
    fOublier();
  }

  async suivrePhilosophieAutorisation({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<"IJPC" | "CJPI">;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (
      bd?: TypedKeyValue<Partial<structureBdAutorisation>>,
    ) => {
      if (!bd) return;
      const philosophie = await bd.get("philosophie");
      if (philosophie && ["IJPC", "CJPI"].includes(philosophie)) {
        await f(philosophie as "IJPC" | "CJPI");
      }
    };

    const fRacine = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (nouvelIdBdCible?: string | undefined) => Promise<void>;
    }) => {
      return await this.suivreGestionnaireAutorisations({
        idNuée,
        f: fSuivreRacine,
      });
    };

    const fSuivre = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<
        TypedKeyValue<Partial<structureBdAutorisation>> | undefined
      >;
    }) => {
      return await this.client.suivreBd({
        id,
        type: "keyvalue",
        schéma: schémaStructureBdAutorisation,
        f: fSuivreBd,
      });
    };
    return await suivreFonctionImbriquée({
      fRacine,
      f: fFinale,
      fSuivre,
    });
  }

  /*
  async bloquerContenu({
    idNuée,
    // contenu,
  }: {
    idNuée: string;
    contenu: élémentsBd;
  }): Promise<void> {

    throw new Error("Pas encore implémenté")

    await this._confirmerPermission({idNuée});
    const idBdBloqués = await this.client.obtIdBd({
      nom: "bloqués",
      racine: idNuée,
      type: "keyvalue",
    });
    

    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdBloqués,
      type: "set",
      schéma: schémaBdContenuBloqué,
    });
    await bd.add({
      contenu,
    });
    fOublier(); 
  }*/

  async suivreContenuBloqué() {}

  async réordonnerTableauNuée({
    idNuée,
    idTableau,
    position,
  }: {
    idNuée: string;
    idTableau: string;
    position: number;
  }): Promise<void> {
    await this._confirmerPermission({ idNuée });
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: idNuée,
      type: "ordered-keyvalue",
    });

    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdTableaux,
      type: "ordered-keyvalue",
      schéma: schémaBdTableauxDeBd,
    });

    const tableauxExistants = await bdTableaux.all();
    const positionExistante = tableauxExistants.findIndex(
      (t) => t.key === idTableau,
    );
    if (position !== positionExistante)
      await bdTableaux.move(idTableau, position);
    await fOublier();
  }

  @cacheSuivi
  async suivreNomsTableauNuée({
    idNuée,
    clefTableau,
    f,
  }: {
    idNuée: string;
    clefTableau: string;
    f: schémaFonctionSuivi<TraducsTexte>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (lNoms: { [key: string]: string }[]) => {
      await f(Object.assign({}, ...lNoms));
    };

    const fParents = async ({
      id: idNuéeParent,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<{
        [key: string]: string;
      }>;
    }): Promise<schémaFonctionOublier> => {
      return await suivreFonctionImbriquée({
        fRacine: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (nouvelIdBdCible?: string) => Promise<void>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.bds.suivreIdTableauParClef({
            idBd: idNuéeParent,
            clef: clefTableau,
            f: fSuivreRacine,
          });
        },
        f: ignorerNonDéfinis(fSuivreBranche),
        fSuivre: async ({
          id: idTableau,
          fSuivreBd,
        }: {
          id: string;
          fSuivreBd: schémaFonctionSuivi<{ [key: string]: string }>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.tableaux.suivreNomsTableau({
            idTableau,
            f: fSuivreBd,
          });
        },
      });
    };
    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents,
    });
  }

  @cacheSuivi
  async suivreColonnesEtCatégoriesTableauNuée({
    idNuée,
    clefTableau,
    f,
  }: {
    idNuée: string;
    clefTableau: string;
    f: schémaFonctionSuivi<InfoColAvecCatégorie[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (colonnes: InfoColAvecCatégorie[][]) => {
      await f(colonnes.flat());
    };

    const fParents = async ({
      id: idNuéeParent,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<InfoColAvecCatégorie[]>;
    }): Promise<schémaFonctionOublier> => {
      return await suivreFonctionImbriquée({
        fRacine: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (nouvelIdBdCible?: string) => Promise<void>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.bds.suivreIdTableauParClef({
            idBd: idNuéeParent,
            clef: clefTableau,
            f: fSuivreRacine,
          });
        },
        f: ignorerNonDéfinis(fSuivreBranche),
        fSuivre: async ({
          id: idTableau,
          fSuivreBd,
        }: {
          id: string;
          fSuivreBd: schémaFonctionSuivi<InfoColAvecCatégorie[]>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.tableaux.suivreColonnesEtCatégoriesTableau({
            idTableau,
            f: fSuivreBd,
          });
        },
      });
    };

    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents,
    });
  }

  @cacheSuivi
  async suivreColonnesTableauNuée({
    idNuée,
    clefTableau,
    f,
  }: {
    idNuée: string;
    clefTableau: string;
    f: schémaFonctionSuivi<InfoCol[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (colonnes: InfoCol[][]) => {
      await f(colonnes.flat());
    };

    const fParents = async ({
      id: idNuéeParent,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<InfoCol[]>;
    }): Promise<schémaFonctionOublier> => {
      return await suivreFonctionImbriquée({
        fRacine: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (nouvelIdBdCible?: string) => Promise<void>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.bds.suivreIdTableauParClef({
            idBd: idNuéeParent,
            clef: clefTableau,
            f: fSuivreRacine,
          });
        },
        f: ignorerNonDéfinis(fSuivreBranche),
        fSuivre: async ({
          id: idTableau,
          fSuivreBd,
        }: {
          id: string;
          fSuivreBd: schémaFonctionSuivi<InfoCol[]>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.tableaux.suivreColonnesTableau({
            idTableau,
            f: fSuivreBd,
          });
        },
      });
    };

    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents,
    });
  }

  @cacheSuivi
  async suivreRèglesTableauNuée({
    idNuée,
    clefTableau,
    f,
  }: {
    idNuée: string;
    clefTableau: string;
    f: schémaFonctionSuivi<règleColonne[]>;
    catégories?: boolean;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (règles: règleColonne[][]) => {
      await f(règles.flat());
    };

    const fParents = async ({
      id: idNuéeParent,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<règleColonne[]>;
    }): Promise<schémaFonctionOublier> => {
      return await suivreFonctionImbriquée({
        fRacine: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (nouvelIdBdCible?: string) => Promise<void>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.bds.suivreIdTableauParClef({
            idBd: idNuéeParent,
            clef: clefTableau,
            f: fSuivreRacine,
          });
        },
        f: ignorerNonDéfinis(fSuivreBranche),
        fSuivre: async ({
          id: idTableau,
          fSuivreBd,
        }: {
          id: string;
          fSuivreBd: schémaFonctionSuivi<règleColonne[]>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.tableaux.suivreRègles({
            idTableau,
            f: fSuivreBd,
          });
        },
      });
    };
    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents,
    });
  }

  @cacheSuivi
  async suivreCorrespondanceBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<correspondanceBdEtNuée[]>;
  }): Promise<schémaFonctionOublier> {
    const fSuivreNuéesDeBd = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsNuées: string[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.bds.suivreNuéesBd({
        idBd,
        f: fSuivreRacine,
      });
    };
    const fSuivreNuée = async ({
      id: idNuée,
      fSuivreBranche: fSuivreBrancheNuée,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<différenceBds[]>;
    }): Promise<schémaFonctionOublier> => {
      const info: {
        différencesBds: différenceBds[];
        différencesTableaux: différenceTableauxBds[];
      } = {
        différencesBds: [],
        différencesTableaux: [],
      };

      const fFinaleNuée = async () => {
        fSuivreBrancheNuée([
          ...info.différencesBds,
          ...info.différencesTableaux,
        ]);
      };

      const fOublierDifférencesBd = await this.suivreDifférencesNuéeEtBd({
        idNuée,
        idBd,
        f: async (différences) => {
          info.différencesBds = différences;
          await fFinaleNuée();
        },
      });

      const fBranche = async ({
        id,
        fSuivreBranche,
        branche,
      }: {
        id: string;
        fSuivreBranche: schémaFonctionSuivi<différenceTableauxBds[]>;
        branche: infoTableauAvecId;
      }): Promise<schémaFonctionOublier> => {
        return await this.suivreDifférencesNuéeEtTableau({
          idNuée,
          clefTableau: branche.clef,
          idTableau: id,
          f: async (diffs) => {
            await fSuivreBranche(
              diffs.map((d) => {
                return {
                  type: "tableau",
                  sévère: d.sévère,
                  idTableau: id,
                  différence: d,
                };
              }),
            );
          },
        });
      };

      const fOublierDifférencesTableaux = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (idsTableaux: infoTableauAvecId[]) => Promise<void>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.bds.suivreTableauxBd({
            idBd,
            f: fSuivreRacine,
          });
        },
        f: async (diffs: différenceTableauxBds[]) => {
          info.différencesTableaux = diffs;
          await fFinaleNuée();
        },
        fBranche,
        fIdDeBranche: (t) => t.id,
      });

      return async () => {
        await Promise.allSettled([
          fOublierDifférencesBd,
          fOublierDifférencesTableaux,
        ]);
      };
    };

    return await suivreDeFonctionListe({
      fListe: fSuivreNuéesDeBd,
      f,
      fBranche: fSuivreNuée,
    });
  }

  @cacheRechercheParN
  async rechercherNuéesDéscendantes({
    idNuée,
    f,
    nRésultatsDésirés,
    toutLeRéseau = true,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string[]>;
    nRésultatsDésirés?: number;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fFinale = async (
      résultats: résultatRecherche<infoRésultatVide>[],
    ) => {
      f(résultats.map((r) => r.id));
    };
    return await this.client.réseau.rechercherNuées({
      f: fFinale,
      fObjectif: async (
        client: Constellation,
        id: string,
        fSuiviRésultats: schémaFonctionSuiviRecherche<infoRésultatVide>,
      ): Promise<schémaFonctionOublier> => {
        return await client.nuées.suivreNuéesParents({
          idNuée: id,
          f: (parents) => {
            if (parents.includes(idNuée))
              fSuiviRésultats({
                type: "résultat",
                score: 1,
                de: "*",
                info: {
                  type: "vide",
                },
              });
          },
        });
      },
      nRésultatsDésirés,
      toutLeRéseau,
    });
  }

  @cacheSuivi
  async suivreNuéesParents({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    let annulé = false;
    const ascendance: {
      [nuée: string]: { parent: string; fOublier: schémaFonctionOublier };
    } = {};

    const fFinale = async () => {
      await f(Object.values(Object.values(ascendance).map((a) => a.parent)));
    };
    const suivreParent = async ({
      id,
    }: {
      id: string;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.suivreBd({
        id,
        type: "keyvalue",
        schéma: schémaStructureBdNuée,
        f: async (bd) => {
          if (annulé) return;

          const parent = await bd.get("parent");
          if (ascendance[id]?.parent === parent) {
            if (!parent) await fFinale();
            return;
          }

          await ascendance[id]?.fOublier();
          if (parent) {
            const fOublierParent = await suivreParent({ id: parent });
            ascendance[id] = {
              parent,
              fOublier: async () => {
                await fOublierParent();
                await ascendance[parent]?.fOublier();
                delete ascendance[id];
                await fFinale();
              },
            };
          } else {
            delete ascendance[id];
          }

          await fFinale();
        },
      });
    };
    const fOublier = await suivreParent({ id: idNuée });
    return async () => {
      annulé = true;
      await fOublier();
      await Promise.allSettled(
        Object.values(ascendance).map((a) => a.fOublier()),
      );
    };
  }

  @cacheRechercheParProfondeur
  async suivreBdsCorrespondantesDUneNuée({
    idNuée,
    f,
    nRésultatsDésirés,
    vérifierAutorisation = true,
    toujoursInclureLesMiennes = true,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string[]>;
    nRésultatsDésirés?: number;
    vérifierAutorisation?: boolean;
    toujoursInclureLesMiennes?: boolean;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    if (vérifierAutorisation) {
      const info: {
        philoAutorisation?: "CJPI" | "IJPC";
        membres?: statutMembreNuée[];
        bds?: { idBd: string; auteurs: string[] }[];
      } = {};

      const fFinale = async (): Promise<void> => {
        const { philoAutorisation, membres, bds } = info;

        if (!bds) return;

        if (!philoAutorisation) {
          if (toujoursInclureLesMiennes) {
            return await f(
              bds
                .filter((bd) =>
                  bd.auteurs.some((c) => c === this.client.idCompte),
                )
                .map((x) => x.idBd),
            );
          }
          return;
        }

        if (!membres) return;
        const idMonCompte = await this.client.obtIdCompte();

        const filtrerAutorisation = (
          bds_: { idBd: string; auteurs: string[] }[],
        ): string[] => {
          if (philoAutorisation === "CJPI") {
            const invités = membres
              .filter((m) => m.statut === "accepté")
              .map((m) => m.idCompte);

            return bds_
              .filter(
                (x) =>
                  x.auteurs.some((c) => invités.includes(c)) ||
                  (toujoursInclureLesMiennes &&
                    x.auteurs.includes(idMonCompte)),
              )
              .map((x) => x.idBd);
          } else if (philoAutorisation === "IJPC") {
            const exclus = membres
              .filter((m) => m.statut === "exclus")
              .map((m) => m.idCompte);
            return bds_
              .filter((x) => !x.auteurs.some((c) => exclus.includes(c)))
              .map((x) => x.idBd);
          } else {
            throw new Error(philoAutorisation);
          }
        };
        return await f(filtrerAutorisation(bds));
      };

      const fOublierSuivrePhilo = await this.suivrePhilosophieAutorisation({
        idNuée,
        f: async (philo) => {
          info.philoAutorisation = philo;
          await fFinale();
        },
      });

      const fOublierSuivreMembres = await this.suivreAutorisationsMembresDeNuée(
        {
          idNuée,
          f: async (membres) => {
            info.membres = membres;
            await fFinale();
          },
        },
      );

      const fSuivreBds = async (bds: { idBd: string; auteurs: string[] }[]) => {
        info.bds = bds;
        await fFinale();
      };

      const fListe = async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (éléments: string[]) => Promise<void>;
      }): Promise<schémaRetourFonctionRechercheParProfondeur> => {
        return await this.client.réseau.suivreBdsDeNuée({
          idNuée,
          f: fSuivreRacine,
          nRésultatsDésirés,
        });
      };

      const fBranche = async ({
        id: idBd,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: schémaFonctionSuivi<{
          idBd: string;
          auteurs: string[];
        }>;
      }): Promise<schémaFonctionOublier> => {
        const fFinaleSuivreBranche = async (
          auteurs: infoAuteur[],
        ): Promise<void> => {
          return await fSuivreBranche({
            idBd,
            auteurs: auteurs
              .filter((x) => x.accepté) // Uniquement considérer les auteurs qui ont accepté l'invitation.
              .map((x) => x.idCompte),
          });
        };
        return await this.client.réseau.suivreAuteursBd({
          idBd,
          f: fFinaleSuivreBranche,
        });
      };

      const { fOublier: fOublierBds, fChangerProfondeur } =
        await suivreDeFonctionListe({
          fListe,
          f: fSuivreBds,
          fBranche,
        });

      const fOublier = async () => {
        await Promise.allSettled(
          [fOublierBds, fOublierSuivreMembres, fOublierSuivrePhilo].map((f) =>
            f(),
          ),
        );
      };

      return {
        fOublier,
        fChangerProfondeur,
      };
    } else {
      return await this.client.réseau.suivreBdsDeNuée({
        idNuée,
        f,
        nRésultatsDésirés,
      });
    }
  }

  @cacheRechercheParProfondeur
  async suivreBdsCorrespondantes({
    idNuée,
    f,
    nRésultatsDésirés,
    héritage,
    vérifierAutorisation = true,
    toujoursInclureLesMiennes = true,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string[]>;
    nRésultatsDésirés?: number;
    héritage?: ("descendance" | "ascendance")[];
    vérifierAutorisation?: boolean;
    toujoursInclureLesMiennes?: boolean;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    const info: {
      ascendance?: string[];
      descendance?: string[];
      directes?: string[];
    } = {};
    const fsOublier: schémaFonctionOublier[] = [];

    const fFinale = async () => {
      if (!info.directes) return;
      const finaux = [
        ...new Set([
          ...(info.ascendance || []),
          ...(info.descendance || []),
          ...info.directes,
        ]),
      ];
      return await f(finaux);
    };

    if (héritage && héritage.includes("ascendance")) {
      const fOublierAscendance = await this.suivreDeParents({
        idNuée,
        f: async (bds: string[][]) => {
          const finales: string[] = [];
          bds.forEach((l) =>
            l.forEach((bd) => {
              if (!finales.includes(bd)) finales.push(bd);
            }),
          );
          info.ascendance = finales;
          await fFinale();
        },
        fParents: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: schémaFonctionSuivi<string[]>;
        }): Promise<schémaFonctionOublier> => {
          return (
            await this.suivreBdsCorrespondantesDUneNuée({
              idNuée: id,
              f: fSuivreBranche,
              nRésultatsDésirés,
              vérifierAutorisation,
              toujoursInclureLesMiennes,
            })
          ).fOublier;
        },
      });
      fsOublier.push(fOublierAscendance);
    }
    if (héritage && héritage.includes("descendance")) {
      const { fOublier: fOublierDescendance } = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (parents: string[]) => Promise<void>;
        }): Promise<schémaRetourFonctionRechercheParN> => {
          return await this.rechercherNuéesDéscendantes({
            idNuée,
            f: (parents) => fSuivreRacine([idNuée, ...parents].reverse()),
          });
        },
        f: async (bds: string[]) => {
          info.descendance = bds;
          await fFinale();
        },
        fBranche: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: schémaFonctionSuivi<string[]>;
        }): Promise<schémaFonctionOublier> => {
          return (
            await this.suivreBdsCorrespondantesDUneNuée({
              idNuée: id,
              f: fSuivreBranche,
              nRésultatsDésirés,
              vérifierAutorisation,
              toujoursInclureLesMiennes,
            })
          ).fOublier;
        },
      });
      fsOublier.push(fOublierDescendance);
    }

    const { fOublier: fOublierDirectes, fChangerProfondeur } =
      await this.suivreBdsCorrespondantesDUneNuée({
        idNuée,
        f: async (bds) => {
          info.directes = bds;
          await fFinale();
        },
        nRésultatsDésirés,
        vérifierAutorisation,
        toujoursInclureLesMiennes,
      });
    fsOublier.push(fOublierDirectes);

    return {
      fOublier: async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
      },
      fChangerProfondeur,
    };
  }

  @cacheSuivi
  async suivreEmpreinteTêtesBdsNuée({
    idNuée,
    f,
    héritage,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string>;
    héritage?: ("descendance" | "ascendance")[];
  }): Promise<schémaFonctionOublier> {
    return await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (éléments: string[]) => Promise<void>;
      }) => {
        const { fOublier } = await this.suivreBdsCorrespondantes({
          idNuée,
          f: async (bds) => await fSuivreRacine([idNuée, ...bds]),
          héritage,
        });
        return fOublier;
      },
      f: async (empreintes: string[]) => {
        const empreinte = Base64.stringify(md5(empreintes.join(":")));
        return await f(empreinte);
      },
      fBranche: async ({
        id,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: schémaFonctionSuivi<string>;
      }) => {
        return await this.client.suivreEmpreinteTêtesBdRécursive({
          idBd: id,
          f: fSuivreBranche,
        });
      },
    });
  }

  @cacheRechercheParProfondeur
  async suivreDonnéesTableauNuée<T extends élémentBdListeDonnées>({
    idNuée,
    clefTableau,
    f,
    nRésultatsDésirés,
    héritage,
    ignorerErreursFormatBd = true,
    ignorerErreursFormatTableau = false,
    ignorerErreursDonnéesTableau = true,
    licencesPermises = undefined,
    toujoursInclureLesMiennes = true,
    clefsSelonVariables = false,
    vérifierAutorisation = true,
  }: {
    idNuée: string;
    clefTableau: string;
    f: schémaFonctionSuivi<élémentDeMembreAvecValid<T>[]>;
    nRésultatsDésirés?: number;
    héritage?: ("descendance" | "ascendance")[];
    ignorerErreursFormatBd?: boolean;
    ignorerErreursFormatTableau?: boolean;
    ignorerErreursDonnéesTableau?: boolean;
    licencesPermises?: string[];
    toujoursInclureLesMiennes?: boolean;
    clefsSelonVariables?: boolean;
    vérifierAutorisation?: boolean;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    const fFinale = async (
      donnéesTableaux: élémentDeMembreAvecValid<T>[][],
    ) => {
      const éléments = donnéesTableaux.flat();
      await f(éléments);
    };

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (bds: string[]) => Promise<void>;
    }): Promise<schémaRetourFonctionRechercheParProfondeur> => {
      return await this.suivreBdsCorrespondantes({
        idNuée,
        f: async (bds) => {
          return await fSuivreRacine(bds);
        },
        nRésultatsDésirés,
        héritage,
        toujoursInclureLesMiennes,
        vérifierAutorisation,
      });
    };

    const fSuivreBdsConformes = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (bds: string[]) => Promise<void>;
    }): Promise<schémaRetourFonctionRechercheParProfondeur> => {
      const fCondition = async (
        idBd: string,
        fSuivreCondition: schémaFonctionSuivi<boolean>,
      ): Promise<schémaFonctionOublier> => {
        const conformes: { licence: boolean; formatBd: boolean } = {
          licence: false,
          formatBd: true, // Ça doit être vrai par défaut, en attendant de rejoindre la nuée distante
        };
        const fsOublier: schémaFonctionOublier[] = [];

        const fFinaleBdConforme = async () => {
          const conforme = Object.values(conformes).every((x) => x);
          await fSuivreCondition(conforme);
        };

        if (licencesPermises) {
          const fOublierLicence = await this.client.bds.suivreLicenceBd({
            idBd,
            f: async (licence) => {
              conformes.licence = licencesPermises.includes(licence);
              return await fFinaleBdConforme();
            },
          });
          fsOublier.push(fOublierLicence);
        } else {
          conformes.licence = true;
        }

        if (ignorerErreursFormatBd) {
          conformes.formatBd = true;
        } else {
          const fOublierErreursFormatBd = await this.suivreDifférencesNuéeEtBd({
            idBd,
            idNuée,
            f: async (différences) => {
              conformes.formatBd = !différences.length;
              return await fFinaleBdConforme();
            },
          });
          fsOublier.push(fOublierErreursFormatBd);
        }
        await fFinaleBdConforme();

        return async () => {
          await Promise.allSettled(fsOublier.map((f) => f()));
        };
      };
      return await this.client.suivreBdsSelonCondition({
        fListe,
        fCondition,
        f: fSuivreRacine,
      });
    };

    const fBranche = async ({
      id: idBd,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<élémentDeMembreAvecValid<T>[]>;
    }): Promise<schémaFonctionOublier> => {
      const info: {
        auteurs?: infoAuteur[];
        données?: élémentDonnées<T>[];
        erreursÉléments?: erreurValidation[];
        erreursTableau?: différenceTableaux[];
      } = {};

      const fFinaleBranche = async () => {
        const { données, erreursÉléments, auteurs } = info;
        if (données && erreursÉléments && auteurs && auteurs.length) {
          const auteur = auteurs.find((a) => a.accepté)?.idCompte;
          if (!auteur) return;

          const donnéesMembres: élémentDeMembreAvecValid<T>[] = données
            .map((d) => {
              return {
                idCompte: auteur,
                élément: d,
                valid: erreursÉléments.filter((e) => e.id == d.id),
              };
            })
            .filter((d) => ignorerErreursDonnéesTableau || !d.valid.length);
          await fSuivreBranche(donnéesMembres);
        }
      };

      const fSuivreTableau = async ({
        id,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: schémaFonctionSuivi<{
          données?: élémentDonnées<T>[];
          erreurs?: erreurValidation<règleVariable>[];
        }>;
      }): Promise<schémaFonctionOublier> => {
        const infoTableau: {
          données?: élémentDonnées<T>[];
          erreurs?: erreurValidation<règleVariable>[];
        } = {};
        const fsOublier: schémaFonctionOublier[] = [];

        const fFinaleTableau = async () => {
          const { données, erreurs } = infoTableau;
          if (données) {
            await fSuivreBd({ données, erreurs: erreurs || [] });
          }
        };
        const fOublierDonnnées = await this.client.tableaux.suivreDonnées<T>({
          idTableau: id,
          f: async (données) => {
            infoTableau.données = données;
            await fFinaleTableau();
          },
          clefsSelonVariables,
        });
        fsOublier.push(fOublierDonnnées);

        const fOublierErreurs = await this.client.tableaux.suivreValidDonnées({
          idTableau: id,
          f: async (erreurs) => {
            infoTableau.erreurs = erreurs;
            await fFinaleTableau();
          },
        });
        fsOublier.push(fOublierErreurs);

        return async () => {
          await Promise.allSettled(fsOublier.map((f) => f()));
        };
      };

      const fOublierSuivreTableau = await suivreFonctionImbriquée<{
        données?: élémentDonnées<T>[];
        erreurs?: erreurValidation<règleVariable>[];
      }>({
        fRacine: async ({ fSuivreRacine }) => {
          return await this.client.suivreBdSelonCondition({
            fRacine: async (
              fSuivreRacineListe: (id: string) => Promise<void>,
            ) => {
              return await this.client.bds.suivreIdTableauParClef({
                idBd,
                clef: clefTableau,
                f: ignorerNonDéfinis(fSuivreRacineListe),
              });
            },
            fCondition: async (
              idTableau: string,
              fSuivreCondition: schémaFonctionSuivi<boolean>,
            ) => {
              if (ignorerErreursFormatTableau) {
                await fSuivreCondition(true);
                return faisRien;
              } else {
                // Il faut envoyer une condition vraie par défaut au début au cas où la nuée ne serait pas rejoignable
                await fSuivreCondition(true);

                return await this.suivreDifférencesNuéeEtTableau({
                  idNuée,
                  clefTableau,
                  idTableau,
                  f: async (différences) =>
                    await fSuivreCondition(!différences.length),
                  stricte: false,
                });
              }
            },
            f: fSuivreRacine,
          });
        },
        f: async (x) => {
          info.données = x?.données;
          info.erreursÉléments = x?.erreurs;
          await fFinaleBranche();
        },
        fSuivre: fSuivreTableau,
      });

      const fOublierAuteursBd = await this.client.réseau.suivreAuteursBd({
        idBd,
        f: async (auteurs) => {
          info.auteurs = auteurs;
          await fFinaleBranche();
        },
      });

      return async () => {
        await Promise.allSettled([fOublierSuivreTableau, fOublierAuteursBd]);
      };
    };

    return await suivreDeFonctionListe({
      fListe: fSuivreBdsConformes,
      f: fFinale,
      fBranche,
    });
  }

  async suivreDonnéesExportationTableau({
    clefTableau,
    idNuée,
    langues,
    f,
    nRésultatsDésirés,
    héritage,
    vérifierAutorisation = true,
  }: {
    clefTableau: string;
    idNuée: string;
    langues?: string[];
    f: schémaFonctionSuivi<donnéesTableauExportation>;
    nRésultatsDésirés?: number;
    héritage?: ("descendance" | "ascendance")[];
    vérifierAutorisation?: boolean;
  }): Promise<schémaFonctionOublier> {
    const info: {
      nomsTableau?: { [clef: string]: string };
      nomsVariables?: { [idVar: string]: TraducsTexte };
      colonnes?: InfoColAvecCatégorie[];
      données?: élémentDeMembreAvecValid<élémentBdListeDonnées>[];
    } = {};
    const fsOublier: schémaFonctionOublier[] = [];

    const fFinale = async () => {
      const { colonnes, données, nomsTableau, nomsVariables } = info;

      if (données) {
        const fichiersSFIP: Set<string> = new Set();

        let donnéesFormattées: élémentBdListeDonnées[] = await Promise.all(
          données.map(async (d) => {
            const élémentFormatté = await this.client.tableaux.formaterÉlément({
              é: d.élément.données,
              colonnes: colonnes || [],
              fichiersSFIP,
              langues,
            });
            return { ...élémentFormatté, auteur: d.idCompte };
          }),
        );

        donnéesFormattées = donnéesFormattées.map((d) =>
          Object.keys(d).reduce((acc: élémentBdListeDonnées, idCol: string) => {
            if (idCol === "auteur") {
              acc[idCol] = d[idCol];
            } else {
              const idVar = colonnes?.find((c) => c.id === idCol)?.variable;

              const nomVar =
                langues && idVar && nomsVariables?.[idVar]
                  ? traduire(nomsVariables[idVar], langues) || idCol
                  : idCol;
              acc[nomVar] = d[idCol];
            }
            return acc;
          }, {}),
        );

        const idCourtTableau = clefTableau.split("/").pop()!;
        const nomTableau =
          langues && nomsTableau
            ? traduire(nomsTableau, langues) || idCourtTableau
            : idCourtTableau;

        return await f({
          nomTableau,
          données: donnéesFormattées,
          fichiersSFIP,
        });
      }
    };
    if (langues) {
      const fOublierNomsTableaux = await this.suivreNomsTableauNuée({
        idNuée,
        clefTableau,
        f: async (noms) => {
          info.nomsTableau = noms;
          await fFinale();
        },
      });
      fsOublier.push(fOublierNomsTableaux);

      const fOublierNomsVariables = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (éléments: string[]) => Promise<void>;
        }) => this.suivreVariablesNuée({ idNuée, f: fSuivreRacine }),
        f: async (noms: { idVar: string; noms: TraducsTexte }[]) => {
          info.nomsVariables = Object.fromEntries(
            noms.map((n) => [n.idVar, n.noms]),
          );
          await fFinale();
        },
        fBranche: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: schémaFonctionSuivi<{
            idVar: string;
            noms: TraducsTexte;
          }>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.variables.suivreNomsVariable({
            idVariable: id,
            f: async (noms) =>
              await fSuivreBranche({
                idVar: id,
                noms,
              }),
          });
        },
      });
      fsOublier.push(fOublierNomsVariables);
    }

    const fOublierColonnes = await this.suivreColonnesEtCatégoriesTableauNuée({
      idNuée,
      clefTableau,
      f: async (cols) => {
        info.colonnes = cols;
        await fFinale();
      },
    });
    fsOublier.push(fOublierColonnes);

    const { fOublier: fOublierDonnées } = await this.suivreDonnéesTableauNuée({
      idNuée,
      clefTableau,
      nRésultatsDésirés,
      héritage,
      vérifierAutorisation,
      f: async (données) => {
        info.données = données;
        await fFinale();
      },
    });
    fsOublier.push(fOublierDonnées);

    return async () => {
      Promise.allSettled(fsOublier.map((f) => f()));
    };
  }

  async suivreDonnéesExportation({
    idNuée,
    langues,
    f,
    clefTableau,
    nRésultatsDésirés,
    héritage,
    vérifierAutorisation = true,
  }: {
    idNuée: string;
    langues?: string[];
    f: schémaFonctionSuivi<donnéesNuéeExportation>;
    clefTableau?: string;
    nRésultatsDésirés?: number;
    héritage?: ("descendance" | "ascendance")[];
    vérifierAutorisation?: boolean;
  }): Promise<schémaFonctionOublier> {
    const info: {
      nomsNuée?: TraducsTexte;
      données?: donnéesTableauExportation[];
    } = {};
    const fsOublier: schémaFonctionOublier[] = [];

    const fFinale = async () => {
      const { nomsNuée, données } = info;
      if (!données) return;

      const idCourt = idNuée.split("/").pop()!;
      const nomNuée =
        nomsNuée && langues ? traduire(nomsNuée, langues) || idCourt : idCourt;
      await f({
        nomNuée,
        tableaux: données,
      });
    };

    if (clefTableau) {
      const fOublierDonnéesTableau = await this.suivreDonnéesExportationTableau(
        {
          idNuée,
          clefTableau,
          langues,
          nRésultatsDésirés,
          héritage,
          vérifierAutorisation,
          f: async (données) => {
            info.données = [données];
            await fFinale();
          },
        },
      );
      fsOublier.push(fOublierDonnéesTableau);
    } else {
      const fOublierTableaux = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (éléments: infoTableauAvecId[]) => Promise<void>;
        }) => {
          return await this.suivreTableauxNuée({ idNuée, f: fSuivreRacine });
        },
        f: async (données: donnéesTableauExportation[]) => {
          info.données = données;
          await fFinale();
        },
        fBranche: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: schémaFonctionSuivi<donnéesTableauExportation>;
        }): Promise<schémaFonctionOublier> => {
          return await this.suivreDonnéesExportationTableau({
            idNuée,
            clefTableau: id,
            langues,
            nRésultatsDésirés,
            héritage,
            vérifierAutorisation,
            f: async (données) => {
              return await fSuivreBranche(données);
            },
          });
        },
        fIdDeBranche: (x) => x.clef,
      });
      fsOublier.push(fOublierTableaux);
    }

    if (langues) {
      const fOublierNomsNuée = await this.suivreNomsNuée({
        idNuée,
        f: async (noms) => {
          info.nomsNuée = noms;
          await fFinale();
        },
      });
      fsOublier.push(fOublierNomsNuée);
    }

    const fOublier = async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
    return fOublier;
  }

  async exporterDonnéesNuée({
    idNuée,
    langues,
    nomFichier,
    nRésultatsDésirés,
    héritage,
    clefTableau,
    patience = 100,
    vérifierAutorisation = true,
  }: {
    idNuée: string;
    langues?: string[];
    nomFichier?: string;
    nRésultatsDésirés?: number;
    héritage?: ("descendance" | "ascendance")[];
    clefTableau?: string;
    patience?: number;
    vérifierAutorisation?: boolean;
  }): Promise<donnéesBdExportées> {
    const doc = utils.book_new();
    const fichiersSFIP: Set<string> = new Set();

    const données = await uneFois(
      async (
        fSuivi: schémaFonctionSuivi<donnéesNuéeExportation>,
      ): Promise<schémaFonctionOublier> => {
        return await this.suivreDonnéesExportation({
          idNuée,
          langues,
          f: fSuivi,
          clefTableau,
          héritage,
          vérifierAutorisation,
          nRésultatsDésirés,
        });
      },
      attendreStabilité(patience),
    );

    nomFichier = nomFichier || données.nomNuée;

    for (const tableau of données.tableaux) {
      tableau.fichiersSFIP.forEach((x) => fichiersSFIP.add(x));

      /* Créer le tableau */
      const tableauXLSX = utils.json_to_sheet(tableau.données);

      /* Ajouter la feuille au document. XLSX n'accepte pas les noms de colonne > 31 caractères */
      utils.book_append_sheet(
        doc,
        tableauXLSX,
        tableau.nomTableau.slice(0, 30),
      );
    }
    return { doc, fichiersSFIP, nomFichier };
  }

  async exporterNuéeÀFichier({
    idNuée,
    langues,
    nomFichier,
    nRésultatsDésirés,
    héritage,
    patience = 100,
    formatDoc,
    dossier = "",
    inclureDocuments = true,
  }: {
    idNuée: string;
    langues?: string[];
    nomFichier?: string;
    nRésultatsDésirés?: number;
    héritage?: ("descendance" | "ascendance")[];
    patience?: number;
    formatDoc: BookType | "xls";
    dossier?: string;
    inclureDocuments?: boolean;
  }): Promise<string> {
    const donnéesExportées = await this.exporterDonnéesNuée({
      idNuée,
      langues,
      nomFichier,
      nRésultatsDésirés,
      héritage,
      patience,
    });
    return await this.client.bds.documentDonnéesÀFichier({
      données: donnéesExportées,
      formatDoc,
      dossier,
      inclureDocuments,
    });
  }

  async générerDeBd({
    idBd,
    patience = 100,
  }: {
    idBd: string;
    patience?: number;
  }): Promise<string> {
    const idNuée = await this.créerNuée();

    const [noms, descriptions, idsMotsClefs, tableaux] = await Promise.all([
      // Noms
      uneFois(
        async (
          fSuivi: schémaFonctionSuivi<{ [key: string]: string }>,
        ): Promise<schémaFonctionOublier> => {
          return await this.client.bds.suivreNomsBd({ idBd, f: fSuivi });
        },
        attendreStabilité(patience),
      ),
      // Descriptions
      uneFois(
        async (
          fSuivi: schémaFonctionSuivi<{ [key: string]: string }>,
        ): Promise<schémaFonctionOublier> => {
          return await this.client.bds.suivreDescriptionsBd({
            idBd,
            f: fSuivi,
          });
        },
        attendreStabilité(patience),
      ),

      // Mots-clefs
      uneFois(
        async (
          fSuivi: schémaFonctionSuivi<string[]>,
        ): Promise<schémaFonctionOublier> => {
          return await this.client.bds.suivreMotsClefsBd({
            idBd,
            f: fSuivi,
          });
        },
        attendreStabilité(patience),
      ),
      // Tableaux
      uneFois(
        async (
          fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>,
        ): Promise<schémaFonctionOublier> => {
          return await this.client.bds.suivreTableauxBd({ idBd, f: fSuivi });
        },
        attendreStabilité(patience),
      ),
    ]);

    await Promise.allSettled([
      this.sauvegarderNomsNuée({
        idNuée,
        noms,
      }),

      await this.sauvegarderDescriptionsNuée({
        idNuée,
        descriptions,
      }),

      await this.ajouterMotsClefsNuée({
        idNuée,
        idsMotsClefs,
      }),
    ]);

    await Promise.allSettled(
      tableaux.map(async (tableau) => {
        const idTableau = tableau.id;
        const idTableauNuée = await this.ajouterTableauNuée({
          idNuée,
          clefTableau: tableau.clef,
        });

        // Colonnes
        const colonnes = await uneFois(
          async (
            fSuivi: schémaFonctionSuivi<InfoCol[]>,
          ): Promise<schémaFonctionOublier> => {
            return await this.client.tableaux.suivreColonnesTableau({
              idTableau,
              f: fSuivi,
            });
          },
          attendreStabilité(patience),
        );
        for (const col of colonnes) {
          await this.ajouterColonneTableauNuée({
            idTableau: idTableauNuée,
            idVariable: col.variable,
            idColonne: col.id,
            index: col.index,
          });

          // Indexes
          await this.changerColIndexTableauNuée({
            idTableau: idTableauNuée,
            idColonne: col.id,
            val: !!col.index,
          });

          // Règles
          const règles = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<règleColonne<règleVariable>[]>,
            ): Promise<schémaFonctionOublier> => {
              return await this.client.tableaux.suivreRègles({
                idTableau,
                f: fSuivi,
              });
            },
            attendreStabilité(patience),
          );
          for (const règle of règles) {
            if (règle.source.type === "tableau") {
              await this.ajouterRègleTableauNuée({
                idTableau: idTableauNuée,
                idColonne: col.id,
                règle: règle.règle.règle,
              });
            }
          }
        }
      }),
    );

    return idNuée;
  }

  async générerSchémaBdNuée({
    idNuée,
    licence,
    licenceContenu,
    patience = 100,
  }: {
    idNuée: string;
    licence: string;
    licenceContenu?: string;
    patience?: number;
  }): Promise<schémaSpécificationBd> {
    const [idsMotsClefs, tableaux] = await Promise.all([
      uneFois(async (fSuivi: schémaFonctionSuivi<string[]>) => {
        return await this.suivreMotsClefsNuée({
          idNuée,
          f: fSuivi,
        });
      }, attendreStabilité(patience)),
      uneFois(async (fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>) => {
        return await this.suivreTableauxNuée({
          idNuée,
          f: fSuivi,
        });
      }, attendreStabilité(patience)),
    ]);

    const obtRèglesTableau = async (clefTableau: string) => {
      return await uneFois(
        async (fSuivi: schémaFonctionSuivi<règleColonne[]>) => {
          return await this.suivreRèglesTableauNuée({
            idNuée,
            clefTableau,
            f: fSuivi,
          });
        },
        attendreStabilité(patience),
      );
    };
    const générerCols = async (clefTableau: string) => {
      return await uneFois(async (fSuivi: schémaFonctionSuivi<InfoCol[]>) => {
        return await this.suivreColonnesTableauNuée({
          idNuée,
          clefTableau,
          f: fSuivi,
        });
      }, attendreStabilité(patience));
    };

    const schéma: schémaSpécificationBd = {
      licence,
      licenceContenu,
      nuées: [idNuée],
      motsClefs: idsMotsClefs,
      tableaux: await Promise.all(
        tableaux.map(async (t) => {
          const [cols, règles] = await Promise.all([
            générerCols(t.clef),
            obtRèglesTableau(t.clef),
          ]);

          return {
            cols: cols.map((c) => {
              const obligatoire = règles.some(
                (r) => r.colonne === c.id && r.règle.règle.type === "existe",
              );
              return {
                idColonne: c.id,
                idVariable: c.variable,
                index: !!c.index,
                optionnelle: !obligatoire,
              };
            }),
            clef: t.clef,
          };
        }),
      ),
    };

    return schéma;
  }
}
