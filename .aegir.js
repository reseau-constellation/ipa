import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import express from "express";
import cors from "cors";
import url from "url";
import { $ } from "execa";
import os from "os";
import esbuildCmd from "esbuild";
import { mkdtempSync, copyFileSync, appendFileSync, existsSync, lstat, lstatSync, readdirSync, readSync, readFileSync } from "fs";
import { sync } from "rimraf";

const require = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://github.com/node-webrtc/node-webrtc/issues/636#issuecomment-774171409
process.on("beforeExit", (code) => process.exit(code));

// https://github.com/ipfs/aegir/blob/master/md/migration-to-v31.md
const esbuild = {
  // this will inject all the named exports from 'node-globals.js' as globals
  inject: [path.join(__dirname, "./scripts/node-globals.js")],
  external: [
    "fs",
    "path",
    "os",
    "chokidar",
    "url",
    "zlib",
    "rimraf",
    "electron",
    "env-paths",
    "@libp2p/tcp",
    "@libp2p/mdns",
  ],
  plugins: [
    {
      name: "node built ins", // this will make the bundler resolve node builtins to the respective browser polyfill
      setup(build) {
        build.onResolve({ filter: /^stream$/ }, () => {
          return { path: require.resolve("stream-browserify") };
        });
        build.onResolve({ filter: /^os$/ }, () => {
          return { path: require.resolve("os-browserify") };
        });
        build.onResolve({ filter: /^node\:process$/ }, () => {
          return { path: require.resolve("process/browser") };
        });
        build.onResolve({ filter: /^crypto$/ }, () => {
          return { path: require.resolve("crypto-browserify") };
        });
        build.onResolve({ filter: /^fs/ }, () => {
          return { path: require.resolve("browserify-fs") };
        });
      },
    },
  ],
};

const générerServeurRessourcesTests = (opts) => {
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
  return serveurLocal;
};

const lancerSfipDansNavigateur = async (opts) => {
  const { chromium } = await import("playwright");
  const navigateur = await chromium.launch();

  const dossierCompilation = mkdtempSync(path.join(os.tmpdir(), "test-constl-"));
  const  fichierJs = path.join(dossierCompilation, "test.min.js");
  try {
    const page = await navigateur.newPage();
    const globalName = "testnavigsfip";
    const umdPre = `(function (root, factory) {(typeof module === 'object' && module.exports) ? module.exports = factory() : root.${globalName} = factory()}(typeof self !== 'undefined' ? self : this, function () {`;
    const umdPost = `return ${globalName}}));`;
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
      ...esbuild,
    });

    page.on("console", (msg) =>
      console.log("Message de Playwright : ", msg.text()),
    );
    const fichierHtml = path.join(dossierCompilation, "lancerNœud.html")
    
    copyFileSync(path.join(__dirname, "test", "utils", "lancerNœud.html"), fichierHtml)

    await page.goto(
      `file://${fichierHtml}`,
    );
    await page.getByText("Test").isVisible();
  } catch (e) {
    // On arrête pas les tests pour une petite erreur comme ça
    console.error(e);
  }
  return async () => {
    await navigateur.close();
    sync(dossierCompilation)
  };
};

/** @type {import('aegir').PartialOptions} */
const options = {
  test: {
    browser: {
      config: {
        buildConfig: esbuild,
      },
    },
    before: async (opts) => {
      const relai = undefined; // $`node dist/test/utils/relai.js &`;

      // On va lancer une page Constellation pour pouvoir tester la connectivité webrtc avec les navigateurs
      const fermerNavigateur = await lancerSfipDansNavigateur(opts);

      // Pour pouvoir accéder les fichiers test dans le navigateur
      const serveurLocal = générerServeurRessourcesTests(opts);

      return { fermerNavigateur, serveurLocal, relai };
    },
    after: async (_, avant) => {
      await avant.fermerNavigateur();
      await avant.serveurLocal?.close();
      avant.relai?.kill();
    },
  },
  build: {
    config: esbuild,
  },
};

export default options;
