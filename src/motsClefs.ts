import FeedStore from "orbit-db-feedstore";
import KeyValueStore from "orbit-db-kvstore";

import { schémaFonctionSuivi, schémaFonctionOublier } from "@/utils";
import { objRôles } from "@/accès/types";

import ClientConstellation from "./client";
import ContrôleurConstellation from "./accès/cntrlConstellation";

type typeÉlémentsBdMotClef = string;

export default class MotsClefs {
  client: ClientConstellation;
  idBd: string;

  constructor(client: ClientConstellation, id: string) {
    this.client = client;
    this.idBd = id;
  }

  async suivreMotsClefs(
    f: schémaFonctionSuivi<string[]>,
    idBdMotsClefs?: string
  ): Promise<schémaFonctionOublier> {
    idBdMotsClefs = idBdMotsClefs || this.idBd;
    return await this.client.suivreBdListe<string>(idBdMotsClefs, f);
  }

  async créerMotClef(): Promise<string> {
    const idBdMotClef = await this.client.créerBdIndépendante("kvstore", {
      adresseBd: undefined,
      premierMod: this.client.bdCompte!.id,
    });

    await this.ajouterÀMesMotsClefs(idBdMotClef);

    const { bd: bdMotClef, fOublier: fOublierMotClef } =
      await this.client.ouvrirBd<KeyValueStore<typeÉlémentsBdMotClef>>(
        idBdMotClef
      );

    const accès = bdMotClef.access as unknown as ContrôleurConstellation;
    const optionsAccès = { adresseBd: accès.adresseBd };

    const idBdNoms = await this.client.créerBdIndépendante(
      "kvstore",
      optionsAccès
    );
    await bdMotClef.set("noms", idBdNoms);

    fOublierMotClef();
    return idBdMotClef;
  }

  async ajouterÀMesMotsClefs(id: string): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<FeedStore<string>>(
      this.idBd
    );
    await bd.add(id);
    fOublier();
  }

  async enleverDeMesMotsClefs(id: string): Promise<void> {
    const { bd: bdRacine, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >(this.idBd);
    await this.client.effacerÉlémentDeBdListe(bdRacine, id);
    fOublier();
  }

  async copierMotClef(id: string): Promise<string> {
    const { bd: bdBase, fOublier: fOublierBase } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(id);

    const idNouveauMotClef = await this.créerMotClef();

    const idBdNoms = bdBase.get("noms");
    const { bd: bdNoms, fOublier: fOublierNoms } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdNoms);
    const noms = ClientConstellation.obtObjetdeBdDic(bdNoms) as {
      [key: string]: string;
    };
    await this.ajouterNomsMotClef(idNouveauMotClef, noms);

    fOublierBase();
    fOublierNoms();
    return idNouveauMotClef;
  }

  async inviterAuteur(
    idMotClef: string,
    idBdCompteAuteur: string,
    rôle: keyof objRôles
  ): Promise<void> {
    await this.client.donnerAccès(idMotClef, idBdCompteAuteur, rôle);
  }

  async ajouterNomsMotClef(
    id: string,
    noms: { [key: string]: string }
  ): Promise<void> {
    const idBdNoms = await this.client.obtIdBd("noms", id, "kvstore");
    if (!idBdNoms) {
      throw `Permission de modification refusée pour mot clef ${id}.`;
    }

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdNoms);
    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
    fOublier();
  }

  async sauvegarderNomMotClef(
    id: string,
    langue: string,
    nom: string
  ): Promise<void> {
    const idBdNoms = await this.client.obtIdBd("noms", id, "kvstore");
    if (!idBdNoms) {
      throw `Permission de modification refusée pour mot clef ${id}.`;
    }

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdNoms);
    await bdNoms.set(langue, nom);
    fOublier();
  }

  async effacerNomMotClef(id: string, langue: string): Promise<void> {
    const idBdNoms = await this.client.obtIdBd("noms", id, "kvstore");
    if (!idBdNoms) {
      throw `Permission de modification refusée pour mot clef ${id}.`;
    }

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >(idBdNoms);
    await bdNoms.del(langue);
    fOublier();
  }

  async suivreNomsMotClef(
    id: string,
    f: schémaFonctionSuivi<{ [key: string]: string }>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef(id, "noms", f);
  }

  async effacerMotClef(id: string): Promise<void> {
    // Effacer l'entrée dans notre liste de mots clefs
    await this.enleverDeMesMotsClefs(id);

    // Effacer le mot-clef lui-même
    const optionsAccès = await this.client.obtOpsAccès(id);
    for (const clef in ["noms"]) {
      const idBd = await this.client.obtIdBd(clef, id, undefined, optionsAccès);
      if (idBd) await this.client.effacerBd(idBd);
    }
    await this.client.effacerBd(id);
  }

  async suivreQualitéMotClef(
    id: string,
    f: schémaFonctionSuivi<number>
  ): Promise<schémaFonctionOublier> {
    return await this.suivreNomsMotClef(
      id,
      (noms) => f(Object.keys(noms).length ? 1 : 0)
    )
  }
}
