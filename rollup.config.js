import nodeGyp from "rollup-plugin-node-gyp";

import { babel } from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import { terser } from "rollup-plugin-terser";
import json from "@rollup/plugin-json";
import nodePolyfills from "rollup-plugin-polyfill-node";
const pkg = require("./package.json");

// Ref: https://dev.to/remshams/rolling-up-a-multi-module-system-esm-cjs-compatible-npm-library-with-typescript-and-babel-3gjg
const extensions = [".js", ".ts"];

export default {
  input: "src/index.ts",
  output: [
    {
      file: "lib/bundles/bundle.esm.js",
      format: "esm",
      sourcemap: true,
    },
    {
      file: "lib/bundles/bundle.esm.min.js",
      format: "esm",
      plugins: [terser()],
      sourcemap: true,
    },
    {
      file: "lib/bundles/bundle.umd.js",
      format: "umd",
      name: "myLibrary",
      sourcemap: true,
    },
    {
      file: "lib/bundles/bundle.umd.min.js",
      format: "umd",
      name: "myLibrary",
      plugins: [terser()],
      sourcemap: true,
    },
  ],
  inlineDynamicImports: true,
  external: [/@babel\/runtime/],
  plugins: [
    commonjs(),

    babel({
      babelHelpers: "runtime",
      include: ["src/**/*.ts"],
      extensions,
      exclude: "./node_modules/**",
    }),
    resolve({ extensions, preferBuiltins: true }),
    nodePolyfills(),
    nodeGyp(),
    json(),
  ],
};
