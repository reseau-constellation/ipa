import FeedStore from "orbit-db-feedstore";
import KeyValueStore from "orbit-db-kvstore";

import ClientConstellation from "./client";
import { schémaFonctionSuivi, schémaFonctionOublier } from "@/utils";
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
    f: schémaFonctionSuivi<string[]>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdListe<string>(this.idBd, f);
  }

  async créerMotClef(): Promise<string> {
    const { bd: bdRacine, fOublier: fOublierRacine } =
      await this.client.ouvrirBd<FeedStore<string>>(this.idBd);
    const idBdMotClef = await this.client.créerBdIndépendante("kvstore", {
      adresseBd: undefined,
      premierMod: this.client.bdCompte!.id,
    });
    await bdRacine.add(idBdMotClef);

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

    fOublierRacine();
    fOublierMotClef();
    return idBdMotClef;
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
    const { bd: bdRacine, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >(this.idBd);
    await this.client.effacerÉlémentDeBdListe(bdRacine, id);
    await this.client.effacerBd(id);
    fOublier();
  }
}
