import { FeedStore, KeyValueStore } from "orbit-db";
import XLSX from "xlsx";
import toBuffer from "it-to-buffer";
import path from "path";

import ClientConstellation, {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  élémentBdListe,
  infoAccès,
  uneFois,
} from "./client";
import { STATUT, infoAuteur } from "./bds";
import { objRôles } from "./accès/types";
import ContrôleurConstellation from "./accès/cntrlConstellation";
import { traduire, zipper } from "./utils";

export interface donnéesProjetExportées {
  docs: { doc: XLSX.WorkBook; nom: string }[];
  fichiersSFIP: Set<{ cid: string; ext: string }>;
  nomFichier: string;
}

export default class Projets {
  client: ClientConstellation;
  idBd: string;

  constructor(client: ClientConstellation, id: string) {
    this.client = client;
    this.idBd = id;
  }

  async suivreProjetsMembre(
    f: schémaFonctionSuivi<string[]>,
    idBdRacine?: string
  ): Promise<schémaFonctionOublier> {
    idBdRacine = idBdRacine || this.idBd;
    return await this.client.suivreBdListe(idBdRacine, f);
  }

  async créerProjet(): Promise<string> {
    const bdRacine = (await this.client.ouvrirBd(this.idBd)) as FeedStore;
    const idBdProjet = await this.client.créerBdIndépendante("kvstore", {
      adresseBd: undefined,
      premierMod: this.client.bdRacine!.id,
    });

    const bdProjet = (await this.client.ouvrirBd(idBdProjet)) as KeyValueStore;

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

    await bdProjet.set("statut", { statut: STATUT.ACTIVE });

    await bdRacine.add(idBdProjet);
    return idBdProjet;
  }

  async copierProjet(id: string): Promise<string> {
    const bdBase = (await this.client.ouvrirBd(id)) as KeyValueStore;
    const idNouveauProjet = await this.créerProjet();
    const nouvelleBd = (await this.client.ouvrirBd(
      idNouveauProjet
    )) as KeyValueStore;

    const idBdNoms = await bdBase.get("noms");
    const bdNoms = (await this.client.ouvrirBd(idBdNoms)) as KeyValueStore;
    const noms = ClientConstellation.obtObjetdeBdDic(bdNoms) as {
      [key: string]: string;
    };
    await this.ajouterNomsProjet(idNouveauProjet, noms);

    const idBdDescr = await bdBase.get("descriptions");
    const bdDescr = (await this.client.ouvrirBd(idBdDescr)) as KeyValueStore;
    const descriptions = ClientConstellation.obtObjetdeBdDic(bdDescr) as {
      [key: string]: string;
    };
    await this.ajouterDescriptionsProjet(idNouveauProjet, descriptions);

    const idBdMotsClefs = await bdBase.get("motsClefs");
    const bdMotsClefs = (await this.client.ouvrirBd(
      idBdMotsClefs
    )) as FeedStore;
    const motsClefs = ClientConstellation.obtÉlémentsDeBdListe(
      bdMotsClefs
    ) as string[];
    await this.ajouterMotsClefsProjet(idNouveauProjet, motsClefs);

    const idBdBds = await bdBase.get("bds");
    const bdBds = (await this.client.ouvrirBd(idBdBds)) as FeedStore;
    const bds = ClientConstellation.obtÉlémentsDeBdListe(bdBds) as string[];
    await Promise.all(
      bds.map(async (idBd: string) => {
        await this.ajouterBdProjet(idNouveauProjet, idBd);
      })
    );

    const statut = (await bdBase.get("statut")) || STATUT.ACTIVE;
    await nouvelleBd.set("statut", { statut });

    return idNouveauProjet;
  }

  async ajouterÀMesProjets(id: string): Promise<void> {
    const bdRacine = (await this.client.ouvrirBd(this.idBd)) as FeedStore;
    await bdRacine.add(id);
  }

