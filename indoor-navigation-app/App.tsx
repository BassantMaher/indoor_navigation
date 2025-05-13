import React, { useEffect } from 'react';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import { GeofencingNavigation } from './src/components/GeofencingNavigation';

export default function App() {
  useEffect(() => {
    // We'll handle permissions in the GeofencingNavigation component
    // for better user experience and UI feedback
    console.log('[DEBUG] App initialized');
  }, []);

  return <GeofencingNavigation />;
}
