import { registerRootComponent } from 'expo';

import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import App from './App';
import { widgetTaskHandler } from './src/widget/taskHandler';

// The pet widget on the Android home screen
if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
