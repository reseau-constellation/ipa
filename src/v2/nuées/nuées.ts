import {
  attendreStabilité,
  faisRien,
  ignorerNonDéfinis,
  suivreDeFonctionListe,
  suivreFonctionImbriquée,
  traduire,
  uneFois,
} from "@constl/utils-ipa";
import { v4 as uuidv4 } from "uuid";
import { utils as xlsxUtils } from "xlsx";
import { TypedEmitter } from "tiny-typed-emitter";
import Base64 from "crypto-js/enc-base64.js";
import md5 from "crypto-js/md5.js";
import { schémaTableau } from "../tableaux.js";
import {
  enleverPréfixesEtOrbite,
  sauvegarderDonnéesExportées,
} from "../utils.js";
import { schémaStatutDonnées, schémaTraducsTexte } from "../schémas.js";
import {
  DISPOSITIFS_INSTALLÉS,
  TOUS_DISPOSITIFS,
  résoudreDéfauts,
} from "../crabe/services/favoris.js";
import { cacheSuivi } from "../crabe/cache.js";
import { RechercheNuées } from "../recherche/nuées.js";
import { mapÀObjet } from "../crabe/utils.js";
import { appelerLorsque } from "../crabe/services/utils.js";
import { ObjetConstellation } from "../objets.js";
import { TableauxNuées } from "./tableaux.js";
import type {
  DonnéesTableauNuéeExportées,
  FiltresDonnées,
} from "./tableaux.js";
import type { DonnéesFichierBdExportées } from "../utils.js";
import type { DonnéesTableauExportées } from "../bds/tableaux.js";
import type {
  InfoRésultatVide,
  RésultatObjectifRecherche,
  RésultatRecherche,
  SuivreObjectifRecherche,
} from "../recherche/types.js";
import type { DagCborEncodable } from "@orbitdb/core";
import type {
  Rôle,
  AccèsUtilisateur,
} from "../crabe/services/compte/accès/types.js";
import type { TypedNested } from "@constl/bohr-db";
import type { Constellation } from "../constellation.js";
import type { ServicesLibp2pCrabe } from "../crabe/services/libp2p/libp2p.js";
import type { Oublier, Suivi } from "../crabe/types.js";
import type {
  DifférenceTableaux,
  InfoColonne,
  StructureTableau,
} from "../tableaux.js";
import type {
  InfoAuteur,
  Métadonnées,
  PartielRécursif,
  StatutDonnées,
  TraducsTexte,
} from "../types.js";
import type {
  BaseÉpingleFavoris,
  ÉpingleFavorisBooléenniséeAvecId,
} from "../crabe/services/favoris.js";
import type {
  DifférenceBDTableauManquant,
  DifférenceBDTableauSupplémentaire,
  DifférenceBds,
  DifférenceTableauxBds,
  DonnéesBdExportées,
  SchémaBd,
  SchémaTableau,
  ÉpingleBd,
} from "../bds/bds.js";
import type { JSONSchemaType } from "ajv";
import type xlsx from "xlsx";

// Types épingles

export type ÉpingleNuée = {
  type: "nuée";
  épingle: ContenuÉpingleNuée;
};

export type ContenuÉpingleNuée = BaseÉpingleFavoris & {
  bds: ÉpingleBd;
};

// Types filtres

export type Héritage = { descendance?: boolean; ascendance?: boolean };

export type FiltresBds = {
  licences?: string[];
  ignorerAutorisation?: boolean | "les miennes";
};

// Types tableaux

export type InfoTableauNuée = {
  id: string;
  source: string;
};

export type ValeurAscendance<T> = {
  val: T;
  source: string;
};

// Types autorisation

export type AutorisationNuée =
  | AutorisationNuéeOuverte
  | AutorisationNuéeParInvitation;

export type AutorisationNuéeOuverte = {
  type: "ouverte";
  bloqués: string[];
};

export type AutorisationNuéeParInvitation = {
  type: "par invitation";
  invités: string[];
};

// Types score

export type ScoreNuée = {
  accès?: number;
  infos?: number;
  couverture?: number;
  total: number;
};

// Types structure

export type StructureAutorisationNuée = {
  type: "ouverte" | "par invitation";
  bloqués: { [id: string]: null };
  invités: { [id: string]: null };
};

export type StructureNuée = {
  type: "nuée";
  noms: TraducsTexte;
  descriptions: TraducsTexte;
  image: string;
  motsClefs: { [id: string]: null };
  métadonnées: Métadonnées;
  statut: StatutDonnées;
  autorisation: StructureAutorisationNuée;
  tableaux: { [clef: string]: StructureTableau };
  parent: string;
  copiéeDe: { id: string };
};

export const schémaNuée: JSONSchemaType<PartielRécursif<StructureNuée>> = {
  type: "object",
  properties: {
    type: { type: "string", nullable: true },
    noms: schémaTraducsTexte,
    descriptions: schémaTraducsTexte,
    image: { type: "string", nullable: true },
    métadonnées: {
      type: "object",
      additionalProperties: true,
      required: [],
      nullable: true,
    },
    motsClefs: {
      type: "object",
      nullable: true,
      additionalProperties: {
        type: "null",
        nullable: true,
      },
    },
    statut: schémaStatutDonnées,
    autorisation: {
      type: "object",
      properties: {
        type: { type: "string", nullable: true },
        bloqués: {
          type: "object",
          nullable: true,
          additionalProperties: {
            type: "null",
            nullable: true,
          },
        },
        invités: {
          type: "object",
          nullable: true,
          additionalProperties: {
            type: "null",
            nullable: true,
          },
        },
      },
      nullable: true,
    },
    tableaux: {
      type: "object",
      additionalProperties: schémaTableau,
      nullable: true,
    },
    parent: { type: "string", nullable: true },
    copiéeDe: {
      type: "object",
      properties: {
        id: { type: "string", nullable: true },
      },
      nullable: true,
    },
  },
};

export class Nuées<L extends ServicesLibp2pCrabe> extends ObjetConstellation<
  "nuées",
  StructureNuée,
  L
