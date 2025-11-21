import { JSONSchemaType } from "ajv";
import { TypedNested, typedNested } from "@constl/bohr-db";
import {
  attendreStabilité,
  idcValide,
  ignorerNonDéfinis,
  suivreDeFonctionListe,
  traduire,
  uneFois,
} from "@constl/utils-ipa";
import { toObject } from "@orbitdb/nested-db";
import { v4 as uuidv4 } from "uuid";
import xlsx, { utils as xlsxUtils } from "xlsx";
import { DagCborEncodable } from "@orbitdb/core";
import { cacheSuivi } from "../crabe/cache.js";
import { ServiceDonnéesNébuleuse } from "../crabe/services/services.js";
import { Métadonnées, PartielRécursif, StatutDonnées, TraducsTexte } from "../types.js";
import { Constellation, ServicesConstellation } from "../constellation.js";
import { Oublier, Suivi } from "../crabe/types.js";
import { ServicesLibp2pCrabe } from "../crabe/services/libp2p/libp2p.js";
import {
  BaseÉpingleFavoris,
  DISPOSITIFS_INSTALLÉS,
  DispositifsÉpingle,
  TOUS_DISPOSITIFS,
  résoudreDéfauts,
  ÉpingleFavorisAvecIdBooléennisée,
} from "../favoris.js";
import { schémaStatutDonnées, schémaTraducsTexte } from "../schémas.js";
import {
  DonnéesRangéeTableauAvecId,
  DonnéesTableauExportées,
  StructureTableau,
  schémaTableau,
  Tableaux,
  DifférenceTableaux,
  InfoColonne,
} from "../tableaux.js";
import { mapÀObjet } from "../crabe/utils.js";
import {
  DonnéesFichierBdExportées,
  ajouterProtocoleOrbite,
  extraireEmpreinte,
  sauvegarderDonnéesExportées,
} from "../utils.js";

// Types épingles

export type ÉpingleBd = BaseÉpingleFavoris & {
  type: "bd";
  données: {
    tableaux: DispositifsÉpingle;
    fichiers: DispositifsÉpingle;
  };
};

// Types différences

export type DifférenceBds =
  | DifférenceBDTableauSupplémentaire
  | DifférenceBDTableauManquant
  | DifférenceTableauxBds;

export type DifférenceBDTableauManquant = {
  type: "tableauManquant";
  sévère: true;
  clefManquante: string;
};

export type DifférenceBDTableauSupplémentaire = {
  type: "tableauSupplémentaire";
  sévère: false;
  clefExtra: string;
};

export type DifférenceTableauxBds<
  T extends DifférenceTableaux = DifférenceTableaux,
> = {
  type: "tableau";
  sévère: T["sévère"];
  idTableau: string;
  différence: T;
};

// Types données

export type DonnéesBdExportées = {
  nomBd: string;
  tableaux: DonnéesTableauExportées[];
};

// Types spécification

export type SchémaBd = {
  licence: string;
  licenceContenu?: string;
  métadonnées?: Métadonnées;
  motsClefs?: string[];
  nuées?: string[];
  statut?: StatutDonnées;
  tableaux: {[idTableau: string]: {
    cols: {
      idColonne: string;
      idVariable?: string;
      index?: boolean;
    }[];
  }};
}

// Types structure

export type StructureBd = {
  type: "bd";
  noms: TraducsTexte;
  descriptions: TraducsTexte;
  image: string;
  licence: string;
  licenceContenu: string;
  métadonnées: Métadonnées;
  nuées: { [id: string]: null };
  statut: StatutDonnées;
  tableaux: { [clef: string]: StructureTableau};
  motsClefs: { [id: string]: null };
  copiéeDe: { id: string };
};