  async inviterAuteur(
    idBd: string,
    idBdRacineAuteur: string,
    rôle: keyof objRôles
  ): Promise<void> {
    await this.client.donnerAccès(idBd, idBdRacineAuteur, rôle);
  }

  async suivreAuteurs(
    id: string,
    f: schémaFonctionSuivi<infoAuteur[]>
  ): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: (éléments: infoAccès[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.suivreAccèsBd(id, fSuivreRacine);
    };
    const fBranche = async (
      idBdRacine: string,
      fSuivreBranche: schémaFonctionSuivi<infoAuteur[]>,
      branche?: infoAccès
    ) => {
      const fFinaleSuivreBranche = (projetsMembre?: string[]) => {
        projetsMembre = projetsMembre || [];
        return fSuivreBranche([
          {
            idBdRacine: branche!.idBdRacine,
            rôle: branche!.rôle,
            accepté: projetsMembre.includes(id),
          },
        ]);
      };
      return await this.client.réseau!.suivreProjetsMembre(
        idBdRacine,
        fFinaleSuivreBranche
        //false
      );
    };
    const fIdBdDeBranche = (x: infoAccès) => x.idBdRacine;
    const fCode = (x: infoAccès) => x.idBdRacine;

    const fOublier = this.client.suivreBdsDeFonctionListe(
      fListe,
      f,
      fBranche,
      fIdBdDeBranche,
      undefined,
      fCode
    );
    return fOublier;
  }

  async _obtBdNoms(id: string): Promise<KeyValueStore> {
    const optionsAccès = await this.client.obtOpsAccès(id);
    const idBdNoms = await this.client.obtIdBd(
      "noms",
      id,
      "kvstore",
      optionsAccès
    );
    if (!idBdNoms)
      throw `Permission de modification refusée pour Projet ${id}.`;

    const bdNoms = (await this.client.ouvrirBd(idBdNoms)) as KeyValueStore;
    return bdNoms;
  }

  async ajouterNomsProjet(
    id: string,
    noms: { [key: string]: string }
  ): Promise<void> {
    const bdNoms = await this._obtBdNoms(id);
    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
  }

  async sauvegarderNomProjet(
    id: string,
    langue: string,
    nom: string
  ): Promise<void> {
    const bdNoms = await this._obtBdNoms(id);
    await bdNoms.set(langue, nom);
  }

  async effacerNomProjet(id: string, langue: string): Promise<void> {
    const bdNoms = await this._obtBdNoms(id);
    await bdNoms.del(langue);
  }

  async _obtBdDescr(id: string): Promise<KeyValueStore> {
    const optionsAccès = await this.client.obtOpsAccès(id);
    const idBdDescr = await this.client.obtIdBd(
      "descriptions",
      id,
      "kvstore",
      optionsAccès
    );
    if (!idBdDescr)
      throw `Permission de modification refusée pour Projet ${id}.`;

    const bdDescr = (await this.client.ouvrirBd(idBdDescr)) as KeyValueStore;
    return bdDescr;
  }

  async ajouterDescriptionsProjet(
    id: string,
    descriptions: { [key: string]: string }
  ): Promise<void> {
    const bdDescr = await this._obtBdDescr(id);
    for (const lng in descriptions) {
      await bdDescr.set(lng, descriptions[lng]);
    }
  }

  async sauvegarderDescrProjet(
    id: string,
    langue: string,
    nom: string
  ): Promise<void> {
    const bdDescr = await this._obtBdDescr(id);
    await bdDescr.set(langue, nom);
  }

  async effacerDescrProjet(id: string, langue: string): Promise<void> {
    const bdDescr = await this._obtBdDescr(id);
    await bdDescr.del(langue);
  }

  async _obtBdMotsClefs(id: string): Promise<FeedStore> {
    const optionsAccès = await this.client.obtOpsAccès(id);
    const idBdMotsClefs = await this.client.obtIdBd(
      "motsClefs",
      id,
      "feed",
      optionsAccès
    );
    if (!idBdMotsClefs)
      throw `Permission de modification refusée pour projet ${id}.`;

    const bdMotsClefs = (await this.client.ouvrirBd(
      idBdMotsClefs
    )) as FeedStore;
    return bdMotsClefs;
  }

