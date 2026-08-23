import React from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import RouteMapperScreen from './src/RouteMapperScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <RouteMapperScreen />
    </SafeAreaProvider>
  );
}
