const serverUrl = process.env.CAPACITOR_SERVER_URL || 'http://10.0.2.2:3000';

module.exports = {
  appId: 'com.torneosv2.app',
  appName: 'Torneos',
  webDir: 'android-web',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://')
  }
};
