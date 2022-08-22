module.exports = function (config) {
  config.set({
    frameworks: ["mocha", "chai", "karma-typescript"],
    files: ["src/**/*.ts", "tests/**/*.test.ts"],
    preprocessors: {
      "**/*.ts": "karma-typescript", // *.tsx for React Jsx
    },
    reporters: ["progress", "karma-typescript"],
    karmaTypescriptConfig: {
      bundlerOptions: {
        transforms: [require("karma-typescript-es6-transform")()],
      },
      compilerOptions: {
        module: "commonjs",
        noImplicitAny: true,
        target: "es2015",
        lib: ["es2017"],
        importHelpers: true,
        declaration: true,
        sourceMap: true,
        strict: true,
        moduleResolution: "node",
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        baseUrl: ".",
        paths: {
          "@/*": ["src/*"],
        },
        downlevelIteration: true,
        declarationMap: true,
      },
    },
    browsers: ["ChromeHeadless"],
  });
};
