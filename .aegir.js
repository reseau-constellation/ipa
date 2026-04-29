import path from "path";
import url from "url";
import { realpathSync } from "fs";
import { générerConfigÆgir } from "@constl/utils-tests";
import cors from "cors";
import express from "express";

const générerServeurRessourcesTests = async (opts) => {
  /**
   * @type {Express | undefined}
   */
  let serveurLocal = undefined;

  if (
    opts.target.includes("browser") ||
    opts.target.includes("electron-renderer")
  ) {
    const appliExpress = express();

    // Permettre l'accès à partir de l'hôte locale
    appliExpress.use(
      cors({
        origin: function (origin, callback) {
          if (!origin) {
            callback(null, true);
            return;
          }
          if (new URL(origin).hostname === "127.0.0.1") {
            callback(null, true);
          } else {
            callback(new Error("Not allowed by CORS"));
          }
        },
      }),
    );
    appliExpress.get("/fichier/:nomFichier", function (req, res) {
      const { nomFichier } = req.params;
      const racine = path.join(
        url.fileURLToPath(new URL(".", import.meta.url)),
        "test",
        "v2",
        "ressources",
      );

      const cheminFichier = realpathSync(
        path.resolve(racine, decodeURIComponent(nomFichier)),
      );
      if (!cheminFichier.startsWith(racine)) {
        res.statusCode = 403;
        res.end();
        return;
      }
      res.sendFile(cheminFichier);
    });

    serveurLocal = appliExpress.listen(3000);
  }
  return async () => serveurLocal?.close();
};

const avantTest = async (opts) => {
  // Pour pouvoir accéder les fichiers test dans le navigateur
  const fermerServeurLocal = await générerServeurRessourcesTests(opts);

  return {
    fermerServeurLocal,
  };
};

const aprèsTest = async (_, avant) => {
  await avant?.fermerServeurLocal();
};

const générerConfigÆgirFinal = async () => {
  const configÆgir = await générerConfigÆgir();
  configÆgir.test.browser.config.buildConfig.external.push("@constl/serveur");

  const avantTestDéfaut = configÆgir.test.before;
  configÆgir.test.before = async (opts) => {
    const retourAvantTestDéfaut = await avantTestDéfaut(opts);
    const retourAvantTest = await avantTest(opts);
    return {
      ...retourAvantTestDéfaut,
      ...retourAvantTest,
    };
  };

  const aprèsTestDéfaut = configÆgir.test.after;
  configÆgir.test.after = async (_, avant) => {
    const retourAprèsTest = await aprèsTest(_, avant);
    const retourAprèsTestDéfaut = await aprèsTestDéfaut(_, avant);
    return {
      ...retourAprèsTestDéfaut,
      ...retourAprèsTest,
    };
  };

  configÆgir.test.browser.config.buildConfig.external.push("quibble");
  configÆgir.build.config.external.push("quibble");
  return configÆgir;
};

export default générerConfigÆgirFinal();