> {
  tableaux: TableauxNuées<L>;
  recherche: RechercheNuées<L>;

  schémaObjet = schémaNuée;

  constructor({ nébuleuse }: { nébuleuse: Constellation }) {
    super({
      clef: "nuées",
      nébuleuse,
      dépendances: ["variables", "bds", "compte", "orbite", "hélia"],
    });

    this.tableaux = new TableauxNuées({
      nuées: this,
      service: (clef) => this.service(clef),
    });
    this.recherche = new RechercheNuées({
      nuées: this,
      constl: this.nébuleuse,
      service: (clef) => this.service(clef),
    });

    const favoris = this.service("favoris");
    favoris.inscrireRésolution({
      clef: "nuée",
      résolution: this.suivreRésolutionÉpingle.bind(this),
    });
  }

  @cacheSuivi
  async suivreNuées({
    f,
    idCompte,
  }: {
    f: Suivi<string[] | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    return await this.suivreObjets({ f, idCompte });
  }

  async créerNuée({
    parent,
    autorisation,
    épingler = true,
  }: {
    parent?: string;
    autorisation?: AutorisationNuée["type"];
    épingler?: boolean;
  } = {}): Promise<string> {
    const compte = this.service("compte");

    const { bd, oublier: oublierBd } = await compte.créerObjet({
      type: "nested",
    });
    const idNuée = bd.address;
    await oublierBd();
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });

    await nuée.put({
      type: "nuée",
      autorisation: {
        type: autorisation,
      },
      statut: { statut: "active" },
      parent,
    });

    await this.ajouterÀMesNuées({ idNuée });

    if (épingler) await this.épingler({ idNuée });

    await oublier();

    return this.ajouterProtocole(idNuée);
  }

  async effacerNuée({ idNuée }: { idNuée: string }): Promise<void> {
    const orbite = this.service("orbite");

    // D'abord effacer l'entrée dans notre liste de Nuées
    await this.enleverDeMesNuées({ idNuée });

    // Enlever la nuée de nos favoris
    const favoris = this.service("favoris");
    await favoris.désépinglerFavori({ idObjet: this.àIdOrbite(idNuée) });

    // enfin, effacer la Nuée elle-même
    await orbite.effacerBd({ id: this.àIdOrbite(idNuée) });
  }

  async ajouterÀMesNuées({ idNuée }: { idNuée: string }): Promise<void> {
    await this.ajouterÀMesObjets({ idObjet: idNuée });
  }

  async enleverDeMesNuées({ idNuée }: { idNuée: string }): Promise<void> {
    await this.enleverDeMesObjets({ idObjet: idNuée });
  }

  async créerSchémaDeNuée({
    idNuée,
    licence,
    licenceContenu,
  }: {
    idNuée: string;
    licence: string;
    licenceContenu?: string;
  }): Promise<SchémaBd> {
    const métadonnées = await uneFois<Métadonnées>((f) =>
      this.suivreMétadonnées({ idNuée, f }),
    );

    const motsClefs = await uneFois<string[]>((f) =>
      this.suivreMotsClefs({
        idNuée,
        f: async (x) => await f(x.map((m) => m.val)),
      }),
    );

    const statut = await uneFois<StatutDonnées | null>((f) =>
      this.suivreStatut({ idNuée, f }),
    );

    // On inclut tous les tableaux, indépendament de la source
    const idsTableaux = await uneFois<string[]>((f) =>
      this.suivreTableaux({
        idNuée,
        f: (tblx) => f(tblx.map((t) => t.id)),
        ascendance: false,
      }),
    );

    const tableaux: {
      idTableau: string;
      tableau: SchémaTableau;
    }[] = await Promise.all(
      idsTableaux.map(async (idTableau) => {
        const infoCols = await uneFois<InfoColonne[]>((f) =>
          this.tableaux.suivreColonnes({
            idStructure: idNuée,
            idTableau,
            f: ignorerNonDéfinis(f),
          }),
        );
        const cols = infoCols.map((col) => ({
          idColonne: col.id,
          idVariable: col.variable,
          index: col.index,
        }));
        return {
          idTableau,
          tableau: {
            cols,
          },
        };
      }),
    );

    const schéma: SchémaBd = {
      licence,
      licenceContenu,
      métadonnées,
      motsClefs,
      nuées: [idNuée],
      tableaux: Object.fromEntries(
        tableaux.map((t) => [t.idTableau, t.tableau]),
      ),
    };

    if (statut) schéma.statut = statut;

    return schéma;
  }

  async créerNuéeDeSchéma({
    schéma,
    épingler = true,
  }: {
    schéma: SchémaBd;
    épingler?: boolean;
  }): Promise<string> {
    const { tableaux, motsClefs, métadonnées, statut } = schéma;

    const idNuée = await this.créerNuée({
      épingler,
    });

    if (motsClefs) {
      await this.ajouterMotsClefs({ idNuée, idsMotsClefs: motsClefs });
    }

    if (métadonnées) {
      await this.sauvegarderMétadonnées({ idNuée, métadonnées });
    }

    if (statut) {
      await this.sauvegarderStatut({ idNuée, statut });
    }

    for (const [idTableau, { cols }] of Object.entries(tableaux)) {
      await this.ajouterTableau({ idNuée, idTableau });

      for (const c of cols) {
        const { idColonne, idVariable, index } = c;
        await this.tableaux.ajouterColonne({
          idStructure: idNuée,
          idTableau,
          idVariable,
          idColonne,
        });
        if (index) {
          await this.tableaux.modifierIndexColonne({
            idStructure: idNuée,
            idTableau,
            idColonne,
            index: true,
          });
        }
      }
    }

    return idNuée;
  }

  async ouvrirNuée({
    idNuée,
  }: {
    idNuée: string;
  }): Promise<{ nuée: TypedNested<StructureNuée>; oublier: Oublier }> {
    const { objet: nuée, oublier } = await this.ouvrirObjet({
      idObjet: idNuée,
    });
    return { nuée, oublier };
  }

  async copierNuée({ idNuée }: { idNuée: string }): Promise<string> {
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });

    const parent = await nuée.get("parent");

    const idNouvelleNuée = await this.créerNuée({ parent });

    const métadonnées = mapÀObjet(await nuée.get("métadonnées"));
    if (métadonnées) {
      await this.sauvegarderMétadonnées({
        idNuée: idNouvelleNuée,
        métadonnées,
      });
    }

    const noms = mapÀObjet(await nuée.get("noms"));
    if (noms) {
      await this.sauvegarderNoms({ idNuée: idNouvelleNuée, noms });
    }

    const descriptions = mapÀObjet(await nuée.get("descriptions"));
    if (descriptions) {
      await this.sauvegarderDescriptions({
        idNuée: idNouvelleNuée,
        descriptions,
      });
    }

    const motsClefs = await nuée.get("motsClefs");
    if (motsClefs)
      await this.ajouterMotsClefs({
        idNuée: idNouvelleNuée,
        idsMotsClefs: Object.keys(mapÀObjet(motsClefs)!),
      });

    const tableaux = await uneFois<InfoTableauNuée[]>((f) =>
      this.suivreTableaux({ idNuée, f, ascendance: false }),
    );
    for (const { id: idTableau } of tableaux) {
      await this.tableaux.copierTableau({
        idStructure: idNuée,
        idTableau,
        idStructureDestinataire: idNouvelleNuée,
      });
    }

    const statut = await nuée.get("statut");
    if (statut)
      await this.sauvegarderStatut({
        idNuée: idNouvelleNuée,
        statut: mapÀObjet(statut)!,
      });

    const { nuée: nouvelleNuée, oublier: oublierNouvelle } =
      await this.ouvrirNuée({
        idNuée: idNouvelleNuée,
      });

    const image = await nuée.get("image");
    if (image) await nouvelleNuée.set(`image`, image);

    const autorisations = mapÀObjet(await nuée.get("autorisation"));
    if (autorisations) await nouvelleNuée.put("autorisation", autorisations);

    await nouvelleNuée.set("copiéeDe", { id: idNuée });

    await Promise.allSettled([oublier(), oublierNouvelle()]);
    return idNouvelleNuée;
  }

  @cacheSuivi
  async suivreSource({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<{ id: string } | undefined>;
  }): Promise<Oublier> {
    return await this.suivreObjet({
      idObjet: idNuée,
      f: (nuée) => f(nuée?.copiéeDe),
    });
  }

  // Accès

  async inviterAuteur({
    idNuée,
    idCompte,
    rôle,
  }: {
    idNuée: string;
    idCompte: string;
    rôle: Rôle;
  }): Promise<void> {
    const compte = this.service("compte");

    return await compte.donnerAccèsObjet({
      idObjet: idNuée,
      identité: idCompte,
      rôle,
    });
  }

  async suivreAuteurs({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<InfoAuteur[]>;
  }): Promise<Oublier> {
    const compte = this.service("compte");

    return await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: Suivi<AccèsUtilisateur[]>;
      }) =>
        await compte.suivreAutorisations({
          idObjet: idNuée,
          f: fSuivreRacine,
        }),
      fBranche: async ({
        id: idCompte,
        fSuivreBranche,
        branche,
      }: {
        id: string;
        fSuivreBranche: Suivi<InfoAuteur>;
        branche: AccèsUtilisateur;
      }) => {
        // On doit appeler ça ici pour avancer même si l'autre compte n'est pas disponible.
        await fSuivreBranche({
          idCompte,
          accepté: false,
          rôle: branche.rôle,
        });
        return await this.suivreNuées({
          idCompte,
          f: async (nuéesCompte) => {
            return await fSuivreBranche({
              idCompte,
              accepté: (nuéesCompte || []).includes(idNuée),
              rôle: branche.rôle,
            });
          },
        });
      },
      fIdDeBranche: (x) => x.idCompte,
      f,
    });
  }

  async confirmerPermission({ idNuée }: { idNuée: string }): Promise<void> {
    const compte = this.service("compte");

    if (!(await compte.permission({ idObjet: this.àIdOrbite(idNuée) })))
      throw new Error(
        `Permission de modification refusée pour la nuée ${idNuée}.`,
      );
  }

  // Épingles

  async épingler({
    idNuée,
    options = {},
  }: {
    idNuée: string;
    options?: PartielRécursif<ContenuÉpingleNuée>;
  }) {
    const favoris = this.service("favoris");

    const épingle: ContenuÉpingleNuée = résoudreDéfauts(options, {
      base: TOUS_DISPOSITIFS,
      bds: {
        type: "bd",
        épingle: {
          base: TOUS_DISPOSITIFS,
          données: {
            tableaux: TOUS_DISPOSITIFS,
            fichiers: DISPOSITIFS_INSTALLÉS,
          },
        },
      },
    });
    await favoris.épinglerFavori({
      idObjet: idNuée,
      épingle: { type: "nuée", épingle },
    });
  }

  async désépingler({ idNuée }: { idNuée: string }): Promise<void> {
    const favoris = this.service("favoris");

    await favoris.désépinglerFavori({ idObjet: idNuée });
  }

  async suivreÉpingle({
    idNuée,
    f,
    idCompte,
  }: {
    idNuée: string;
    f: Suivi<ÉpingleNuée | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    const favoris = this.service("favoris");

    return await favoris.suivreFavoris({
      idCompte,
      f: async (épingles) => {
        const épingleNuée = épingles?.find(({ idObjet, épingle }) => {
          return idObjet === idNuée && épingle.type === "nuée"
            ? épingle
            : undefined;
        }) as ÉpingleNuée | undefined;
        await f(épingleNuée);
      },
    });
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisBooléenniséeAvecId<ÉpingleNuée>;
    f: Suivi<Set<string>>;
  }): Promise<Oublier> {
    const info: {
      base?: (string | undefined)[];
      bds?: (string | undefined)[];
    } = {};

    const fFinale = async () => {
      return await f(
        new Set(
          Object.values(info)
            .flat()
            .filter((x) => !!x) as string[],
        ),
      );
    };

    const fsOublier: Oublier[] = [];
    const orbite = this.service("orbite");
    if (épingle.épingle.épingle.base) {
      const oublierBase = await orbite.suivreBdTypée({
        id: épingle.idObjet,
        type: "nested",
        schéma: schémaNuée,
        f: async (bd) => {
          try {
            const image = await bd.get("image");
            info.base = [épingle.idObjet, image];
          } catch {
            return; // Si la structure n'est pas valide.
          }
          await fFinale();
        },
      });
      fsOublier.push(oublierBase);
    }

    // Bds associées
    const { bds: épingleBds } = épingle.épingle.épingle;
    if (épingleBds) {
      const serviceBds = this.service("bds");
      const oublierTableaux = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (éléments: string[]) => Promise<void>;
        }) => {
          return await this.suivreBds({
            idNuée: épingle.idObjet,
            f: (bds) => fSuivreRacine(bds || []),
          });
        },
        fBranche: async ({
          id: idBd,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: Suivi<Set<string>>;
        }) => {
          if (épingleBds.épingle)
            return await serviceBds.suivreRésolutionÉpingle({
              épingle: {
                idObjet: idBd,
                épingle: {
                  type: "bd",
                  épingle: épingleBds.épingle,
                },
              },
              f: fSuivreBranche,
            });
          else return faisRien;
        },
        f: async (bds: string[]) => {
          info.bds = bds;
          await fFinale();
        },
      });
      fsOublier.push(oublierTableaux);
    }

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
  }

  // Noms

  async sauvegarderNoms({
    idNuée,
    noms,
  }: {
    idNuée: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });

    for (const lng in noms) {
      await nuée.set(`noms/${lng}`, noms[lng]);
    }

    await oublier();
  }

  async sauvegarderNom({
    idNuée,
    langue,
    nom,
  }: {
    idNuée: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });

    await nuée.set(`noms/${langue}`, nom);
    await oublier();
  }

  async effacerNom({
    idNuée,
    langue,
  }: {
    idNuée: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });
    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });
    await nuée.del(`noms/${langue}`);

    await oublier();
  }

  @cacheSuivi
  async suivreNoms({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<TraducsTexte>;
  }): Promise<Oublier> {
    const fFinale = async (noms: ValeurAscendance<TraducsTexte>[]) => {
      await f(Object.assign({}, ...noms.map(({ val }) => val)));
    };

    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents: async ({ idNuée: idParent, f: fParent }) =>
        await this.suivreObjet({
          idObjet: idParent,
          f: (nuée) => fParent(nuée?.noms || {}),
        }),
    });
  }

  // Descriptions

  async sauvegarderDescriptions({
    idNuée,
    descriptions,
  }: {
    idNuée: string;
    descriptions: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });
    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });
    for (const lng in descriptions) {
      await nuée.set(`descriptions/${lng}`, descriptions[lng]);
    }
    await oublier();
  }

  async sauvegarderDescription({
    idNuée,
    langue,
    description,
  }: {
    idNuée: string;
    langue: string;
    description: string;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });
    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });
    await nuée.set(`descriptions/${langue}`, description);
    await oublier();
  }

  async effacerDescription({
    idNuée,
    langue,
  }: {
    idNuée: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });
    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });
    await nuée.del(`descriptions/${langue}`);
    await oublier();
  }

  @cacheSuivi
  async suivreDescriptions({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<TraducsTexte>;
  }): Promise<Oublier> {
    const fFinale = async (descriptions: ValeurAscendance<TraducsTexte>[]) => {
      await f(Object.assign({}, ...descriptions.map(({ val }) => val)));
    };

    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents: async ({ idNuée: idParent, f: fParent }) =>
        await this.suivreObjet({
          idObjet: idParent,
          f: (nuée) => fParent(nuée?.descriptions || {}),
        }),
    });
  }

  // Image

  async sauvegarderImage({
    idNuée,
    image,
  }: {
    idNuée: string;
    image: { contenu: Uint8Array; nomFichier: string };
  }): Promise<string> {
    const maxTailleImage =
      this.service("compte").options.consts.maxTailleImageSauvegarder;

    if (image.contenu.byteLength > maxTailleImage) {
      throw new Error("Taille maximale excédée");
    }

    const idImage = await this.service("hélia").ajouterFichierÀSFIP(image);

    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    await nuée.set("image", idImage);
    await oublier();

    return idImage;
  }

  async effacerImage({ idNuée }: { idNuée: string }): Promise<void> {
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    await nuée.del("image");
    await oublier();
  }

  @cacheSuivi
  async suivreImage({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<{ image: Uint8Array; idImage: string } | null>;
  }): Promise<Oublier> {
    const hélia = this.service("hélia");
    const compte = this.service("compte");

    const maxTailleImage = compte.options.consts.maxTailleImageVisualiser;

    return await this.suivreObjet({
      idObjet: idNuée,
      f: async (nuée) => {
        const idImage = nuée.image;
        if (!idImage) {
          return await f(null);
        } else {
          const image = await hélia.obtFichierDeSFIP({
            id: idImage,
            max: maxTailleImage,
          });
          return await f(image ? { image, idImage } : null);
        }
      },
    });
  }

  // Métadonnées

  async sauvegarderMétadonnées({
    idNuée,
    métadonnées,
  }: {
    idNuée: string;
    métadonnées: Métadonnées;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });

    await nuée.put("métadonnées", métadonnées);
    await oublier();
  }

  async sauvegarderMétadonnée({
    idNuée,
    clef,
    valeur,
  }: {
    idNuée: string;
    clef: string;
    valeur: DagCborEncodable;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    await nuée.set(`métadonnées/${clef}`, valeur);
    await oublier();
  }

  async effacerMétadonnée({
    idNuée,
    clef,
  }: {
    idNuée: string;
    clef: string;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    await nuée.del(`métadonnées/${clef}`);
    await oublier();
  }

  @cacheSuivi
  async suivreMétadonnées({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<Métadonnées>;
  }): Promise<Oublier> {
    const fFinale = async (métadonnées: ValeurAscendance<Métadonnées>[]) => {
      await f(Object.assign({}, ...métadonnées.map(({ val }) => val)));
    };

    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents: async ({ idNuée: idParent, f: fParent }) =>
        await this.suivreObjet({
          idObjet: idParent,
          f: (nuée) => fParent(nuée?.métadonnées || {}),
        }),
    });
  }

  // Mots-clefs

  async ajouterMotsClefs({
    idNuée,
    idsMotsClefs,
  }: {
    idNuée: string;
    idsMotsClefs: string | string[];
  }): Promise<void> {
    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];

    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });

    for (const id of idsMotsClefs) {
      await nuée.put(`motsClefs/${id}`, null);
    }
    await oublier();
  }

  async effacerMotClef({
    idNuée,
    idMotClef,
  }: {
    idNuée: string;
    idMotClef: string;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });

    await nuée.del(`motsClefs/${idMotClef}`);

    await oublier();
  }

  @cacheSuivi
  async suivreMotsClefs({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<ValeurAscendance<string>[]>;
  }): Promise<Oublier> {
    const fFinale = async (motsClefs: ValeurAscendance<string[]>[]) => {
      const liste = motsClefs
        .map(({ source, val }) => val.map((v) => ({ source, val: v })))
        .flat();

      const déjàVus = new Set<string>();
      await f(
        liste.filter((motClef) => {
          if (déjàVus.has(motClef.val)) return false;
          déjàVus.add(motClef.val);
          return true;
        }),
      );
    };

    return await this.suivreDeParents({
      idNuée,
      f: fFinale,
      fParents: async ({ idNuée: idParent, f: fParent }) =>
        await this.suivreObjet({
          idObjet: idParent,
          f: (nuée) => fParent(Object.keys(nuée?.motsClefs || {})),
        }),
    });
  }

  // Tableaux

  async ajouterTableau({
    idNuée,
    idTableau,
  }: {
    idNuée: string;
    idTableau?: string;
  }): Promise<string> {
    await this.confirmerPermission({ idNuée });

    idTableau = idTableau || uuidv4();
    return await this.tableaux.créerTableau({ idStructure: idNuée, idTableau });
  }

  async effacerTableau({
    idNuée,
    idTableau,
  }: {
    idNuée: string;
    idTableau: string;
  }): Promise<void> {
    // L'interface du tableau s'occupe de tout !
    await this.tableaux.effacerTableau({ idStructure: idNuée, idTableau });
  }

  @cacheSuivi
  async suivreTableaux({
    idNuée,
    f,
    ascendance = true,
  }: {
    idNuée: string;
    f: Suivi<InfoTableauNuée[]>;
    ascendance?: boolean;
  }): Promise<Oublier> {
    const suivreTableaux = async ({
      idNuée,
      f,
    }: {
      idNuée: string;
      f: Suivi<string[]>;
    }) =>
      await this.suivreObjet({
        idObjet: idNuée,
        f: (nuée) => f(Object.keys(nuée.tableaux) || {}),
      });

    if (ascendance) {
      return await this.suivreDeParents({
        idNuée,
        f: async (nuées) =>
          await f(
            nuées
              .map((n) => n.val.map((t) => ({ id: t, source: n.source })))
              .flat(),
          ),
        fParents: suivreTableaux,
      });
    } else {
      return await suivreTableaux({
        idNuée,
        f: async (tableaux) =>
          await f(tableaux.map((t) => ({ id: t, source: idNuée }))),
      });
    }
  }

  // Variables

  async suivreVariables({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    const fFinale = async (variables?: string[]) => {
      return await f(variables || []);
    };

    const fBranche = async ({
      id,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: Suivi<string[]>;
    }): Promise<Oublier> => {
      return await this.tableaux.suivreVariables({
        idStructure: idNuée,
        idTableau: id,
        f: fSuivreBranche,
      });
    };

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<Oublier> => {
      return await this.suivreTableaux({
        idNuée,
        f: (x) => fSuivreRacine(x.map((x) => x.id)),
      });
    };

    return await suivreDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  // Statut

  async sauvegarderStatut({
    idNuée,
    statut,
  }: {
    idNuée: string;
    statut: StatutDonnées;
  }): Promise<void> {
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    nuée.set("statut", statut);
    await oublier();
  }

  @cacheSuivi
  async suivreStatut({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<StatutDonnées | null>;
  }): Promise<Oublier> {
    return await this.suivreObjet({
      idObjet: idNuée,
      f: (nuée) => f(nuée?.statut || null),
    });
  }

  // Autorisations

  @cacheSuivi
  async suivreAutorisation({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<AutorisationNuée>;
  }): Promise<Oublier> {
    const résoudreAutorisation = (
      autorisation: PartielRécursif<StructureAutorisationNuée>,
      type: AutorisationNuée["type"],
    ): AutorisationNuée => {
      if (type === "ouverte") {
        const autorisationOuverte: AutorisationNuéeOuverte = {
          type: "ouverte",
          bloqués: Object.keys(autorisation.bloqués || []),
        };
        return autorisationOuverte;
      } else {
        const autorisationParInvitation: AutorisationNuéeParInvitation = {
          type: "par invitation",
          invités: Object.keys(autorisation.invités || []),
        };
        return autorisationParInvitation;
      }
    };

    const fFinale = async (autorisations: StructureAutorisationNuée[] = []) => {
      // On choisi le premier type d'autorisation déterminé en remontant l'ascendance ; ouverte par défaut
      const type =
        autorisations.find((a) => a.type !== undefined)?.type || "ouverte";
      const autorisationsÀCombiner = autorisations
        .filter((a) => a.type === type || a.type === undefined)
        .map((a) => résoudreAutorisation(a, type));

      let autorisationFinale: AutorisationNuée;
      if (type === "ouverte") {
        autorisationFinale = {
          type: "ouverte",
          bloqués: [
            ...new Set(
              autorisationsÀCombiner
                .map((a) => (a as AutorisationNuéeOuverte).bloqués || [])
                .flat(),
            ),
          ],
        };
      } else {
        autorisationFinale = {
          type: "par invitation",
          invités: [
            ...new Set(
              autorisationsÀCombiner
                .map((a) => (a as AutorisationNuéeParInvitation).invités || [])
                .flat(),
            ),
          ],
        };
      }

      return await f(autorisationFinale);
    };

    return await this.suivreDeParents({
      idNuée,
      f: async (autorisations) =>
        await fFinale(
          autorisations
            .filter(
              (a): a is ValeurAscendance<StructureAutorisationNuée> => !!a,
            )
            .map((a) => a.val),
        ),
      fParents: async ({
        idNuée: idParent,
        f: fParent,
      }: {
        idNuée: string;
        f: Suivi<StructureAutorisationNuée | undefined>;
      }) =>
        await this.suivreObjet({
          idObjet: idParent,
          f: (nuée) => fParent(nuée?.autorisation),
        }),
    });
  }

  async modifierTypeAutorisation({
    idNuée,
    type,
  }: {
    idNuée: string;
    type: AutorisationNuée["type"];
  }): Promise<void> {
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    await nuée.put(`autorisation/type`, type);
    await oublier();
  }

  async bloquerCompte({
    idNuée,
    idCompte,
  }: {
    idNuée: string;
    idCompte: string;
  }): Promise<void> {
    const compte = this.service("compte");

    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    if ((await nuée.get("autorisation/type")) === "par invitation")
      throw new Error(
        `La nuée ${idNuée} est à accès par invitation. Désinvitéz les comptes avec \`constl.nuées.désinviterCompte({ idNuée, idCompte })\`.`,
      );

    const auteurs = await uneFois<AccèsUtilisateur[]>((f) =>
      compte.suivreAutorisations({
        idObjet: idNuée,
        f,
      }),
    );
    if (auteurs.find((a) => a.idCompte === idCompte))
      throw new Error(
        `Impossible d'exclure un compte qui a des permissions d'édition de la nuée elle-même (nuée ${idNuée}, compte ${idCompte}).`,
      );

    await nuée.put(
      `autorisation/bloqués/${enleverPréfixesEtOrbite(idCompte)}`,
      null,
    );

    await oublier();
  }

  async inviterCompte({
    idNuée,
    idCompte,
  }: {
    idNuée: string;
    idCompte: string;
  }): Promise<void> {
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    if ((await nuée.get("autorisation/type")) === "ouverte")
      throw new Error(
        `La nuée ${idNuée} est d'accès ouvert. Débloquez les comptes avec \`constl.nuées.débloquerCompte({ idNuée, idCompte })\`.`,
      );

    await nuée.put(
      `autorisation/invités/${enleverPréfixesEtOrbite(idCompte)}`,
      null,
    );

    await oublier();
  }

  async débloquerCompte({
    idNuée,
    idCompte,
  }: {
    idNuée: string;
    idCompte: string;
  }): Promise<void> {
    const compte = this.service("compte");

    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    if ((await nuée.get("autorisation/type")) === "par invitation")
      throw new Error(
        `La nuée ${idNuée} est d'accès ouvert. Invitéz les comptes avec \`constl.nuées.inviterCompte({ idNuée, idCompte })\`.`,
      );

    const auteurs = await uneFois<AccèsUtilisateur[]>((f) =>
      compte.suivreAutorisations({
        idObjet: idNuée,
        f,
      }),
    );
    if (auteurs.find((a) => a.idCompte === idCompte))
      throw new Error(
        `Impossible d'exclure un compte qui a des permissions d'édition de la nuée elle-même (nuée ${idNuée}, compte ${idCompte}).`,
      );

    await nuée.del(`autorisation/bloqués/${enleverPréfixesEtOrbite(idCompte)}`);

    await oublier();
  }

  async désinviterCompte({
    idNuée,
    idCompte,
  }: {
    idNuée: string;
    idCompte: string;
  }): Promise<void> {
    const compte = this.service("compte");

    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    if ((await nuée.get("autorisation/type")) === "ouverte")
      throw new Error(
        `La nuée ${idNuée} est à accès par invitation. Bloquez les comptes avec \`constl.nuéesbloquerCompte({ idNuée, idCompte })\`.`,
      );

    const auteurs = await uneFois<AccèsUtilisateur[]>((f) =>
      compte.suivreAutorisations({
        idObjet: idNuée,
        f,
      }),
    );
    if (auteurs.find((a) => a.idCompte === idCompte))
      throw new Error(
        `Impossible d'exclure un compte qui a des permissions d'édition de la nuée elle-même (nuée ${idNuée}, compte ${idCompte}).`,
      );

    await nuée.del(`autorisation/invités/${enleverPréfixesEtOrbite(idCompte)}`);

    await oublier();
  }

  // Comparaisons

  @cacheSuivi
  async suivreDifférencesAvecBd({
    idNuée,
    idBd,
    f,
  }: {
    idNuée: string;
    idBd: string;
    f: Suivi<DifférenceBds[]>;
  }): Promise<Oublier> {
    const bds = this.service("bds");

    const différences: {
      tableauxManquants?: string[];
      tableauxSupplémentaires?: string[];
    } = {};

    const fFinale = async (
      différencesTableaux: { id: string; différence: DifférenceTableaux }[],
    ) => {
      const différencesTableauxManquants: DifférenceBDTableauManquant[] = (
        différences.tableauxManquants || []
      ).map((t) => ({
        type: "tableauManquant",
        sévère: true,
        clefManquante: t,
      }));

      const différencesTableauxSupplémentaires: DifférenceBDTableauSupplémentaire[] =
        (différences.tableauxSupplémentaires || []).map((t) => ({
          type: "tableauSupplémentaire",
          sévère: false,
          clefExtra: t,
        }));

      const différencesTableauxBdEtNuée: DifférenceTableauxBds[] =
        différencesTableaux.map(({ id, différence }) => ({
          type: "tableau",
          idTableau: id,
          différence: différence,
          sévère: différence.sévère,
        }));

      return await f([
        ...différencesTableauxManquants,
        ...différencesTableauxSupplémentaires,
        ...différencesTableauxBdEtNuée,
      ]);
    };

    return await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }) => {
        const tableaux: { bd?: string[]; nuée?: string[] } = {};

        const fTableaux = async () => {
          if (!tableaux.bd || !tableaux.nuée) {
            différences.tableauxManquants = [];
            différences.tableauxSupplémentaires = [];
            return;
          }
          différences.tableauxManquants = tableaux.nuée.filter(
            (t) => !tableaux.bd?.includes(t),
          );
          différences.tableauxSupplémentaires = tableaux.bd.filter(
            (t) => !tableaux.nuée?.includes(t),
          );

          const communs = tableaux.nuée.filter((t) => tableaux.bd?.includes(t));
          return await fSuivreRacine(communs);
        };

        const oublierTableauxNuée = await this.suivreTableaux({
          idNuée,
          f: async (tblx) => {
            tableaux.nuée = tblx.map((t) => t.id);
            await fTableaux();
          },
        });
        const oublierTableauxBd = await bds.suivreTableaux({
          idBd,
          f: async (tblx) => {
            tableaux.bd = tblx;
            await fTableaux();
          },
        });
        return async () => {
          await oublierTableauxNuée();
          await oublierTableauxBd();
        };
      },
      fBranche: async ({ id: tableau, fSuivreBranche }) => {
        return await this.tableaux.suivreDifférencesAvecTableau({
          tableau: {
            idStructure: idBd,
            idTableau: tableau,
          },
          tableauRéf: {
            idStructure: idNuée,
            idTableau: tableau,
          },
          f: async (différences) =>
            await fSuivreBranche(
              différences.map((différence) => ({ id: tableau, différence })),
            ),
        });
      },
      f: fFinale,
    });
  }

  // Ascendance

  async préciserParent({
    idNuée,
    idNuéeParent,
  }: {
    idNuée: string;
    idNuéeParent: string;
  }): Promise<void> {
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    nuée.set("parent", idNuéeParent);
    await oublier();
  }

  async enleverParent({ idNuée }: { idNuée: string }): Promise<void> {
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    nuée.del("parent");
    await oublier();
  }

  @cacheSuivi
  async suivreAscendants({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    const suivreParent = async ({
      idNuée,
      f,
    }: {
      idNuée: string;
      f: Suivi<string | undefined>;
    }): Promise<Oublier> => {
      return await this.suivreObjet({
        idObjet: idNuée,
        f: (nuée) => f(nuée?.parent),
      });
    };

    const suivreAscendants = async ({
      idNuée,
      f,
      ascendance = [],
    }: {
      idNuée: string;
      f: Suivi<string[]>;
      ascendance?: string[];
    }): Promise<Oublier> => {
      return suivreFonctionImbriquée({
        fRacine: async ({ fSuivreRacine }) =>
          await suivreParent({
            idNuée,
            f: async (parent) => {
              // Briser circulairités éventuelles
              return parent && ascendance.includes(parent)
                ? await fSuivreRacine(undefined)
                : fSuivreRacine(parent);
            },
          }),
        fSuivre: async ({ id: idParent, fSuivre }) => {
          return await suivreAscendants({
            idNuée: idParent,
            f: fSuivre,
            ascendance: [...ascendance, idParent],
          });
        },
        f: async (parents?: string[]) => await f(parents || []),
      });
    };

    return await suivreAscendants({ idNuée, f });
  }

  async suivreDeParents<T>({
    idNuée,
    f,
    fParents,
  }: {
    idNuée: string;
    f: Suivi<ValeurAscendance<T>[]>;
    fParents: (args: { idNuée: string; f: Suivi<T> }) => Promise<Oublier>;
  }): Promise<Oublier> {
    return await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }: { fSuivreRacine: Suivi<string[]> }) =>
        await this.suivreAscendants({
          idNuée,
          f: (ascendants) => fSuivreRacine([idNuée, ...ascendants]),
        }),
      fBranche: async ({
        id,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: Suivi<ValeurAscendance<T>>;
      }) => {
        return await fParents({
          idNuée: id,
          f: (val) => fSuivreBranche({ source: id, val }),
        });
      },
      f,
    });
  }

  @cacheSuivi
  async suivreDescendants({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    const résultatPositif: RésultatObjectifRecherche<InfoRésultatVide> = {
      type: "résultat",
      score: 1,
      de: "*",
      info: {
        type: "vide",
      },
    };

    const fObjectif: SuivreObjectifRecherche = async ({ idObjet, f }) => {
      return await this.suivreAscendants({
        idNuée: idObjet,
        f: async (ascendants) => {
          await f(ascendants.includes(idNuée) ? résultatPositif : undefined);
        },
      });
    };

    const fFinale = async (résultats: RésultatRecherche[]) => {
      await f(résultats.map((r) => r.id));
    };

    const { oublier } = await this.recherche.selonObjectif({
      f: fFinale,
      fObjectif,
    });

    return oublier;
  }

  // Bds

  @cacheSuivi
  async suivreBds({
    idNuée,
    f,
    héritage,
    filtres,
  }: {
    idNuée: string;
    f: Suivi<string[]>;
    héritage?: Héritage;
    filtres?: FiltresBds;
  }): Promise<Oublier> {
    const àOublier: Oublier[] = [];
    const bds = this.service("bds");

    const événements = new TypedEmitter<{ parentée: () => void }>();

    const parentéeNuée: { ascendants: string[]; descendants: string[] } = {
      ascendants: [],
      descendants: [],
    };

    const résultatPositif: RésultatObjectifRecherche<InfoRésultatVide> = {
      type: "résultat",
      score: 1,
      de: "*",
      info: {
        type: "vide",
      },
    };

    if (héritage?.ascendance) {
      àOublier.push(
        await this.suivreAscendants({
          idNuée,
          f: (ascendants) => {
            parentéeNuée.ascendants = ascendants;
            événements.emit("parentée");
          },
        }),
      );
    }
    if (héritage?.descendance) {
      àOublier.push(
        await this.suivreDescendants({
          idNuée,
          f: (descendants) => {
            parentéeNuée.descendants = descendants;
            événements.emit("parentée");
          },
        }),
      );
    }

    const fObjectif: SuivreObjectifRecherche = async ({ idObjet: idBd, f }) => {
      const àOublierObjectif: Oublier[] = [];

      let monCompte: string;

      const infoBd: {
        auteurs?: InfoAuteur[];
        autorisée?: boolean;
        licence?: string;
        nuées?: string[];
      } = {};

      const fFinale = async () => {
        const bonneNuée = infoBd.nuées?.some((nuée) =>
          [
            idNuée,
            ...parentéeNuée.ascendants,
            ...parentéeNuée.descendants,
          ].includes(nuée),
        );
        const bonneLicence = filtres?.licences
          ? infoBd.licence && filtres.licences.includes(infoBd.licence)
          : true;

        const ignorerAutorisation =
          filtres?.ignorerAutorisation ?? "les miennes";
        const autoriséeCarLaMienne =
          ignorerAutorisation === "les miennes" &&
          infoBd.auteurs?.find(
            ({ idCompte, accepté }) => accepté && idCompte === monCompte,
          );
        const bienAutorisée =
          ignorerAutorisation === true ? true : infoBd.autorisée;

        await f(
          bonneNuée && bonneLicence && (bienAutorisée || autoriséeCarLaMienne)
            ? résultatPositif
            : undefined,
        );
      };

      // Suivre mon id compte
      const oublierIdCompte = await this.service("compte").suivreIdCompte({
        f: async (idCompte) => {
          monCompte = idCompte;
          await fFinale();
        },
      });

      // Suivre les changements de parentée
      const oublierRéactionParentée = appelerLorsque({
        émetteur: événements,
        événement: "parentée",
        f: fFinale,
      });
      àOublierObjectif.push(oublierRéactionParentée);

      // Accepter toutes les licences par défaut
      if (filtres?.licences) {
        const oublierLicences = await bds.suivreLicence({
          idBd,
          f: async (licence) => {
            infoBd.licence = licence;
            await fFinale();
          },
        });
        àOublierObjectif.push(oublierLicences);
      }

      // Enforcer autorisation par défaut
      if (filtres?.ignorerAutorisation !== true) {
        const oublierAutorisée = await this.suivreAutorisationBd({
          idNuée,
          idBd,
          f: async (autorisée) => {
            infoBd.autorisée = autorisée;
            await fFinale();
          },
        });
        àOublierObjectif.push(oublierAutorisée);
      }

      const oublierNuées = await bds.suivreNuées({
        idBd,
        f: async (nuées) => {
          infoBd.nuées = nuées;
          await fFinale();
        },
      });
      àOublierObjectif.push(oublierNuées);

      return async () => {
        await Promise.all(àOublierObjectif.map((f) => f()));
        await oublierIdCompte();
      };
    };

    const { oublier: oublierRecherche } = await bds.recherche.selonObjectif({
      fObjectif,
      f: async (résultats) => await f(résultats.map((r) => r.id)),
    });

    return async () => {
      await Promise.all(àOublier.map((f) => f()));
      await oublierRecherche();
    };
  }

  // Empreinte

  @cacheSuivi
  async suivreEmpreinteTête({
    idNuée,
    f,
    héritage,
    filtres,
  }: {
    idNuée: string;
    f: Suivi<string>;
    héritage?: Héritage;
    filtres?: FiltresBds;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");
    const bds = this.service("bds");

    const empreintes: { bds?: string[]; variables?: string[]; nuée?: string } =
      {};
    const fFinale = async () => {
      const texte = [
        empreintes.nuée,
        ...(empreintes.bds || []),
        ...(empreintes.variables || []),
      ]
        .toSorted()
        .join("/");
      await f(Base64.stringify(md5(texte)));
    };

    const oublierEmpreinteNuée = await orbite.suivreEmpreinteTêteBd({
      idBd: idNuée,
      f: async (x) => {
        empreintes.nuée = x;
        await fFinale();
      },
    });

    const oublierEmpreintesBds = await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }) =>
        await this.suivreBds({ idNuée, f: fSuivreRacine, héritage, filtres }),
      fBranche: async ({
        id: idBd,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: Suivi<string>;
      }) => await bds.suivreEmpreinteTête({ idBd, f: fSuivreBranche }),
      f: async (x: string[]) => {
        empreintes.bds = x;
        await fFinale();
      },
    });

    const oublierEmpreinteVariables = await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }) =>
        await this.suivreVariables({ idNuée, f: fSuivreRacine }),
      fBranche: async ({ id: idVariable, fSuivreBranche }) =>
        await orbite.suivreEmpreinteTêteBd({
          idBd: idVariable,
          f: fSuivreBranche,
        }),
      f: async (x: string[]) => {
        empreintes.variables = x;
        await fFinale();
      },
    });

    return async () => {
      await oublierEmpreintesBds();
      await oublierEmpreinteVariables();
      await oublierEmpreinteNuée();
    };
  }

  @cacheSuivi
  async suivreAutorisationBd({
    idNuée,
    idBd,
    f,
  }: {
    idBd: string;
    idNuée: string;
    f: Suivi<boolean | undefined>;
  }): Promise<Oublier> {
    const bds = this.service("bds");

    const info: { autorisation?: AutorisationNuée; auteurs?: InfoAuteur[] } =
      {};

    const fFinale = async () => {
      if (info.autorisation?.type === "ouverte") {
        const { bloqués } = info.autorisation;
        await f(
          !info.auteurs?.some(({ idCompte }) =>
            Object.keys(bloqués).includes(idCompte),
          ),
        );
      } else if (info.autorisation?.type === "par invitation") {
        const { invités } = info.autorisation;
        await f(
          info.auteurs &&
            info.auteurs.some(
              ({ idCompte, accepté }) =>
                accepté && Object.keys(invités).includes(idCompte),
            ),
        );
      } else {
        await f(undefined);
      }
    };

    const oublierAutorisation = await this.suivreAutorisation({
      idNuée,
      f: async (autorisation) => {
        info.autorisation = autorisation;
        await fFinale();
      },
    });

    const oublierAuteurs = await bds.suivreAuteurs({
      idBd,
      f: async (auteurs) => {
        info.auteurs = auteurs;
        await fFinale();
      },
    });

    return async () => {
      await oublierAutorisation();
      await oublierAuteurs();
    };
  }

  // Qualité

  @cacheSuivi
  async suivreScoreAccès({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<number | undefined>;
  }): Promise<Oublier> {
    // À faire
    f(Number.parseInt(idNuée));
    return faisRien;
  }

  @cacheSuivi
  async suivreScoreInfos({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<number | undefined>;
  }): Promise<Oublier> {
    const rés: {
      noms: { [key: string]: string };
      descriptions: { [key: string]: string };
    } = {
      noms: {},
      descriptions: {},
    };
    const fFinale = async () => {
      const scores = [
        Object.keys(rés.noms).length ? 1 : 0,
        Object.keys(rés.descriptions).length ? 1 : 0,
      ];

      const qualité = scores.reduce((a, b) => a + b, 0) / scores.length;
      await f(qualité);
    };
    const oublierNoms = await this.suivreNoms({
      idNuée,
      f: (noms) => {
        rés.noms = noms;
        fFinale();
      },
    });

    const oublierDescr = await this.suivreDescriptions({
      idNuée,
      f: (descriptions) => {
        rés.descriptions = descriptions;
        fFinale();
      },
    });

    const oublier = async () => {
      await oublierNoms();
      await oublierDescr();
    };

    return oublier;
  }

  @cacheSuivi
  async suivreScoreCouverture({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<number | undefined>;
  }): Promise<Oublier> {
    type ScoreCouvertureTableau = { numérateur: number; dénominateur: number };

    const fFinale = async (branches: ScoreCouvertureTableau[]) => {
      const numérateur = branches.reduce(
        (a: number, b: ScoreCouvertureTableau) => a + b.numérateur,
        0,
      );
      const dénominateur = branches.reduce(
        (a: number, b: ScoreCouvertureTableau) => a + b.dénominateur,
        0,
      );
      await f(dénominateur === 0 ? undefined : numérateur / dénominateur);
    };

    const fBranche = async ({
      id,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: Suivi<ScoreCouvertureTableau>;
    }) => {
      return await this.tableaux.suivreScoreCouverture({
        idStructure: idNuée,
        idTableau: id,
        f: fSuivreBranche,
      });
    };

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<Oublier> => {
      return await this.suivreTableaux({
        idNuée,
        f: (tableaux) => fSuivreRacine(tableaux.map((t) => t.id)),
      });
    };

    return await suivreDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  @cacheSuivi
  async suivreScoreQualité({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<ScoreNuée>;
  }): Promise<Oublier> {
    const info: {
      accès?: number;
      couverture?: number;
      infos?: number;
    } = {};

    const fFinale = async () => {
      const { accès, couverture, infos } = info;
      const score: ScoreNuée = {
        total: ((accès || 0) + (couverture || 0) + (infos || 0)) / 3,
        accès,
        couverture,
        infos,
      };
      await f(score);
    };

    const oublierAccès = await this.suivreScoreAccès({
      idNuée,
      f: async (accès) => {
        info.accès = accès;
        await fFinale();
      },
    });

    const oublierCouverture = await this.suivreScoreCouverture({
      idNuée,
      f: async (couverture) => {
        info.couverture = couverture;
        await fFinale();
      },
    });

    const oublierInfos = await this.suivreScoreInfos({
      idNuée,
      f: async (infos) => {
        info.infos = infos;
        await fFinale();
      },
    });

    return async () => {
      await oublierAccès();
      await oublierCouverture();
      await oublierInfos();
    };
  }

  // Exportation

  async suivreDonnéesExportation({
    idNuée,
    langues,
    f,
    héritage,
    filtresBds,
    filtresDonnées,
    idsTableaux,
  }: {
    idNuée: string;
    langues?: string[];
    f: Suivi<DonnéesBdExportées>;
    héritage?: Héritage;
    filtresBds?: FiltresBds;
    filtresDonnées?: FiltresDonnées;
    idsTableaux?: string[];
  }): Promise<Oublier> {
    const info: {
      nomsNuée?: TraducsTexte;
      données?: DonnéesTableauExportées[];
    } = {};
    const fsOublier: Oublier[] = [];

    const fFinale = async () => {
      const { nomsNuée, données } = info;
      if (!données) return;

      const idCourt = idNuée.replace("/orbitdb/", "");
      const nomNuée =
        nomsNuée && langues ? traduire(nomsNuée, langues) || idCourt : idCourt;

      await f({
        nomBd: nomNuée,
        tableaux: données,
      });
    };

    const oublierDonnées = await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (éléments: string[]) => Promise<void>;
      }) => {
        if (idsTableaux) {
          await fSuivreRacine(idsTableaux);
          return faisRien;
        }
        return await this.suivreTableaux({
          idNuée,
          f: ignorerNonDéfinis(
            async (tableaux) =>
              await fSuivreRacine(tableaux.map((tbl) => tbl.id)),
          ),
        });
      },

      f: async (données: DonnéesTableauExportées[]) => {
        info.données = données;
        await fFinale();
      },

      fBranche: async ({
        id,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: Suivi<DonnéesTableauNuéeExportées>;
      }): Promise<Oublier> => {
        return await this.tableaux.suivreDonnéesExportation({
          idStructure: idNuée,
          idTableau: id,
          langues,
          f: async (données) => {
            return await fSuivreBranche(données);
          },
          héritage,
          filtresBds,
          filtresDonnées,
        });
      },
    });
    fsOublier.push(oublierDonnées);

    if (langues) {
      const oublierNomsNuée = await this.suivreNoms({
        idNuée,
        f: async (noms) => {
          info.nomsNuée = noms;
          await fFinale();
        },
      });
      fsOublier.push(oublierNomsNuée);
    }

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
  }

  async exporterDonnées({
    idNuée,
    langues,
    nomFichier,
    héritage,
    filtresBds,
    filtresDonnées,
    idsTableaux,
    patience = 500,
  }: {
    idNuée: string;
    langues?: string[];
    nomFichier?: string;
    héritage?: Héritage;
    filtresBds?: FiltresBds;
    filtresDonnées?: FiltresDonnées;
    idsTableaux?: string[];
    patience?: number;
  }): Promise<DonnéesFichierBdExportées> {
    const docu = xlsxUtils.book_new();

    const données = await uneFois(
      async (fSuivi: Suivi<DonnéesBdExportées>): Promise<Oublier> => {
        return await this.suivreDonnéesExportation({
          idNuée,
          langues,
          héritage,
          filtresBds,
          filtresDonnées,
          idsTableaux,
          f: fSuivi,
        });
      },
      attendreStabilité(patience),
    );

    nomFichier = nomFichier || données.nomBd;

    const documentsMédias = new Set<string>();

    for (const tableau of données.tableaux) {
      tableau.documentsMédias.forEach((x) => documentsMédias.add(x));

      /* Créer le tableau */
      const tableauXLSX = xlsxUtils.json_to_sheet(tableau.données);

      /* Ajouter la feuille au document. XLSX n'accepte pas les noms de colonne > 31 caractères */
      xlsxUtils.book_append_sheet(
        docu,
        tableauXLSX,
        tableau.nomTableau.slice(0, 30),
      );
    }
    return { docu, documentsMédias, nomFichier };
  }

  async exporterÀFichier({
    idNuée,
    formatDocu,
    langues,
    nomFichier,
    héritage,
    filtresBds,
    filtresDonnées,
    patience = 500,
    dossier = "",
    inclureDocuments = true,
    dossierMédias,
  }: {
    idNuée: string;
    formatDocu: xlsx.BookType | "xls";
    langues?: string[];
    nomFichier?: string;
    héritage?: Héritage;
    filtresBds?: FiltresBds;
    filtresDonnées?: FiltresDonnées;
    patience?: number;
    dossier?: string;
    inclureDocuments?: boolean;
    dossierMédias?: string;
  }): Promise<string> {
    const donnéesExportées = await this.exporterDonnées({
      idNuée,
      langues,
      nomFichier,
      héritage,
      filtresBds,
      filtresDonnées,
      patience,
    });

    const hélia = this.service("hélia");
    return await sauvegarderDonnéesExportées({
      données: donnéesExportées,
      formatDocu,
      obtItérableAsyncSFIP: hélia.obtItérableAsyncSFIP.bind(hélia),
      dossier,
      inclureDocuments,
      dossierMédias,
    });
  }
}
