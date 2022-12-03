import ClientConstellation from "@/client.js";

import { schémaFonctionSuivi, schémaFonctionOublier } from "@/utils/index.js";
import ContrôleurConstellation from "@/accès/cntrlConstellation.js";

import FeedStore from "orbit-db-feedstore";
import KeyValueStore from "orbit-db-kvstore";

export default class Nuée {
  client: ClientConstellation;
  idBd: string;

  constructor({ client, id }: { client: ClientConstellation; id: string }) {
    this.client = client;
    this.idBd = id;
  }

  async créerNuée({
    nuéeParent,
    autorisation,
  }: {
    nuéeParent?: string;
    autorisation?: string;
  }): Promise<string> {
    const idBdNuée = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès: {
        address: undefined,
        premierMod: this.client.bdCompte!.id,
      },
    });

    await this.ajouterÀMesNuées({ id: idBdNuée });

    const { bd: bdNuée, fOublier: fOublierNuée } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdNuée>
    >({
      id: idBdNuée,
    });

    const accès = bdNuée.access as unknown as ContrôleurConstellation;
    const optionsAccès = { address: accès.address };

    await bdNuée.set("type", "nuée");

    await bdNuée.set("autorisation", autorisation || await this.générerGestionnaireAutorisations())

    const idBdNoms = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdNuée.set("noms", idBdNoms);

    const idBdDescr = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdNuée.set("descriptions", idBdDescr);

    const idBdTableaux = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdNuée.set("tableaux", idBdTableaux);

    const idBdMotsClefs = await this.client.créerBdIndépendante({
      type: "feed",
      optionsAccès,
    });
    await bdNuée.set("motsClefs", idBdMotsClefs);

    await bdNuée.set("statut", { statut: TYPES_STATUT.ACTIVE });

    fOublierNuée();
    return idBdNuée;
  }

  async copierNuée(): Promise<string> {}

  async suivreNuées({
    f,
    idBdNuéesCompte,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idBdNuéesCompte?: string;
  }): Promise<schémaFonctionOublier> {
    idBdNuéesCompte = idBdNuéesCompte || this.idBd;
    return await this.client.suivreBdListe({ id: idBdNuéesCompte, f });
  }

  async ajouterNomsNuée({
    id,
    noms,
  }: {
    id: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: id });
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: id,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdNoms) throw new Error(`Permission de modification refusée pour Nuée ${id}.`);

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });

    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
    await fOublier();
  }

  async effacerNomNuée({
    id,
    langue,
  }: {
    id: string;
    langue: string;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: id });
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: id,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdNoms) throw new Error(`Permission de modification refusée pour Nuée ${id}.`);

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    await bdNoms.del(langue);
    await fOublier();
  }

  async suivreNomsNuée({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({ id, clef: "noms", f });
  }

  ajouterDescriptionsNuée() {}
  effacerDescriptionNuée() {}
  suivreDescriptionsNuée() {}

  async ajouterMotClefNuée({
    idMotClef,
    idNuée,
  }: {
    idMotClef: string;
    idNuée: string;
  }): Promise<void> {}
  async effacerMotClefNuée({
    idMotClef,
    idNuée,
  }: {
    idMotClef: string;
    idNuée: string;
  }): Promise<void> {}
  suivreMotsClefsNuée() {}

  async inviterAuteur({
    idNuée,
    idBdCompteAuteur,
    rôle,
  }: {
    idNuée: string;
    idBdCompteAuteur: string;
    rôle: keyof objRôles;
  }): Promise<void> {
    await this.client.donnerAccès({
      idBd: idNuée,
      identité: idBdCompteAuteur,
      rôle,
    });
  }

  async générerGestionnaireAutorisations(): Promise<string> {}
  async obtAutorisationNuée({ idNuée }: { idNuée: string }): Promise<string> {}
  async changerPhisolophieAutorisation({
    philosophie,
  }: {
    philosophie: "IJPC" | "CJPI";
  }): Promise<void> {}
  async suivrePhisolophieAutorisation({
    idNuée,
  }: {
    idNuée: string;
  }): Promise<schémaFonctionSuivi<"IJPC" | "CJPI">> {}
  async accepterMembre({
    idAutorisation,
    idCompte,
  }: {
    idAutorisation: string;
    idCompte: string;
  }): Promise<void> {}
  async exclureMembre({
    idAutorisation,
    idCompte,
  }: {
    idAutorisation: string;
    idCompte: string;
  }): Promise<void> {}
  suivreGestionnaireAutorisations() {}
  changerGestionnaireAutorisations() {}
  suivreAutorisationsMembresDeGestionnaire() {}
  suivreAutorisationsMembresDeNuée() {}

  ajouterTableauNuée() {}
  effacerTableauNuée() {}
  suivreTableauxNuée() {}

  async ajouterNomsTableauNuée({
    idNuée,
    clefTableau,
    noms,
  }: {
    idNuée: string;
    clefTableau: string;
    noms: { [langue: string]: string };
  }): Promise<void> {}
  effacerNomTableauNuée() {}
  suivreNomsTableauNuée() {}

  ajouterColonneTableauNuée() {}
  effacerColonneTableauNuée() {}
  suivreColonnesTableauNuée() {}

  spécifierVariableColonneTableauNuée() {}
  suivreVariableColonneTableauNuée() {}

  spécifierIndexeColonneTableauNuée() {}
  suivrreIndexeColonneTableauNuée() {}

  ajouterRègleColonneTableauNuée() {}
  effacerRègleColonneTableauNuée() {}
  suivreRèglesColonneTableauNuée() {}

  async suivreNuéesSpécialiséesLiées({
    idNuée,
  }: {
    idNuée: string;
  }): Promise<schémaFonctionSuivi<Set<string>>> {}

  async suivreNuéesParents({
    idNuée,
  }: {
    idNuée: string;
  }): Promise<schémaFonctionSuivi<string[]>> {}

  async suivreBdsCorrespondantes({
    vérifierAutorisation = true,
  }: {
    vérifierAutorisation?: boolean;
  }): Promise<schémaRéponseRecherche> {}
  async suivreDonnéesTableauNuée({
    idNuée,
    clefTableau,
    ignorerErreursFormatBd,
    ignorerErreursFormatTableau,
    ignorerErreursÉlémentsTableau,
  }: {
    idNuée: string;
    clefTableau: string;
    ignorerErreursFormatBd: true;
    ignorerErreursFormatTableau: false;
    ignorerErreursÉlémentsTableau: true;
  }): Promise<schémaFonctionSuivi> {}

  générerDeBd({ idBd }: { idBd: string }): Promise<string> {
    // Noms
    // Descriptions
    // Mots-clefs
    // Tableaux
    // Colonnes
    // Indexes
    // Règles

    return idNuée;
  }
}
