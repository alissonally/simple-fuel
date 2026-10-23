const http = require('node:http');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');

// expo-sqlite no web carrega o wa-sqlite (.wasm) e usa SharedArrayBuffer, que exige
// isolamento entre origens (headers COOP/COEP) também na página HTML. O
// `server.enhanceMiddleware` só cobre as rotas do Metro, não o HTML servido pelo Expo
// CLI, então os headers são aplicados a toda resposta do servidor de desenvolvimento.
config.resolver.assetExts.push('wasm');
const writeHead = http.ServerResponse.prototype.writeHead;
http.ServerResponse.prototype.writeHead = function (...args) {
  if (!this.headersSent) {
    this.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    this.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  }
  return writeHead.apply(this, args);
};

module.exports = config;
