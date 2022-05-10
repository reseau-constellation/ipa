import KeyValueStore from "orbit-db-kvstore";
import FeedStore from "orbit-db-feedstore";
import { ImportCandidate } from "ipfs-core-types/src/utils";

import { WorkBook, BookType, write as writeXLSX } from "xlsx";
import toBuffer from "it-to-buffer";
import path from "path";

import ClientConstellation from "@/client";
import { objRôles } from "@/accès/types";
import ContrôleurConstellation from "@/accès/cntrlConstellation";
import {
  traduire,
  zipper,
  TYPES_STATUT,
  schémaStatut,
  schémaFonctionSuivi,
  schémaFonctionOublier,
  uneFois,
} from "@/utils";

export interface donnéesProjetExportées {
  docs: { doc: WorkBook; nom: string }[];
  fichiersSFIP: Set<{ cid: string; ext: string }>;
  nomFichier: string;
}

export type typeÉlémentsBdProjet = string | schémaStatut;

export const MAX_TAILLE_IMAGE = 500 * 1000; // 500 kilooctets
export const MAX_TAILLE_IMAGE_VIS = 1500 * 1000; // 1,5 megaoctets

export default class Projets {
  client: ClientConstellation;
  idBd: string;

  constructor(client: ClientConstellation, id: string) {
    this.client = client;
    this.idBd = id;
  }

  async suivreProjets(
    f: schémaFonctionSuivi<string[]>,
    idBdProjets?: string
  ): Promise<schémaFonctionOublier> {
    idBdProjets = idBdProjets || this.idBd;
    return await this.client.suivreBdListe(idBdProjets, f);
  }

  async créerProjet(): Promise<string> {
    const { bd: bdRacine, fOublier: fOublierRacine } =
      await this.client.ouvrirBd<FeedStore<string>>(this.idBd);
    const idBdProjet = await this.client.créerBdIndépendante("kvstore", {
      adresseBd: undefined,
      premierMod: this.client.bdCompte!.id,
    });

    const { bd: bdProjet, fOublier: fOublierProjet } =
      await this.client.ouvrirBd<KeyValueStore<typeÉlémentsBdProjet>>(
        idBdProjet
      );

    const accès = bdProjet.access as unknown as ContrôleurConstellation;
    const optionsAccès = { adresseBd: accès.adresseBd };

    const idBdNoms = await this.client.créerBdIndépendante(
      "kvstore",
      optionsAccès
    );
    await bdProjet.set("noms", idBdNoms);

    const idBdDescr = await this.client.créerBdIndépendante(
      "kvstore",
      optionsAccès
    );
    await bdProjet.set("descriptions", idBdDescr);

    const idBdBds = await this.client.créerBdIndépendante("feed", optionsAccès);
    await bdProjet.set("bds", idBdBds);

    const idBdMotsClefs = await this.client.créerBdIndépendante(
      "feed",
      optionsAccès
    );
    await bdProjet.set("motsClefs", idBdMotsClefs);

    await bdProjet.set("statut", { statut: TYPES_STATUT.ACTIVE });

    await bdRacine.add(idBdProjet);

    fOublierRacine();
    fOublierProjet();

    return idBdProjet;
  }

  async copierProjet(id: string): Promise<string> {
    const { bd: bdBase, fOublier: fOublierBase } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdProjet>
    >(id);
    const idNouveauProjet = await this.créerProjet();
    const { bd: nouvelleBd, fOublier: fOublierNouvelle } =
      await this.client.ouvrirBd<KeyValueStore<typeÉlémentsBdProjet>>(
        idNouveauProjet
      );

    const idBdNoms = bdBase.get("noms") as string;
    const { bd: bdNoms, fOublier: fOublierNoms } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdNoms);
    const noms = ClientConstellation.obtObjetdeBdDic(bdNoms) as {
      [key: string]: string;
    };
    await this.ajouterNomsProjet(idNouveauProjet, noms);

