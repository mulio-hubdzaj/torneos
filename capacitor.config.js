const serverUrl = process.env.CAPACITOR_SERVER_URL || 'http://10.0.2.2:3000';
const appId = process.env.CAPACITOR_APP_ID || 'com.torneosv2.prd';
const appName = process.env.CAPACITOR_APP_NAME || 'Torneos Pro';

module.exports = {
  appId,
  appName,
  webDir: 'android-web',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://')
  }
};
