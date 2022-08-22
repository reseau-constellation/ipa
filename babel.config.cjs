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
            useBuiltIns: "usage",
            corejs: 3,
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
            useBuiltIns: "usage",
            corejs: 3,
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