  async ajouterMotsClefsProjet(
    idProjet: string,
    idsMotsClefs: string | string[]
  ): Promise<void> {
    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];
    const bdMotsClefs = await this._obtBdMotsClefs(idProjet);

    await Promise.all(
      idsMotsClefs.map(async (id: string) => {
        const motsClefsExistants =
          ClientConstellation.obtÉlémentsDeBdListe<string>(bdMotsClefs);
        if (!motsClefsExistants.includes(id)) await bdMotsClefs.add(id);
      })
    );
  }

  async effacerMotClefProjet(
    idProjet: string,
    idMotClef: string
  ): Promise<void> {
    const bdMotsClefs = await this._obtBdMotsClefs(idProjet);

    const entrées = ClientConstellation.obtÉlémentsDeBdListe(
      bdMotsClefs,
      false
    );
    const entrée = entrées.find(
      (e: élémentBdListe) => e.payload.value === idMotClef
    );
    if (entrée) await bdMotsClefs.remove(entrée.hash);
  }

  async _obtBdBds(id: string): Promise<FeedStore> {
    const optionsAccès = await this.client.obtOpsAccès(id);
    const idBdBds = await this.client.obtIdBd("bds", id, "feed", optionsAccès);
    if (!idBdBds) throw `Permission de modification refusée pour Projet ${id}.`;

    const bdBds = (await this.client.ouvrirBd(idBdBds)) as FeedStore;
    return bdBds;
  }

  async ajouterBdProjet(idProjet: string, idBd: string): Promise<void> {
    const bdBds = await this._obtBdBds(idProjet);
    await bdBds.add(idBd);
  }

  async effacerBdProjet(idProjet: string, idBd: string): Promise<void> {
    const bdBds = await this._obtBdBds(idProjet);

    // Effacer l'entrée dans notre liste de bds (n'efface pas la BD elle-même)
    const entrée = bdBds
      .iterator({ limit: -1 })
      .collect()
      .find((e: élémentBdListe<string>) => e.payload.value === idBd);
    await bdBds.remove(entrée.hash);
  }

  async marquerObsolète(id: string, idNouveau?: string): Promise<void> {
    const bd = (await this.client.ouvrirBd(id)) as KeyValueStore;
    bd.set("statut", { statut: STATUT.OBSOLÈTE, idNouveau });
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
    formatDoc: XLSX.BookType | "xls",
    dir = "",
    inclureFichiersSFIP = true
  ): Promise<void> {
    const { docs, fichiersSFIP, nomFichier } = données;

    const conversionsTypes: { [key: string]: XLSX.BookType } = {
      xls: "biff8",
    };
    const bookType: XLSX.BookType = conversionsTypes[formatDoc] || formatDoc;

    const fichiersDocs = docs.map((d) => {
      return {
        nom: `${d.nom}.${formatDoc}`,
        octets: XLSX.write(d.doc, { bookType, type: "buffer" }),
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
    // Dabord effacer l'entrée dans notre liste de projets
    const bdRacine = (await this.client.ouvrirBd(this.idBd)) as FeedStore;
    const entrée = bdRacine
      .iterator({ limit: -1 })
      .collect()
      .find((e: élémentBdListe<string>) => e.payload.value === id);
    await bdRacine.remove(entrée.hash);

    // Et puis maintenant aussi effacer les données et le projet lui-même
    const optionsAccès = await this.client.obtOpsAccès(id);
    for (const clef in ["noms", "descriptions", "motsClefs", "bds"]) {
      const idBd = await this.client.obtIdBd(clef, id, undefined, optionsAccès);
      if (idBd) await this.client.effacerBd(idBd);
    }

    await this.client.effacerBd(id);
  }
}