    const idBdDescr = bdBase.get("descriptions") as string;
    const { bd: bdDescr, fOublier: fOublierDescr } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdDescr);
    const descriptions = ClientConstellation.obtObjetdeBdDic(bdDescr) as {
      [key: string]: string;
    };
    await this.ajouterDescriptionsProjet(idNouveauProjet, descriptions);

    const idBdMotsClefs = bdBase.get("motsClefs") as string;
    const { bd: bdMotsClefs, fOublier: fOublierMotsClefs } =
      await this.client.ouvrirBd<FeedStore<string>>(idBdMotsClefs);
    const motsClefs = ClientConstellation.obtÉlémentsDeBdListe(
      bdMotsClefs
    ) as string[];
    await this.ajouterMotsClefsProjet(idNouveauProjet, motsClefs);

    const idBdBds = bdBase.get("bds") as string;
    const { bd: bdBds, fOublier: fOublierBds } = await this.client.ouvrirBd<
      FeedStore<string>
    >(idBdBds);
    const bds = ClientConstellation.obtÉlémentsDeBdListe(bdBds) as string[];
    await Promise.all(
      bds.map(async (idBd: string) => {
        await this.ajouterBdProjet(idNouveauProjet, idBd);
      })
    );

    const statut = bdBase.get("statut") || { statut: TYPES_STATUT.ACTIVE };
    await nouvelleBd.set("statut", statut);

    const image = bdBase.get("image");
    if (image) await nouvelleBd.set("image", image);

    fOublierBase();
    fOublierNouvelle();
    fOublierNoms();
    fOublierDescr();
    fOublierMotsClefs();
    fOublierBds();

    return idNouveauProjet;
  }

  async ajouterÀMesProjets(id: string): Promise<void> {
    const { bd: bdRacine, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >(this.idBd);
    await bdRacine.add(id);
    fOublier();
  }

  async enleverDeMesProjets(id: string): Promise<void> {
    const { bd: bdRacine, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >(this.idBd);
    await this.client.effacerÉlémentDeBdListe(bdRacine, id);
    fOublier();
  }

  async inviterAuteur(
    idBd: string,
    idBdCompteAuteur: string,
    rôle: keyof objRôles
  ): Promise<void> {
    await this.client.donnerAccès(idBd, idBdCompteAuteur, rôle);
  }

  async _obtBdNoms(
    id: string
  ): Promise<{ bd: KeyValueStore<string>; fOublier: schémaFonctionOublier }> {
    const optionsAccès = await this.client.obtOpsAccès(id);
    const idBdNoms = await this.client.obtIdBd(
      "noms",
      id,
      "kvstore",
      optionsAccès
    );
    if (!idBdNoms) {
      throw `Permission de modification refusée pour Projet ${id}.`;
    }

    return await this.client.ouvrirBd<KeyValueStore<string>>(idBdNoms);
  }

  async ajouterNomsProjet(
    id: string,
    noms: { [key: string]: string }
  ): Promise<void> {
    const { bd: bdNoms, fOublier } = await this._obtBdNoms(id);
    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
    fOublier();
  }

  async sauvegarderNomProjet(
    id: string,
    langue: string,
    nom: string
  ): Promise<void> {
    const { bd: bdNoms, fOublier } = await this._obtBdNoms(id);
    await bdNoms.set(langue, nom);
    fOublier();
  }

  async effacerNomProjet(id: string, langue: string): Promise<void> {
    const { bd: bdNoms, fOublier } = await this._obtBdNoms(id);
    await bdNoms.del(langue);
    fOublier();
  }

  async _obtBdDescr(
    id: string
  ): Promise<{ bd: KeyValueStore<string>; fOublier: schémaFonctionOublier }> {
    const optionsAccès = await this.client.obtOpsAccès(id);
    const idBdDescr = await this.client.obtIdBd(
      "descriptions",
      id,
      "kvstore",
      optionsAccès
    );
    if (!idBdDescr) {
      throw `Permission de modification refusée pour Projet ${id}.`;
    }

    return await this.client.ouvrirBd<KeyValueStore<string>>(idBdDescr);
  }

  async ajouterDescriptionsProjet(
    id: string,
    descriptions: { [key: string]: string }
  ): Promise<void> {
    const { bd: bdDescr, fOublier } = await this._obtBdDescr(id);
    for (const lng in descriptions) {
      await bdDescr.set(lng, descriptions[lng]);
    }
    fOublier();
  }

  async sauvegarderDescrProjet(
    id: string,
    langue: string,
    nom: string
  ): Promise<void> {
    const { bd: bdDescr, fOublier } = await this._obtBdDescr(id);
    await bdDescr.set(langue, nom);
    fOublier();
  }

  async effacerDescrProjet(id: string, langue: string): Promise<void> {
    const { bd: bdDescr, fOublier } = await this._obtBdDescr(id);
    await bdDescr.del(langue);
    fOublier();
  }

  async _obtBdMotsClefs(
    id: string
  ): Promise<{ bd: FeedStore<string>; fOublier: schémaFonctionOublier }> {
    const optionsAccès = await this.client.obtOpsAccès(id);
    const idBdMotsClefs = await this.client.obtIdBd(
      "motsClefs",
      id,
      "feed",
      optionsAccès
    );
    if (!idBdMotsClefs) {
      throw `Permission de modification refusée pour projet ${id}.`;
    }

    return await this.client.ouvrirBd<FeedStore<string>>(idBdMotsClefs);
  }

  async ajouterMotsClefsProjet(
    idProjet: string,
    idsMotsClefs: string | string[]
  ): Promise<void> {
    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];
    const { bd: bdMotsClefs, fOublier } = await this._obtBdMotsClefs(idProjet);

    await Promise.all(
      idsMotsClefs.map(async (id: string) => {
        const motsClefsExistants =
          ClientConstellation.obtÉlémentsDeBdListe<string>(bdMotsClefs);
        if (!motsClefsExistants.includes(id)) await bdMotsClefs.add(id);
      })
    );
    fOublier();
  }

  async effacerMotClefProjet(
    idProjet: string,
    idMotClef: string
  ): Promise<void> {
    const { bd: bdMotsClefs, fOublier } = await this._obtBdMotsClefs(idProjet);
    await this.client.effacerÉlémentDeBdListe(bdMotsClefs, idMotClef);
    fOublier();
  }

  async _obtBdBds(
    id: string
  ): Promise<{ bd: FeedStore<string>; fOublier: schémaFonctionOublier }> {
    const optionsAccès = await this.client.obtOpsAccès(id);
    const idBdBds = await this.client.obtIdBd("bds", id, "feed", optionsAccès);
    if (!idBdBds) throw `Permission de modification refusée pour Projet ${id}.`;

    return await this.client.ouvrirBd<FeedStore<string>>(idBdBds);
  }

  async ajouterBdProjet(idProjet: string, idBd: string): Promise<void> {
    const { bd: bdBds, fOublier } = await this._obtBdBds(idProjet);
    await bdBds.add(idBd);
    fOublier();
  }

  async effacerBdProjet(idProjet: string, idBd: string): Promise<void> {
    const { bd: bdBds, fOublier } = await this._obtBdBds(idProjet);

    // Effacer l'entrée dans notre liste de bds (n'efface pas la BD elle-même)
    await this.client.effacerÉlémentDeBdListe(bdBds, idBd);
    fOublier();
  }

  async marquerObsolète(id: string, idNouvelle?: string): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdProjet>
    >(id);
    bd.set("statut", { statut: TYPES_STATUT.OBSOLÈTE, idNouvelle });
    fOublier();
  }

  async marquerActive(id: string): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdProjet>
    >(id);
    bd.set("statut", { statut: TYPES_STATUT.ACTIVE });
    fOublier();
  }

  async marquerBêta(id: string): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdProjet>
    >(id);
    bd.set("statut", { statut: TYPES_STATUT.BÊTA });
    fOublier();
  }

  async marquerInterne(id: string): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdProjet>
    >(id);
    bd.set("statut", { statut: TYPES_STATUT.INTERNE });
    fOublier();
  }

  async sauvegarderImage(
    idProjet: string,
    image: ImportCandidate
  ): Promise<void> {
    let contenu: ImportCandidate;

    if ((image as File).size !== undefined) {
      if ((image as File).size > MAX_TAILLE_IMAGE) {
        throw new Error("Taille maximale excédée");
      }
      contenu = await (image as File).arrayBuffer();
    } else {
      contenu = image;
    }
    const idImage = await this.client.ajouterÀSFIP(contenu);
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdProjet>
    >(idProjet);
    await bd.set("image", idImage);
    fOublier();
  }

  async effacerImage(
    idProjet: string,
  ): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdProjet>
    >(idProjet);
    await bd.del("image");
    fOublier();
  }

  async suivreImage(
    idProjet: string,
    f: schémaFonctionSuivi<Uint8Array | null>,
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd(
      idProjet,
      async (bd: KeyValueStore<typeÉlémentsBdProjet>) => {
        const idImage = bd.get("image");
        if (!idImage) return f(null);
        const image = await this.client.obtFichierSFIP(
          idImage as string,
          MAX_TAILLE_IMAGE_VIS
        );
        return f(image);
      }
    );
  }

  async suivreNomsProjet(
    id: string,
    f: schémaFonctionSuivi<{ [key: string]: string }>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef<string>(id, "noms", f);
  }

  async suivreDescrProjet(
    id: string,
    f: schémaFonctionSuivi<{ [key: string]: string }>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef<string>(id, "descriptions", f);
  }

  async suivreMotsClefsProjet(
    idProjet: string,
    f: schémaFonctionSuivi<string[]>
  ): Promise<schémaFonctionOublier> {
    const motsClefs: { propres?: string[]; bds?: string[] } = {};
    const fFinale = () => {
      if (motsClefs.propres && motsClefs.bds) {
        const motsClefsFinaux = [
          ...new Set([...motsClefs.propres, ...motsClefs.bds]),
        ];
        f(motsClefsFinaux);
      }
    };

    const fFinalePropres = (mots: string[]) => {
      motsClefs.propres = mots;
      fFinale();
    };
    const fOublierMotsClefsPropres = await this.client.suivreBdListeDeClef(
      idProjet,
      "motsClefs",
      fFinalePropres
    );

    const fFinaleBds = (mots: string[]) => {
      motsClefs.bds = mots;
      fFinale();
    };
    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBdsProjet(idProjet, fSuivreRacine);
    };
    const fBranche = async (
      idBd: string,
      fSuivi: schémaFonctionSuivi<string[]>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.bds!.suivreMotsClefsBd(idBd, fSuivi);
    };
    const fOublierMotsClefsBds = await this.client.suivreBdsDeFonctionListe(
      fListe,
      fFinaleBds,
      fBranche
    );

    return () => {
      fOublierMotsClefsPropres();
      fOublierMotsClefsBds();
    };
  }

  async suivreBdsProjet(
    id: string,
    f: schémaFonctionSuivi<string[]>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdListeDeClef<string>(id, "bds", f);
  }

  async suivreVariablesProjet(
    id: string,
    f: schémaFonctionSuivi<string[]>
  ): Promise<schémaFonctionOublier> {
    const fFinale = (variables?: string[]) => {
      return f(variables || []);
    };
    const fBranche = async (
      idBd: string,
      f: schémaFonctionSuivi<string[]>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.bds!.suivreVariablesBd(idBd, f);
    };
    const fSuivreBds = async (
      idBdBds: string,
      f: schémaFonctionSuivi<string[]>
    ) => {
      return await this.client.suivreBdsDeBdListe(idBdBds, f, fBranche);
    };
    return await this.client.suivreBdDeClef(id, "bds", fFinale, fSuivreBds);
  }

  async suivreQualitéProjet(
    idProjet: string,
    f: schémaFonctionSuivi<number>
  ): Promise<schémaFonctionOublier> {
    const fFinale = (scoresBds: number[]) => {
      f(scoresBds.length? scoresBds.reduce((a, b)=>a+b, 0) / scoresBds.length : 0)
    }
    const fListe = async (fSuiviListe: schémaFonctionSuivi<string[]>): Promise<schémaFonctionOublier> => {
      return await this.suivreBdsProjet(idProjet, fSuiviListe)
    }
    const fBranche = async (
      idBd: string,
      fSuiviBranche: schémaFonctionSuivi<number>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.bds!.suivreScoreBd(
        idBd,
        (score)=>fSuiviBranche(score.total)
      )
    }
    const fRéduction = (scores: number[]) => {
      return scores.flat();
    }
    return await this.client.suivreBdsDeFonctionListe(
      fListe,
      fFinale,
      fBranche,
      undefined,
      fRéduction
    )
  }

  async exporterDonnées(
    id: string,
    langues?: string[],
    nomFichier?: string
  ): Promise<donnéesProjetExportées> {
    if (!nomFichier) {
      const nomsBd = await uneFois(
        (f: schémaFonctionSuivi<{ [key: string]: string }>) =>
          this.suivreNomsProjet(id, f)
      );
      const idCourt = id.split("/").pop()!;

      nomFichier = langues ? traduire(nomsBd, langues) || idCourt : idCourt;
    }
    const données: donnéesProjetExportées = {
      docs: [],
      fichiersSFIP: new Set(),
      nomFichier,
    };
    const idsBds = await uneFois((f: schémaFonctionSuivi<string[]>) =>
      this.suivreBdsProjet(id, f)
    );
    for (const idBd of idsBds) {
      const { doc, fichiersSFIP } = await this.client.bds!.exporterDonnées(
        idBd,
        langues
      );

      let nom: string;
      const idCourtBd = idBd.split("/").pop()!;
      if (langues) {
        const noms = await uneFois(
          (f: schémaFonctionSuivi<{ [key: string]: string }>) =>
            this.client.bds!.suivreNomsBd(idBd, f)
        );

        nom = traduire(noms, langues) || idCourtBd;
      } else {
        nom = idCourtBd;
      }
      données.docs.push({ doc, nom });

      for (const fichier of fichiersSFIP) {
        données.fichiersSFIP.add(fichier);
      }
    }
    return données;
  }

  async exporterDocumentDonnées(
    données: donnéesProjetExportées,
    formatDoc: BookType | "xls",
    dir = "",
    inclureFichiersSFIP = true
  ): Promise<void> {
    const { docs, fichiersSFIP, nomFichier } = données;

    const conversionsTypes: { [key: string]: BookType } = {
      xls: "biff8",
    };
    const bookType: BookType = conversionsTypes[formatDoc] || formatDoc;

    const fichiersDocs = docs.map((d) => {
      return {
        nom: `${d.nom}.${formatDoc}`,
        octets: writeXLSX(d.doc, { bookType, type: "buffer" }),
      };
    });
    const fichiersDeSFIP = [];
    if (inclureFichiersSFIP) {
      for (const fichier of fichiersSFIP) {
        fichiersDeSFIP.push({
          nom: `${fichier.cid}.${fichier.ext}`,
          octets: await toBuffer(this.client.obtItérableAsyncSFIP(fichier.cid)),
        });
      }
    }
    await zipper(fichiersDocs, fichiersDeSFIP, path.join(dir, nomFichier));
  }

  async effacerProjet(id: string): Promise<void> {
    // D'abord effacer l'entrée dans notre liste de projets
    await this.enleverDeMesProjets(id);

    // Et puis maintenant aussi effacer les données et le projet lui-même
    const optionsAccès = await this.client.obtOpsAccès(id);
    for (const clef in ["noms", "descriptions", "motsClefs", "bds"]) {
      const idBd = await this.client.obtIdBd(clef, id, undefined, optionsAccès);
      if (idBd) await this.client.effacerBd(idBd);
    }

    await this.client.effacerBd(id);
  }
}
