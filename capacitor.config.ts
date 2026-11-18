// Оболочка Android: Capacitor кладёт собранную игру из dist в WebView.
// Номер в имени APK берётся из package.json, не отсюда.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tankpenetration.game',
  appName: 'Tank Penetration',
  webDir: 'dist',
  backgroundColor: '#090505',
  android: {
    backgroundColor: '#090505',
  },
};

export default config;
