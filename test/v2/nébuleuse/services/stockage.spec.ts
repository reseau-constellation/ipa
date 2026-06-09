import path from "path";
import { expect } from "aegir/chai";
import { v4 as uuidv4 } from "uuid";
import { Appli } from "@/v2/nébuleuse/appli/appli.js";
import { serviceStockage } from "@/v2/nébuleuse/services/stockage.js";
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
    await stockage.sauvegarderItem({ clef: "a", valeur: "texte" });
    const val = await stockage.obtenirItem({ clef: "a" });
    expect(val).to.equal("texte");
  });

  it("valeur non existante", async () => {
    const val = await stockage.obtenirItem({ clef: "a" });
    expect(val).to.be.null();
  });

  it("effacer valeur", async () => {
    await stockage.sauvegarderItem({ clef: "a", valeur: "texte" });
    await stockage.effacerItem({ clef: "a" });
    const val = await stockage.obtenirItem({ clef: "a" });
    expect(val).to.be.null();
  });

  it("persistance", async () => {
    await stockage.sauvegarderItem({ clef: "a", valeur: "texte" });
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

    const val = await stockage.obtenirItem({ clef: "a" });
    expect(val).to.equal("texte");
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

    await appli2.services["stockage"].sauvegarderItem({ clef, valeur: "test" });
    const valDeStockage1 = await stockage.obtenirItem({ clef });

    expect(valDeStockage1).to.be.null();

    await stockage.sauvegarderItem({ clef, valeur: "autre valeur" });
    expect(await stockage.obtenirItem({ clef })).to.equal("autre valeur");

    expect(await appli2.services["stockage"].obtenirItem({ clef })).to.equal(
      "test",
    );

    await appli2.fermer();
  });
});
