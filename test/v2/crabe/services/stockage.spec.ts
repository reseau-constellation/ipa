import fs from "fs";
import path from "path";
import { expect } from "aegir/chai";
import { v4 as uuidv4 } from "uuid";
import { ServiceStockage } from "@/v2/crabe/index.js";
import { Nébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import { StockageLocal } from "@/v2/crabe/services/stockage.js";
import { dossierTempoPropre } from "../../utils.js";

describe.only("Stockage", function () {
  let nébuleuse: Nébuleuse<{ stockage: ServiceStockage }>;
  let stockage: ServiceStockage;
  let dossier: string;
  let effacer: () => void;

  beforeEach(async () => {
    ({ dossier, effacer } = await dossierTempoPropre());

    nébuleuse = new Nébuleuse({
      services: {
        stockage: ServiceStockage,
      },
      options: {
        dossier,
      },
    });
    await nébuleuse.démarrer();
    stockage = nébuleuse.services["stockage"];
  });

  afterEach(async () => {
    await nébuleuse.fermer();
    effacer();
  });

  it("mettre et obtenir valeur", async () => {
    await stockage.sauvegarderItem("a", "texte");
    const val = await stockage.obtenirItem("a");
    expect(val).to.equal("texte");
  });

  it("effacer valeur", async () => {
    await stockage.sauvegarderItem("a", "texte");
    await stockage.effacerItem("a");
    const val = await stockage.obtenirItem("a");
    expect(val).to.be.null();
  });

  it("persistance", async () => {
    await stockage.sauvegarderItem("a", "texte");
    await nébuleuse.fermer();

    // Ouvrir la nébuleuse à nouveau
    nébuleuse = new Nébuleuse({
      services: {
        stockage: ServiceStockage,
      },
      options: {
        dossier,
      },
    });
    await nébuleuse.démarrer();
    stockage = nébuleuse.services["stockage"];

    const val = await stockage.obtenirItem("a");
    expect(val).to.equal("texte");
  });

  it("fichier malformé", async () => {
    const { stockageLocal } = await stockage.démarré();
    await nébuleuse.fermer();
    if (stockageLocal instanceof StockageLocal) {
      fs.writeFileSync(stockageLocal.fichier, "{/Json invalid");
    }

    // Ouvrir la nébuleuse à nouveau
    nébuleuse = new Nébuleuse({
      services: {
        stockage: ServiceStockage,
      },
      options: {
        dossier,
      },
    });
    await nébuleuse.démarrer();
    stockage = nébuleuse.services["stockage"];

    const val = await stockage.obtenirItem("a");
    expect(val).to.be.null();
  });

  it("exporter", async () => {
    await stockage.sauvegarderItem("a", "texte");
    
    const exporté = await stockage.exporter();
    expect(JSON.parse(exporté)).to.deep.equal({ a: "texte" });
  });

  it("non interférence entre instances", async () => {
    const clef = uuidv4();

    const nébuleuse2 = new Nébuleuse({
      services: {
        stockage: ServiceStockage,
      },
      options: {
        dossier: path.join(dossier, "sous-dossier"),
      },
    });
    await nébuleuse2.démarrer();

    await nébuleuse2.services["stockage"].sauvegarderItem(clef, "test");
    const valDeStockage1 = await stockage.obtenirItem(clef);

    expect(valDeStockage1).to.be.null();

    await stockage.sauvegarderItem(clef, "autre valeur");
    expect(await stockage.obtenirItem(clef)).to.equal("autre valeur");

    expect(await nébuleuse2.services["stockage"].obtenirItem(clef)).to.equal(
      "test",
    );

    await nébuleuse2.fermer();
  });
});
