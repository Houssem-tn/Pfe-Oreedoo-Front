// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function(config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('karma-junit-reporter'),
    ],
    client: {
      jasmine: {
        // you can add configuration options for Jasmine here
        // the possible options are listed at https://jasmine.github.io/api/edge/Configuration.html
        // for example, you can disable the random execution with `random: false`
        // or set a specific seed with `seed: 4321`
      },
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/coreui-free-angular-admin-template'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
        // lcov.info is what sonar.javascript.lcov.reportPaths (sonar-project.properties) consumes.
        { type: 'lcovonly' }
      ]
    },
    junitReporter: {
      // Consumed by CI as a machine-readable test report (e.g. GitHub's
      // test-summary actions) — not used locally.
      outputDir: require('path').join(__dirname, './coverage/coreui-free-angular-admin-template'),
      outputFile: 'junit.xml',
      useBrowserName: false
    },
    reporters: ['progress', 'kjhtml', 'junit'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome_Custom'],
    customLaunchers: {
      Chrome_Custom: {
        base: 'Chrome',
        flags: ['--disable-search-engine-choice-screen']
      },
      // CI: no display server, and CI runners commonly can't use Chrome's
      // sandbox (containerized/root execution) — --no-sandbox is safe here
      // specifically because CI only ever runs this project's own tests,
      // never arbitrary/untrusted web content.
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
      }
    },
    singleRun: false,
    restartOnFileChange: true
  });
};
