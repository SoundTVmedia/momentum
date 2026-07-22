const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MODULAR_HEADER_PODS = `  # Required for @react-native-google-signin/google-signin (AppCheckCore → GoogleUtilities)
  pod 'GoogleUtilities', :modular_headers => true
  pod 'RecaptchaInterop', :modular_headers => true
`;

/**
 * Expo config plugin: add modular_headers for Google Sign-In transitive pods.
 * Survives `expo prebuild` regenerations.
 */
function withGoogleSignInModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes("pod 'GoogleUtilities'")) {
        return cfg;
      }
      if (!contents.includes('use_react_native!')) {
        throw new Error('Podfile missing use_react_native!; cannot inject modular headers');
      }
      contents = contents.replace(
        /^(\s*)use_react_native!\(/m,
        `${MODULAR_HEADER_PODS}\n$1use_react_native!(`,
      );
      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
}

module.exports = withGoogleSignInModularHeaders;