export const schémaBd: JSONSchemaType<PartielRécursif<StructureBd>> = {
  type: "object",
  properties: {
    type: { type: "string", nullable: true },
    noms: schémaTraducsTexte,
    descriptions: schémaTraducsTexte,
    image: { type: "string", nullable: true },
    licence: { type: "string", nullable: true },
    licenceContenu: { type: "string", nullable: true },
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
    nuées: {
      type: "object",
      nullable: true,
      additionalProperties: {
        type: "null",
        nullable: true,
      },
    },
    statut: schémaStatutDonnées,
    tableaux: {
      type: "object",
      additionalProperties: schémaTableau,
      nullable: true,
    },
    copiéeDe: {
      type: "object",
      properties: {
        id: { type: "string", nullable: true },
      },
      required: [],
      nullable: true,
    },
  },
};

export type StructureServiceBds = {
  [motClef: string]: null;
};

export const SchémaServiceBds: JSONSchemaType<
  PartielRécursif<StructureServiceBds>
> = {
  type: "object",
  additionalProperties: true,
  required: [],
};

export class Bds<L extends ServicesLibp2pCrabe> extends ServiceDonnéesNébuleuse<
  "bds",
  StructureServiceBds,
  L,
  ServicesConstellation<L>
> {
  tableaux: Tableaux<L>;

  constructor({ nébuleuse }: { nébuleuse: Constellation }) {
    super({
      clef: "bds",
      nébuleuse,
      dépendances: ["compte", "orbite", "hélia"],
      options: {
        schéma: SchémaServiceBds,
      },
    });
    this.tableaux = new Tableaux({
      service: (clef) => this.service(clef),
    });
  }

  // Création et gestion

  @cacheSuivi
  async suivreBds({
    f,
    idCompte,
  }: {
    f: Suivi<string[] | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    return await this.suivreBd({
      idCompte,
      f: (bds) => f(bds ? Object.keys(bds).map(ajouterProtocoleOrbite) : []),
    });
  }

  async créerBd({
    licence,
    licenceContenu,
    épingler = true,
  }: {
    licence: string;
    licenceContenu?: string;
    épingler?: boolean;
  }): Promise<string> {
    const compte = this.service("compte");

    const { bd, oublier: oublierBd } = await compte.créerObjet({
      type: "nested",
    });
    const idBd = bd.address;
    await oublierBd();
    const { bd: bdBd, oublier } = await this.ouvrirBd({ idBd });

    await this.ajouterÀMesBds({ idBd });

    if (épingler) await this.épinglerBd({ idBd });

    await bdBd.put({ type: "bd", licence, statut: { statut: "active" } });
    if (licenceContenu) await bdBd.put({ licenceContenu });

    await oublier();
    return idBd;
  }

  async effacerBd({ idBd }: { idBd: string }): Promise<void> {
    const orbite = this.service("orbite");

    // D'abord effacer l'entrée dans notre liste de BDs
    await this.enleverDeMesBds({ idBd });

    // On court-circuite `this.service("favoris")`
    const favoris = this.nébuleuse.services["favoris"];
    await favoris.désépinglerFavori({ idObjet: idBd });

    // aussi effacer les tableaux
    const tableaux = await uneFois<string[]>((f) =>
      this.suivreTableaux({
        idBd,
        f
      }),
    );

    await Promise.all(
      tableaux.map(
        async (idTableau) =>
          await this.tableaux.effacerTableau({ idStructure: idBd, idTableau }),
      ),
    );

    // enfin, effacer la BD elle-même
    await orbite.effacerBd({ id: idBd });
  }

  async ajouterÀMesBds({ idBd }: { idBd: string }): Promise<void> {
    const bd = await this.bd();
    await bd.put(extraireEmpreinte(idBd), null);
  }

  async enleverDeMesBds({ idBd }: { idBd: string }): Promise<void> {
    const bd = await this.bd();
    await bd.del(extraireEmpreinte(idBd));
  }

  async confirmerPermission({ idBd }: { idBd: string }): Promise<void> {
    const compte = this.service("compte");

    if (!(await compte.permission({ idObjet: idBd })))
      throw new Error(
        `Permission de modification refusée pour la base de données ${idBd}.`,
      );
  }

  async bdÀSchéma({ idBd }: { idBd: string }): Promise<SchémaBd> {
    const licence = await uneFois<string>(f=>this.suivreLicenceBd({idBd, f}))
    const licenceContenu = await uneFois<string>(f=>this.suivreLicenceBd({idBd, f}))

    const métadonnées = await uneFois<Métadonnées>(f=>this.suivreMétadonnées({idBd, f}))
    
    const motsClefs = await uneFois<string[]>(f=>this.suivreMotsClefs({idBd, f}))
    const statut = await uneFois<StatutDonnées | null>(f=>this.suivreStatut({idBd, f}))
    const nuées = await uneFois<string[]>(f=>this.suivreNuées({idBd, f}))

    const idsTableaux = await uneFois<string[]>(f => this.suivreTableaux({ idBd, f }))

    const tableaux: {idTableau: string, tableau: SchémaBd["tableaux"][string]}[] = await Promise.all(idsTableaux.map(async idTableau => {
      const infoCols = await uneFois<InfoColonne[]>(f=>this.tableaux.suivreColonnes({ idStructure: idBd, idTableau, f: ignorerNonDéfinis(f) }))
      const cols = infoCols.map(col => ({ idColonne: col.id, idVariable: col.variable, index: col.index }))
      return {
        idTableau,
        tableau: {
          cols
        }
      }
    }))

    const schéma: SchémaBd = {
      licence,
      licenceContenu,
      métadonnées,
      motsClefs,
      nuées,
      tableaux: Object.fromEntries(tableaux.map(t=>[t.idTableau, t.tableau]))
    }

    if (statut) schéma.statut = statut

    return schéma
  }

  async créerBdDeSchéma({
    schéma,
    épingler = true,
  }: {
    schéma: SchémaBd;
    épingler?: boolean;
  }): Promise<string> {
    const { tableaux, motsClefs, nuées, licence, licenceContenu, statut } =
      schéma;

    const idBd = await this.créerBd({
      licence,
      licenceContenu,
      épingler,
    });

    if (motsClefs) {
      await this.ajouterMotsClefsBd({ idBd, idsMotsClefs: motsClefs });
    }

    if (nuées) {
      await Promise.all(nuées.map(idNuée => this.rejoindreNuée({ idBd, idNuée })));
    }

    if (statut) {
      await this.sauvegarderStatut({ idBd, statut });
    }

    for (const [idTableau, { cols }] of Object.entries(tableaux)) {
      await this.ajouterTableau({ idBd, idTableau });

      for (const c of cols) {
        const { idColonne, idVariable, index } = c;
        await this.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
          idVariable,
          idColonne,
        });
        if (index) {
          await this.tableaux.modifierIndexColonne({
            idStructure: idBd,
            idTableau,
            idColonne,
            index: true,
          });
        }
      }
    }

    return idBd;
  }

  async ouvrirBd({
    idBd,
  }: {
    idBd: string;
  }): Promise<{ bd: TypedNested<StructureBd>; oublier: Oublier }> {
    const { bd, oublier } = await this.service("orbite").ouvrirBd({
      id: idBd,
      type: "nested",
    });
    return {
      bd: typedNested<StructureBd>({ db: bd, schema: schémaBd }),
      oublier,
    };
  }

  async copierBd({
    idBd,
    copierDonnées = true,
  }: {
    idBd: string;
    copierDonnées?: boolean;
  }): Promise<string> {
    const { bd, oublier } = await this.ouvrirBd({ idBd });
    const licence = await bd.get("licence");
    const licenceContenu = await bd.get("licenceContenu");
    if (!licence)
      throw new Error(`Aucune licence trouvée sur la BD source ${idBd}.`);

    const idNouvelleBd = await this.créerBd({
      licence,
      licenceContenu,
    });

    const métadonnées = mapÀObjet(await bd.get("métadonnées"));
    if (métadonnées) {
      await this.sauvegarderMétadonnées({ idBd: idNouvelleBd, métadonnées });
    }

    const noms = mapÀObjet(await bd.get("noms"));
    if (noms) {
      await this.sauvegarderNomsBd({ idBd: idNouvelleBd, noms });
    }

    const descriptions = mapÀObjet(await bd.get("descriptions"));
    if (descriptions) {
      await this.sauvegarderDescriptionsBd({
        idBd: idNouvelleBd,
        descriptions,
      });
    }

    const motsClefs = (await bd.get("motsClefs"));
    if (motsClefs)
      await this.ajouterMotsClefsBd({
        idBd: idNouvelleBd,
        idsMotsClefs: Object.keys(mapÀObjet(motsClefs)!),
      });

    const nuées = Object.keys(mapÀObjet(await bd.get("nuées")) || {}) || [];
    for (const idNuée of nuées) {
      await this.rejoindreNuée({
        idBd: idNouvelleBd,
        idNuée,
      });
    }

    const tableaux = await uneFois<string[]>(f=>this.suivreTableaux({ idBd, f }));
    for (const idTableau of tableaux) {
      await this.tableaux.copierTableau({ idStructure: idBd, idTableau, idStructureDestinataire: idNouvelleBd, copierDonnées });
    }

    const statut = await bd.get("statut");
    if (statut) await this.sauvegarderStatut({ idBd: idNouvelleBd, statut: mapÀObjet(statut)! });

    
    const { bd: nouvelleBd, oublier: oublierNouvelle } = await this.ouvrirBd({
      idBd: idNouvelleBd,
    });

    const image = await bd.get("image");
    if (image) await nouvelleBd.set(`image`, image );

    await nouvelleBd.set("copiéeDe", { id: idBd });

    await Promise.allSettled([
      oublier(),
      oublierNouvelle(),
    ]);
    return idNouvelleBd;
  }

  // Épingles

  async épinglerBd({
    idBd,
    options = {},
  }: {
    idBd: string;
    options?: PartielRécursif<ÉpingleBd>;
  }) {
    // On court-circuite `this.service("favoris")`
    const favoris = this.nébuleuse.services["favoris"];

    const épingle: ÉpingleBd = résoudreDéfauts(options, {
      type: "bd",
      base: TOUS_DISPOSITIFS,
      données: {
        tableaux: TOUS_DISPOSITIFS,
        fichiers: DISPOSITIFS_INSTALLÉS,
      },
    });

    await favoris.épinglerFavori({ idObjet: idBd, épingle });
  }

  async désépinglerBd({ idBd }: { idBd: string }): Promise<void> {
    // On court-circuite `this.service("favoris")`
    const favoris = this.nébuleuse.services["favoris"];

    await favoris.désépinglerFavori({ idObjet: idBd });
  }

  async suivreÉpingleBd({
    idBd,
    f,
    idCompte,
  }: {
    idBd: string;
    f: Suivi<PartielRécursif<ÉpingleBd> | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    // On court-circuite `this.service("favoris")`
    const favoris = this.nébuleuse.services["favoris"];

    return await favoris.suivreÉtatFavori({
      idObjet: idBd,
      f: async (épingle) => {
        if (épingle?.type === "bd")
          await f(épingle as PartielRécursif<ÉpingleBd>);
        else await f(undefined);
      },
      idCompte,
    });
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisAvecIdBooléennisée<ÉpingleBd>;
    f: Suivi<Set<string>>;
  }): Promise<Oublier> {
    const info: {
      base?: (string | undefined)[];
      données?: (string | undefined)[];
      fichiers?: (string | undefined)[];
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
    if (épingle.épingle.base) {
      const fOublierBase = await orbite.suivreBdTypée({
        id: épingle.idObjet,
        type: "nested",
        schéma: schémaBd,
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
      fsOublier.push(fOublierBase);
    }

    // Données des tableaux
    if (épingle.épingle.données?.tableaux) {
      const fOublierTableaux = await this.suivreTableaux({
        idBd: épingle.idObjet,
        f: async (tableaux) => {
          info.données = tableaux?.map((t) => t.id);
          await fFinale();
        },
      });
      fsOublier.push(fOublierTableaux);
    }

    // Fichiers présents dans les données
    if (épingle.épingle.données?.fichiers) {
      const fOublierDonnées = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (éléments: string[]) => Promise<void>;
        }) => {
          return await this.suivreTableaux({
            idBd: épingle.idObjet,
            f: (tbx) => fSuivreRacine(tbx?.map((t) => t.id) || []),
          });
        },
        fBranche: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: Suivi<DonnéesRangéeTableauAvecId[]>;
        }) => {
          return await this.tableaux.suivreDonnées({
            idStructure: épingle.idObjet,
            idTableau: id,
            f: fSuivreBranche,
          });
        },
        f: async (données: DonnéesRangéeTableauAvecId[]) => {
          const idcs = données
            .map((file) =>
              Object.values(file.données).filter((x) => idcValide(x)),
            )
            .flat() as string[];
          info.fichiers = idcs;
          await fFinale();
        },
      });
      fsOublier.push(fOublierDonnées);
    }

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
  }

  // Noms

  async sauvegarderNomsBd({
    idBd,
    noms,
  }: {
    idBd: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });

    await bd.put("noms", noms);
    await oublier();
  }

  async sauvegarderNomBd({
    idBd,
    langue,
    nom,
  }: {
    idBd: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.set(`noms/${langue}`, nom);
    await oublier();
  }

  async effacerNomBd({
    idBd,
    langue,
  }: {
    idBd: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.del(`noms/${langue}`);
    await oublier();
  }

  @cacheSuivi
  async suivreNomsBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<TraducsTexte | undefined>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");

    return await orbite.suivreDonnéesBd({
      id: idBd,
      type: "nested",
      schéma: schémaBd,
      f: (bd) => f(mapÀObjet(bd)?.noms),
    });
  }

  // Descriptions

  async sauvegarderDescriptionsBd({
    idBd,
    descriptions,
  }: {
    idBd: string;
    descriptions: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.put("descriptions", descriptions);
    await oublier();
  }

  async sauvegarderDescriptionBd({
    idBd,
    langue,
    description,
  }: {
    idBd: string;
    langue: string;
    description: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.set(`descriptions/${langue}`, description);
    await oublier();
  }

  async effacerDescriptionBd({
    idBd,
    langue,
  }: {
    idBd: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.del(`descriptions/${langue}`);
    await oublier();
  }

  @cacheSuivi
  async suivreDescriptionsBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<TraducsTexte | undefined>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idBd,
      type: "nested",
      schéma: schémaBd,
      f: async (bd) => {
        await f(mapÀObjet(bd.get("descriptions")));
      },
    });
  }

  // Image

  async sauvegarderImage({
    idBd,
    image,
  }: {
    idBd: string;
    image: { contenu: Uint8Array; nomFichier: string };
  }): Promise<void> {
    const maxTailleImage =
      this.service("compte").options.consts.maxTailleImageSauvegarder;

    if (image.contenu.byteLength > maxTailleImage) {
      throw new Error("Taille maximale excédée");
    }

    const idImage = await this.service("hélia").ajouterFichierÀSFIP(image);

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.set("image", idImage);
    await oublier();
  }

  async effacerImage({ idBd }: { idBd: string }): Promise<void> {
    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.del("image");
    await oublier();
  }

  @cacheSuivi
  async suivreImage({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<{ image: Uint8Array; idImage: string } | null>;
  }): Promise<Oublier> {
    const maxTailleImage =
      this.service("compte").options.consts.maxTailleImageVisualiser;

    return await this.service("orbite").suivreDonnéesBd({
      id: idBd,
      type: "nested",
      schéma: schémaBd,
      f: async (bd) => {
        const idImage = bd.get("image");
        if (!idImage) {
          return await f(null);
        } else {
          const image = await this.service("hélia").obtFichierDeSFIP({
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
    idBd,
    métadonnées,
  }: {
    idBd: string;
    métadonnées: Métadonnées;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });

    await bd.put("métadonnées", métadonnées);
    await oublier();
  }

  async sauvegarderMétadonnée({
    idBd,
    clef,
    valeur,
  }: {
    idBd: string;
    clef: string;
    valeur: DagCborEncodable;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.set(`métadonnées/${clef}`, valeur);
    await oublier();
  }

  async effacerMétadonnée({
    idBd,
    clef,
  }: {
    idBd: string;
    clef: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.del(`métadonnées/${clef}`);
    await oublier();
  }

  @cacheSuivi
  async suivreMétadonnées({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<Métadonnées>;
  }): Promise<Oublier> {
    
    return await this.service("orbite").suivreDonnéesBd({
      id: idBd,
      type: "nested",
      schéma: schémaBd,
      f: async (bd) => {
        await f(mapÀObjet(bd.get("métadonnées")) || {});
      },
    });
  }

  // Statut

  async sauvegarderStatut({
    idBd,
    statut,
  }: {
    idBd: string;
    statut: StatutDonnées;
  }): Promise<void> {
    const { bd, oublier } = await this.ouvrirBd({ idBd });
    bd.set("statut", statut);
    await oublier();
  }

  async suivreStatut({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<StatutDonnées | null>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");
    return await orbite.suivreDonnéesBd({
      id: idBd,
      type: "nested",
      schéma: schémaBd,
      f: (bd) => f(toObject(bd).statut),
    });
  }

  // Licences

  async changerLicenceBd({
    idBd,
    licence,
  }: {
    idBd: string;
    licence: string;
  }): Promise<void> {
    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.set("licence", licence);
    await oublier();
  }

  async changerLicenceContenuBd({
    idBd,
    licenceContenu,
  }: {
    idBd: string;
    licenceContenu?: string;
  }): Promise<void> {
    const { bd, oublier } = await this.ouvrirBd({ idBd });

    if (licenceContenu) {
      await bd.set("licenceContenu", licenceContenu);
    } else {
      await bd.del("licenceContenu");
    }
    await oublier();
  }

  @cacheSuivi
  async suivreLicenceBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idBd,
      type: "nested",
      schéma: schémaBd,
      f: async (bd) => {
        const licence = await bd.get("licence");
        if (licence) await f(licence);
      },
    });
  }

  @cacheSuivi
  async suivreLicenceContenuBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string | undefined>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idBd,
      type: "nested",
      schéma: schémaBd,
      f: async (bd) => {
        const licenceContenu = await bd.get("licenceContenu");
        await f(licenceContenu);
      },
    });
  }

  // Mots-clefs

  async ajouterMotsClefsBd({
    idBd,
    idsMotsClefs,
  }: {
    idBd: string;
    idsMotsClefs: string | string[];
  }): Promise<void> {
    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];

    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });

    for (const id of idsMotsClefs) {
      await bd.put(`motsClefs/${id}`, null);
    }
    await oublier();
  }

  async effacerMotClefBd({
    idBd,
    idMotClef,
  }: {
    idBd: string;
    idMotClef: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });

    await bd.del(`motsClefs/${idMotClef}`);

    await oublier();
  }

  @cacheSuivi
  async suivreMotsClefs({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");

    return await orbite.suivreDonnéesBd({
      id: idBd,
      type: "nested",
      schéma: schémaBd,
      f: (bd) => f(Object.keys(toObject(bd).motsClefs)),
    });
  }

  // Tableaux

  @cacheSuivi
  async suivreTableaux({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idBd,
      type: "nested",
      schéma: schémaBd,
      f: (bd) => f(Object.keys(mapÀObjet(bd)?.tableaux || {})),
    });
  }

  async ajouterTableau({
    idBd,
    idTableau,
  }: {
    idBd: string;
    idTableau?: string;
  }): Promise<string> {
    await this.confirmerPermission({ idBd });

    idTableau = idTableau || uuidv4();
    return await this.tableaux.créerTableau({ idStructure: idBd, idTableau });
  }

  async effacerTableau({
    idBd,
    idTableau,
  }: {
    idBd: string;
    idTableau: string;
  }): Promise<void> {
    // L'interface du tableau s'occupe de tout !
    await this.tableaux.effacerTableau({ idStructure: idBd, idTableau });

  }

  // Variables

  @cacheSuivi
  async suivreVariables({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {

    const fBranche = async ({
      id: idTableau,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: Suivi<string[]>;
    }): Promise<Oublier> => {
      return await this.tableaux.suivreVariables({
        idStructure: idBd,
        idTableau,
        f: fSuivreBranche,
      });
    };

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<Oublier> => {
      return await this.suivreTableaux({
        idBd,
        f: fSuivreRacine,
      });
    };

    return await suivreDeFonctionListe({
      fListe,
      f: async (variables: string[]) => await f(variables || []),
      fBranche,
    });
  }

  // Nuées

  async rejoindreNuée({
    idBd,
    idNuée,
  }: {
    idBd: string;
    idNuée: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const {bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.put(`nuées/${idNuée}`, null);
    
    await oublier();
  }

  async quitterNuée({
    idBd,
    idNuée,
  }: {
    idBd: string;
    idNuée: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const {bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.del(`nuées/${idNuée}`);
    
    await oublier();
  }

  @cacheSuivi
  async suivreNuées({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");

    return await orbite.suivreDonnéesBd({
      id: idBd,
      type: "nested",
      schéma: schémaBd,
      f: (bd) => f(Object.keys(toObject(bd).nuées)),
    });
  }

  // Comparaisons

  @cacheSuivi
  async suivreDifférencesAvecBd({
    idBd,
    idBdRéf,
    f,
  }: {
    idBd: string;
    idBdRéf: string;
    f: Suivi<DifférenceBds[]>;
  }): Promise<Oublier> {
    const différences: {
      tableauxManquants?: string[];
      tableauxSupplémentaires?: string[]
    } = { };

    const fFinale = async (différencesTableaux: {id: string, différence: DifférenceTableaux}[]) => {
      const différencesTableauxManquants: DifférenceBDTableauManquant[] = (différences.tableauxManquants || []).map(t=>({
        type: "tableauManquant",
        sévère: true,
        clefManquante: t
      }))

      const différencesTableauxSupplémentaires: DifférenceBDTableauSupplémentaire[] = (différences.tableauxSupplémentaires || []).map(t=>({
        type: "tableauSupplémentaire",
        sévère: false,
        clefExtra: t
      }));

      const différencesTableauxBds: DifférenceTableauxBds[] = différencesTableaux.map(({id, différence})=>({
        type: "tableau",
        idTableau: id,
        différence: différence,
        sévère: différence.sévère
      }))
      return await f([...différencesTableauxManquants, ...différencesTableauxSupplémentaires, ...différencesTableauxBds])
    }
    
    return await suivreDeFonctionListe({
      fListe: async ({fSuivreRacine})=>{
        const tableaux: { base?: string[], réf?: string[] } = {};

        const fTableaux = async () => {
          if (!tableaux.base || !tableaux.réf) {
            différences.tableauxManquants = []
            différences.tableauxSupplémentaires = []
            return;
          }
          différences.tableauxManquants = tableaux.réf.filter(t=>!tableaux.base?.includes(t));
          différences.tableauxSupplémentaires = tableaux.base.filter(t=>!tableaux.réf?.includes(t));
          
          const communs = tableaux.réf.filter(t=>tableaux.base?.includes(t));
          return await fSuivreRacine(communs);
        }

        const oublierTableaux = await this.suivreTableaux({ idBd: idBd , f: async (x) => {
          tableaux.base = x;
          await fTableaux();
        }})
        const oublierTableauxRéf = await this.suivreTableaux({ idBd: idBdRéf , f: async (x) => {
          tableaux.réf = x;
          await fTableaux();
        }})
        return async () => {
          await oublierTableaux();
          await oublierTableauxRéf();
        }
      },
      fBranche: async ({id: tableau, fSuivreBranche }) => {
        return await this.tableaux.suivreDifférencesAvecTableau({
          tableau: {
            idStructure: idBd,
            idTableau: tableau
          },
          tableauRéf: {
            idStructure: idBdRéf,
            idTableau: tableau
          },
          f: async (différences) => await fSuivreBranche(différences.map(différence => ({id: tableau, différence})))
        })
      },
      f: fFinale,
    })
  }

  // Combiner

  async combinerBds({
    idBdDestinataire,
    idBdSource,
    patience = 100,
  }: {
    idBdDestinataire: string;
    idBdSource: string;
    patience?: number;
  }): Promise<void> {
    const tableauxSource = await uneFois<string[]>(f=>this.suivreTableaux({ idBd: idBdSource, f}), attendreStabilité(patience));
    const tableauxDestinataire = await uneFois<string[]>(f=>this.suivreTableaux({ idBd: idBdDestinataire, f}), attendreStabilité(patience));
    const communs = tableauxSource.filter(t=>tableauxDestinataire.includes(t));

    await Promise.all(communs.map(async idTableau => {
      await this.tableaux.combinerDonnées({
        de: { idStructure: idBdSource, idTableau },
        à: { idStructure: idBdDestinataire, idTableau},
        patience,
      })
    }))
  }


  // Exportations

  async suivreDonnéesExportation({
    idBd,
    langues,
    f,
  }: {
    idBd: string;
    langues?: string[];
    f: Suivi<DonnéesBdExportées>;
  }): Promise<Oublier> {
    const info: {
      nomsBd?: TraducsTexte;
      données?: DonnéesTableauExportées[];
    } = {};
    const fsOublier: Oublier[] = [];


    const fFinale = async () => {
      const { nomsBd, données } = info;
      if (!données) return;

      const idCourt = idBd.split("/").pop()!;
      const nomBd =
        nomsBd && langues ? traduire(nomsBd, langues) || idCourt : idCourt;
      await f({
        nomBd,
        tableaux: données,
      });
    };

    const fOublierDonnées = await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (éléments: string[]) => Promise<void>;
      }) => {
        return await this.suivreTableaux({
          idBd,
          f: ignorerNonDéfinis(fSuivreRacine),
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
        fSuivreBranche: Suivi<DonnéesTableauExportées>;
      }): Promise<Oublier> => {
        return await this.tableaux.suivreDonnéesExportation({
          idStructure: idBd,
          idTableau: id,
          langues,
          f: async (données) => {
            return await fSuivreBranche(données);
          },
        });
      },
      fIdDeBranche: (x) => x.id,
    });
    fsOublier.push(fOublierDonnées);

    if (langues) {
      const fOublierNomsBd = await this.suivreNomsBd({
        idBd,
        f: async (noms) => {
          info.nomsBd = noms;
          await fFinale();
        },
      });
      fsOublier.push(fOublierNomsBd);
    }

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
  }

  async exporterDonnées({
    idBd,
    langues,
    nomFichier,
    patience = 500,
  }: {
    idBd: string;
    langues?: string[];
    nomFichier?: string;
    patience?: number;
  }): Promise<DonnéesFichierBdExportées> {
    const doc = xlsxUtils.book_new();

    const données = await uneFois(
      async (fSuivi: Suivi<DonnéesBdExportées>): Promise<Oublier> => {
        return await this.suivreDonnéesExportation({
          idBd,
          langues,
          f: fSuivi,
        });
      },
      attendreStabilité(patience),
    );

    nomFichier = nomFichier || données.nomBd;

    const fichiersSFIP = new Set<string>();

    for (const tableau of données.tableaux) {
      tableau.fichiersSFIP.forEach((x) => fichiersSFIP.add(x));

      /* Créer le tableau */
      const tableauXLSX = xlsxUtils.json_to_sheet(tableau.données);

      /* Ajouter la feuille au document. XLSX n'accepte pas les noms de colonne > 31 caractères */
      xlsxUtils.book_append_sheet(
        doc,
        tableauXLSX,
        tableau.nomTableau.slice(0, 30),
      );
    }
    return { doc, fichiersSFIP, nomFichier };
  }

  async exporterÀFichier({
    idBd,
    langues,
    nomFichier,
    patience = 500,
    formatDoc,
    dossier = "",
    inclureDocuments = true,
  }: {
    idBd: string;
    langues?: string[];
    nomFichier?: string;
    patience?: number;
    formatDoc: xlsx.BookType | "xls";
    dossier?: string;
    inclureDocuments?: boolean;
  }): Promise<string> {
    const donnéesExportées = await this.exporterDonnées({
      idBd,
      langues,
      nomFichier,
      patience,
    });

    const hélia = this.service("hélia");
    return await sauvegarderDonnéesExportées({
      données: donnéesExportées,
      formatDoc,
      obtItérableAsyncSFIP: hélia.obtItérableAsyncSFIP.bind(hélia),
      dossier,
      inclureDocuments,
    });
  }
}
