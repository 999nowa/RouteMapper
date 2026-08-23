/**
 * @format
 */

import React from 'react';
import {AppRegistry, StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import RouteMapperScreen from './src/RouteMapperScreen';
import {name as appName} from './app.json';

function Root() {
  return <SafeAreaProvider><StatusBar barStyle="dark-content" /><RouteMapperScreen /></SafeAreaProvider>;
}

AppRegistry.registerComponent(appName, () => Root);
