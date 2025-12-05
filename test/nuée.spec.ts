import { constellation as utilsTestConstellation } from "@constl/utils-tests";
import { isSet } from "lodash-es";
import { expect } from "aegir/chai";
import { créerConstellation, type Constellation } from "@/index.js";
import { obtRessourceTest } from "./ressources/index.js";

import type XLSX from "xlsx";

const { créerConstellationsTest } = utilsTestConstellation;

describe("Document données exportées", function () {
  let fOublierClients: () => Promise<void>;
  let clients: Constellation[];
  let client: Constellation;

  let idNuée: string;
  let idTableau1Nuée: string;
  let idTableau2Nuée: string;
  let idColNum: string;

  let idBd: string;
  let doc: XLSX.WorkBook;
  let fichiersSFIP: Set<string>;
  let nomFichier: string;
  let cid: string;

  const nomTableau1 = "Tableau 1";
  const nomTableau2 = "Tableau 2";

  before(async () => {
    ({ fOublier: fOublierClients, clients } = await créerConstellationsTest({
      n: 1,

      créerConstellation,
    }));

    client = clients[0];

    idNuée = await client.nuées.créerNuée();
    await client.nuées.sauvegarderNomNuée({
      idNuée,
      langue: "fr",
      nom: "Ma nuée",
    });

    idTableau1Nuée = await client.nuées.ajouterTableauNuée({
      idNuée,
      clefTableau: "tableau 1",
    });
    idTableau2Nuée = await client.nuées.ajouterTableauNuée({
      idNuée,
      clefTableau: "tableau 2",
    });

    const idVarNum = await client.variables.créerVariable({
      catégorie: "numérique",
    });
    const idVarFichier = await client.variables.créerVariable({
      catégorie: "fichier",
    });
    idColNum = await client.nuées.ajouterColonneTableauNuée({
      idTableau: idTableau1Nuée,
      idVariable: idVarNum,
    });
    const idColFichier = await client.nuées.ajouterColonneTableauNuée({
      idTableau: idTableau2Nuée,
      idVariable: idVarFichier,
    });

    const octets = await obtRessourceTest({
      nomFichier: "logo.svg",
    });
    cid = await client.ajouterÀSFIP({
      contenu: octets,
      nomFichier: "logo.svg",
    });

    const schéma = await client.nuées.générerSchémaBdNuée({
      idNuée,
      licence: "ODbl-1_0",
    });
    idBd = await client.bds.créerBdDeSchéma({ schéma });

    await client.bds.ajouterÉlémentÀTableauParClef({
      idBd,
      clefTableau: "tableau 2",
      vals: {
        [idColFichier]: cid,
      },
    });

    await client.nuées.sauvegarderNomsTableauNuée({
      idTableau: idTableau1Nuée,
      noms: {
        fr: nomTableau1,
      },
    });
    await client.nuées.sauvegarderNomsTableauNuée({
      idTableau: idTableau2Nuée,
      noms: {
        fr: nomTableau2,
      },
    });

    ({ doc, fichiersSFIP, nomFichier } = await client.nuées.exporterDonnéesNuée(
      {
        idNuée,
        langues: ["fr"],
      },
    ));
  });

  after(async () => {
    if (fOublierClients) await fOublierClients();
  });

  it("Doc créé avec tous les tableaux", () => {
    expect(Array.isArray(doc.SheetNames));
    expect(doc.SheetNames).to.have.members([nomTableau1, nomTableau2]);
  });

  it("Fichiers SFIP retrouvés de tous les tableaux", () => {
    expect(isSet(fichiersSFIP)).to.be.true();
    expect(fichiersSFIP.size).to.equal(1);
    expect([...fichiersSFIP]).to.have.deep.members([cid]);
  });

  it("Nom fichier", () => {
    expect(nomFichier).to.eq("Ma nuée");
  });

  it("Exportable même si nuée non disponible", async () => {
    const schéma = await client.nuées.générerSchémaBdNuée({
      idNuée,
      licence: "ODbl-1_0",
    });
    const idNuéeNExistePas =
      "/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX"; // N'existe pas
    schéma.nuées = [idNuéeNExistePas];
    idBd = await client.bds.créerBdDeSchéma({ schéma });
    await client.bds.ajouterÉlémentÀTableauParClef({
      idBd,
      clefTableau: "tableau 1",
      vals: {
        [idColNum]: 123,
      },
    });

    const { doc, fichiersSFIP, nomFichier } =
      await client.nuées.exporterDonnéesNuée({
        idNuée: idNuéeNExistePas,
        langues: ["fr"],
        clefTableau: "tableau 1",
      });
    expect(Array.isArray(doc.SheetNames));
    expect(doc.SheetNames).to.have.members(["tableau 1"]);

    expect(isSet(fichiersSFIP)).to.be.true();
    expect(fichiersSFIP.size).to.equal(0);

    expect(nomFichier).to.eq(idNuéeNExistePas.slice("/orbitdb/".length));
  });
});
