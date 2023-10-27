import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import express from "express";
import cors from "cors";
import url from "url";

const require = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://github.com/node-webrtc/node-webrtc/issues/636#issuecomment-774171409
process.on("beforeExit", (code) => process.exit(code));

// https://github.com/ipfs/aegir/blob/master/md/migration-to-v31.md
const esbuild = {
  // this will inject all the named exports from 'node-globals.js' as globals
  inject: [path.join(__dirname, "./scripts/node-globals.js")],
  external: ["fs", "path", "os", "chokidar", "url", "zlib", "rimraf", "electron"],
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

/** @type {import('aegir').PartialOptions} */
const options = {
  test: {
    browser: {
      config: {
        buildConfig: esbuild,
      },
    },
    before: async (opts) => {
      // On va lancer une page Constellation pour pouvoir tester la connectivité webrtc avec les navigateurs
      const { chromium } = await import("playwright");
      const navigateur = await chromium.launch();
      try {
        const page = await navigateur.newPage();
        await page.goto("https://réseau-constellation.ca");
      } catch (e) {
        // On arrête pas les tests pour une petite erreur comme ça
        console.error(e);
      }

      // Pour pouvoir accéder les fichiers test dans le navigateur
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
          })
        );
        appliExpress.get("/fichier/:nomFichier", function (req, res) {
          const { nomFichier } = req.params;

          const cheminFichier = path.join(
            url.fileURLToPath(new URL(".", import.meta.url)),
            "test",
            "ressources",
            decodeURIComponent(nomFichier)
          );

          res.sendFile(cheminFichier);
        });
        serveurLocal = appliExpress.listen(3000);
      }

      return { navigateur, serveurLocal };
    },
    after: async (_, avant) => {
      await avant.navigateur.close();
      await avant.serveurLocal?.close();
    },
  },
  build: {
    config: esbuild,
  },
};

export default options;
