const sharedPresets = ["@babel/preset-typescript"];
const shared = {
  ignore: ["src/**/*.spec.ts"],
  presets: sharedPresets,
};

module.exports = {
  env: {
    esmUnbundled: shared,
    esmBundled: {
      ...shared,
      presets: [
        [
          "@babel/preset-env",
          {
            targets: "> 0.25%, not dead",
          },
        ],
        ...sharedPresets,
      ],
    },
    cjs: {
      ...shared,
      presets: [
        [
          "@babel/preset-env",
          {
            modules: "commonjs",
          },
        ],
        ...sharedPresets,
      ],
    },
  },
  plugins: [
    [
      "module-resolver",
      {
        root: "./",
        alias: {
          "@": ["./src"],
        },
        extensions: [".ts", ".tsx"],
      },
    ],
    "@babel/plugin-transform-runtime",
  ],
};
