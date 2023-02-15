import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://github.com/node-webrtc/node-webrtc/issues/636#issuecomment-774171409
process.on('beforeExit', (code) => process.exit(code));

// https://github.com/ipfs/aegir/blob/master/md/migration-to-v31.md
const esbuild = {
    // this will inject all the named exports from 'node-globals.js' as globals
    inject: [path.join(__dirname, './scripts/node-globals.js')],
    external: ["fs", "path", "os", "chokidar", "@constl/electron-webrtc-relay"],
    plugins: [
      {
        name: 'node built ins', // this will make the bundler resolve node builtins to the respective browser polyfill
        setup (build) {
          build.onResolve({ filter: /^stream$/ }, () => {
            return { path: require.resolve('stream-browserify') }
          });
        }
      }
    ]
  }

  
/** @type {import('aegir').PartialOptions} */
const options = {
    test: {
        browser :{
          config: {
            buildConfig: esbuild,
          }
        }
      },
      build: {
        config: esbuild
      }
};

export default options;
