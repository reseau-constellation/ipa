import fs from "fs";
import path from "path";
import { expect } from "aegir/chai";
import { v4 as uuidv4 } from "uuid";
import { Appli } from "@/v2/nébuleuse/appli/appli.js";
import {
  StockageLocal,
  serviceStockage,
} from "@/v2/nébuleuse/services/stockage.js";
import { serviceDossier } from "@/v2/nébuleuse/services/dossier.js";
import { dossierTempoPropre } from "../../utils.js";
import type { ServiceStockage } from "@/v2/nébuleuse/index.js";
import type { ServicesNécessairesStockage } from "@/v2/nébuleuse/services/stockage.js";

describe.only("Stockage", function () {
  let appli: Appli<ServicesNécessairesStockage & { stockage: ServiceStockage }>;
  let stockage: ServiceStockage;
  let dossier: string;
  let effacer: () => void;

  beforeEach(async () => {
    ({ dossier, effacer } = await dossierTempoPropre());

    appli = new Appli<
      ServicesNécessairesStockage & { stockage: ServiceStockage }
    >({
      services: {
        dossier: serviceDossier({ dossier }),
        stockage: serviceStockage(),
      },
    });
    await appli.démarrer();
    stockage = appli.services["stockage"];
  });

  afterEach(async () => {
    await appli?.fermer();
    effacer?.();
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
    await appli.fermer();

    // Ouvrir la appli à nouveau
    appli = new Appli<
      ServicesNécessairesStockage & { stockage: ServiceStockage }
    >({
      services: {
        dossier: serviceDossier({ dossier }),
        stockage: serviceStockage(),
      },
    });
    await appli.démarrer();
    stockage = appli.services["stockage"];

    const val = await stockage.obtenirItem("a");
    expect(val).to.equal("texte");
  });

  it("fichier malformé", async () => {
    const { stockageLocal } = await stockage.démarré();
    await appli.fermer();
    if (stockageLocal instanceof StockageLocal) {
      fs.writeFileSync(stockageLocal.fichier, "{/Json invalid");
    }

    // Ouvrir la appli à nouveau
    appli = new Appli<
      ServicesNécessairesStockage & { stockage: ServiceStockage }
    >({
      services: {
        dossier: serviceDossier({ dossier }),
        stockage: serviceStockage(),
      },
    });
    await appli.démarrer();
    stockage = appli.services["stockage"];

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

    const appli2 = new Appli<
      ServicesNécessairesStockage & { stockage: ServiceStockage }
    >({
      services: {
        dossier: serviceDossier({
          dossier: path.join(dossier, "sous-dossier"),
        }),
        stockage: serviceStockage(),
      },
    });
    await appli2.démarrer();

    await appli2.services["stockage"].sauvegarderItem(clef, "test");
    const valDeStockage1 = await stockage.obtenirItem(clef);

    expect(valDeStockage1).to.be.null();

    await stockage.sauvegarderItem(clef, "autre valeur");
    expect(await stockage.obtenirItem(clef)).to.equal("autre valeur");

    expect(await appli2.services["stockage"].obtenirItem(clef)).to.equal(
      "test",
    );

    await appli2.fermer();
  });
});
