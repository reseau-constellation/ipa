import path, { dirname } from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import url from "url";
import { $ } from "execa";
import os from "os";
import esbuildCmd from "esbuild";
import { mkdtempSync, copyFileSync } from "fs";
import { sync } from "rimraf";
import { dossiers, config } from "@constl/utils-tests";

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

      const cheminFichier = path.join(
        url.fileURLToPath(new URL(".", import.meta.url)),
        "test",
        "ressources",
        decodeURIComponent(nomFichier),
      );

      res.sendFile(cheminFichier);
    });
    serveurLocal = appliExpress.listen(3000);
  }
  return async () => serveurLocal?.close();
};

const lancerSfipDansNode = async (opts) => {
  const { dossier, fEffacer } = await dossiers.dossierTempo();
  const args = ["--dossier", dossier];

  const processusNode = $`node dist/test/utils/lancerNœud.js ${args} &`; // $({stdio: 'inherit'})`...` pour écrire à la console

  return async () => {
    processusNode?.kill();
    fEffacer();
  };
};

const lancerSfipDansNavigateur = async (opts) => {
  const { chromium } = await import("playwright");
  const navigateur = await chromium.launch();

  const dossierCompilation = mkdtempSync(
    path.join(os.tmpdir(), "test-constl-"),
  );
  try {
    const fichierJs = path.join(dossierCompilation, "test.min.js");
    const page = await navigateur.newPage();
    page.on("console", (msg) =>
      console.log("Message de Playwright : ", msg.text()),
    );

    const globalName = "testnavigsfip";
    const umdPre = `(function (root, factory) {(typeof module === 'object' && module.exports) ? module.exports = factory() : root.${globalName} = factory()}(typeof self !== 'undefined' ? self : this, function () {`;
    const umdPost = `return ${globalName}}));`;
    const configEsbuild = await config.obtConfigEsbuild();
    await esbuildCmd.build({
      entryPoints: ["dist/test/utils/lancerNœud.js"],
      bundle: true,
      format: "iife",
      conditions: ["production"],
      outfile: fichierJs,
      banner: { js: umdPre },
      footer: { js: umdPost },
      define: {
        global: "globalThis",
        "process.env.NODE_ENV": '"production"',
      },
      ...configEsbuild,
    });

    const fichierHtml = path.join(dossierCompilation, "lancerNœud.html");

    const __dirname = dirname(fileURLToPath(import.meta.url));
    copyFileSync(
      path.join(__dirname, "test", "utils", "lancerNœud.html"),
      fichierHtml,
    );

    await page.goto(`file://${fichierHtml}`);
  } catch (e) {
    // On arrête pas les tests pour une petite erreur comme ça
    console.error(e);
  }
  return async () => {
    await navigateur.close();
    sync(dossierCompilation);
  };
};

const avantTest = async (opts) => {
  // On va lancer une page Constellation pour pouvoir tester la connectivité webrtc avec les navigateurs
  const fermerNavigateur = await lancerSfipDansNavigateur(opts);

  // Et une sur Node.js pour pouvoir tester la connectivité avec Node
  const fermerNode = await lancerSfipDansNode(opts);

  // Pour pouvoir accéder les fichiers test dans le navigateur
  const fermerServeurLocal = await générerServeurRessourcesTests(opts);

  return { fermerNavigateur, fermerNode, fermerServeurLocal };
};

const aprèsTest = async (_, avant) => {
  await avant.fermerNavigateur();
  await avant.fermerNode();
  await avant.fermerServeurLocal();
};

const générerConfigÆgirFinal = async () => {
  const configÆgir = await config.générerConfigÆgir();

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
    const retourAprèsTestDéfaut = await aprèsTestDéfaut(_, avant);
    const retourAprèsTest = await aprèsTest(_, avant);
    return {
      ...retourAprèsTestDéfaut,
      ...retourAprèsTest,
    };
  };

  return configÆgir;
};

export default générerConfigÆgirFinal();
