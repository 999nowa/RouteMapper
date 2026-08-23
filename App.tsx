import React from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import RouteMapperFeatureScreen from './src/RouteMapperFeatureScreen';

export default function App() {
  return <SafeAreaProvider><StatusBar barStyle="dark-content" /><RouteMapperFeatureScreen /></SafeAreaProvider>;
}
