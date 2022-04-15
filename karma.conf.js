module.exports = function(config) {
  config.set({
    frameworks: ['mocha', 'chai', 'karma-typescript'],
    files: ['tests/**/*.test.ts'],
    preprocessors: {
      "**/*.ts": "karma-typescript" // *.tsx for React Jsx
    },
    karmaTypescriptConfig: {
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@/*": ["src/*"]
        },
        moduleResolution: "node",
        esModuleInterop: true,
        downlevelIteration: true,
        module: "esnext",
        lib: ["dom", "esnext"],
        importHelpers: true,
        skipLibCheck: true,
      }
    },
    reporters: ['progress'],
    port: 9876,  // karma web server port
    colors: true,
    logLevel: config.LOG_INFO,
    browsers: ['ChromeHeadless'],
    // autoWatch: false,
    // singleRun: false, // Karma captures browsers, runs the tests and exits
    concurrency: Infinity
  })
}
