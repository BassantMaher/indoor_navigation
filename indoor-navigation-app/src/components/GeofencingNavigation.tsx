import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Alert, Text, TouchableOpacity, Platform, PermissionsAndroid, ScrollView, Linking, NativeModules } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Svg, { Rect, Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import WifiManager from 'react-native-wifi-reborn';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import { TextInput } from 'react-native';

import {
  GRID_SIZE,
  SCAN_INTERVAL,
  API_URL,
  accessPoints,
  products,
  geofences,
  grid
} from '../constants/store';
import { Coordinates, WifiScanResult, Product } from '../types/navigation';

const CELL_SIZE = 30;
const BOARD_SIZE = GRID_SIZE * CELL_SIZE;

// Add custom type definitions for WifiManager
interface WifiEntry {
  BSSID: string;
  SSID: string;
  level: number; // This is equivalent to RSSI
  frequency: number;
  timestamp: number;
  capabilities: string;
}

// Check if WifiManager is available or null
const isWifiManagerAvailable = () => {
  return !!WifiManager && typeof WifiManager.loadWifiList === 'function';
};

export const GeofencingNavigation: React.FC = () => {
  const [userPosition, setUserPosition] = useState<Coordinates>({ x: 1, y: 0 });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [path, setPath] = useState<number[][]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [error, setError] = useState<string>('');
  const [currentGeofence, setCurrentGeofence] = useState<string>('');
  const [isWifiEnabled, setIsWifiEnabled] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isWifiManagerNull, setIsWifiManagerNull] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [tempX, setTempX] = useState(1);
  const [tempY, setTempY] = useState(1);

  // Network connectivity monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  // Calculate position from RSSI values
  const calculatePosition = useCallback((scanResults: WifiScanResult[]) => {
    console.log('[DEBUG] calculatePosition called with', scanResults.length, 'access points');
    const positions: { x: number; y: number; weight: number }[] = [];

    scanResults.forEach(result => {
      const accessPoint = accessPoints.find(ap => ap.mac === result.BSSID);
      if (accessPoint) {
        const distance = Math.pow(10, (-50 - result.RSSI) / 20);
        const weight = 1 / (distance * distance);
        console.log('[DEBUG] AP:', result.BSSID, 'RSSI:', result.RSSI, 'Distance:', distance.toFixed(2), 'Weight:', weight.toFixed(4));
        positions.push({
          x: accessPoint.x,
          y: accessPoint.y,
          weight
        });
      } else {
        console.log('[DEBUG] Unknown AP:', result.BSSID, 'RSSI:', result.RSSI);
      }
    });

    if (positions.length === 0) {
      console.log('[DEBUG] No matching access points found in database');
      return null;
    }

    const totalWeight = positions.reduce((sum, pos) => sum + pos.weight, 0);
    console.log('[DEBUG] Total weight:', totalWeight.toFixed(4));
    
    const x = Math.round(
      positions.reduce((sum, pos) => sum + pos.x * pos.weight, 0) / totalWeight
    );
    const y = Math.round(
      positions.reduce((sum, pos) => sum + pos.y * pos.weight, 0) / totalWeight
    );
    
    console.log('[DEBUG] Raw calculated position:', { x, y });

    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE && grid[y][x] === 0) {
      console.log('[DEBUG] Position valid and walkable');
      return { x, y };
    }
    
    console.log('[DEBUG] Position invalid or not walkable:', { x, y }, 
      'In bounds:', x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE, 
      'Cell value:', x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE ? grid[y][x] : 'out of bounds');
    return null;
  }, []);

  // Check geofence
  const checkGeofence = useCallback((position: Coordinates) => {
    console.log('[DEBUG] Checking geofences for position:', position);
    
    for (const fence of geofences) {
      const isInside = position.x >= fence.bounds.minX &&
                      position.x <= fence.bounds.maxX &&
                      position.y >= fence.bounds.minY &&
                      position.y <= fence.bounds.maxY;

      if (isInside) {
        console.log('[DEBUG] Inside geofence:', fence.label);
        
        if (currentGeofence !== fence.label) {
          console.log('[DEBUG] Entered new geofence:', fence.label);
          setCurrentGeofence(fence.label);
          Alert.alert('Geofence Alert', `Entered ${fence.label}`);
          return;
        } else {
          console.log('[DEBUG] Still in same geofence:', fence.label);
          return;
        }
      }
    }

    if (currentGeofence) {
      console.log('[DEBUG] Exited geofence:', currentGeofence);
      setCurrentGeofence('');
      Alert.alert('Geofence Alert', 'Exited geofence area');
    } else {
      console.log('[DEBUG] Not in any geofence');
    }
  }, [currentGeofence]);

  // Check and request permissions
  const checkAndRequestPermissions = useCallback(async () => {
    console.log('[DEBUG] Checking permissions...');
    if (Platform.OS === 'android') {
      try {
        // Basic location permissions
        const locationPermissions = [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ];

        // Request location permissions first
        console.log('[DEBUG] Requesting location permissions:', locationPermissions);
        const locationGranted = await PermissionsAndroid.requestMultiple(locationPermissions);
        console.log('[DEBUG] Location permission results:', locationGranted);

        // Check if location permissions are granted
        const locationGrantedAll = Object.values(locationGranted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!locationGrantedAll) {
          console.log('[DEBUG] Location permissions not granted');
          setError('Location permissions are required for this app to work properly.');
          return false;
        }

        // For Android 12 (API level 31) and above, request NEARBY_WIFI_DEVICES separately
        if (Platform.Version >= 31) {
          try {
            console.log('[DEBUG] Requesting NEARBY_WIFI_DEVICES permission');
            const wifiPermission = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
              {
                title: 'Wi-Fi Permission',
                message: 'This app needs access to nearby Wi-Fi devices to determine your location.',
                buttonNeutral: 'Ask Me Later',
                buttonNegative: 'Cancel',
                buttonPositive: 'OK',
              }
            );
            console.log('[DEBUG] NEARBY_WIFI_DEVICES permission result:', wifiPermission);

            if (wifiPermission !== PermissionsAndroid.RESULTS.GRANTED) {
              console.log('[DEBUG] NEARBY_WIFI_DEVICES permission denied');
              setError('Wi-Fi scanning permission is required for accurate indoor positioning.');
              return false;
            }
          } catch (wifiErr) {
            console.error('[DEBUG] Error requesting NEARBY_WIFI_DEVICES permission:', wifiErr);
            setError('Failed to request Wi-Fi scanning permission: ' + (wifiErr as Error).message);
            return false;
          }
        }

        console.log('[DEBUG] All permissions successfully granted');
        setHasPermissions(true);
        return true;
      } catch (err) {
        console.error('[DEBUG] Error requesting permissions:', err);
        setError('Failed to request permissions: ' + (err as Error).message);
        return false;
      }
    }
    console.log('[DEBUG] Not on Android, skipping permission requests');
    return true;
  }, []);

  // Check WifiManager availability on component mount
  useEffect(() => {
    const checkWifiManager = () => {
      const available = isWifiManagerAvailable();
      console.log('[DEBUG] WifiManager available:', available);
      setIsWifiManagerNull(!available);
      
      if (!available) {
        console.log('[DEBUG] WifiManager is null or not properly linked');
        setError('Wi-Fi scanning not available. The native module may not be properly linked.');
      }
    };
    
    checkWifiManager();
  }, []);

  // Initialize Wi-Fi
  const initializeWifi = useCallback(async () => {
    console.log('[DEBUG] Initializing Wi-Fi');
    
    if (!isWifiManagerAvailable()) {
      console.log('[DEBUG] Cannot initialize Wi-Fi: WifiManager is null');
      return false;
    }
    
    if (Platform.OS === 'android') {
      try {
        const isEnabled = await WifiManager.isEnabled();
        console.log('[DEBUG] Wi-Fi enabled status:', isEnabled);
        setIsWifiEnabled(isEnabled);

        if (!isEnabled) {
          console.log('[DEBUG] Wi-Fi is disabled. Prompting user to enable Wi-Fi.');
          setError('Wi-Fi is disabled. Please enable Wi-Fi to proceed.');
          // Open Wi-Fi settings using Linking
          const supported = await Linking.canOpenURL('android.settings.WIFI_SETTINGS');
          if (supported) {
            await Linking.openURL('android.settings.WIFI_SETTINGS');
          } else {
            setError('Unable to open Wi-Fi settings. Please enable Wi-Fi manually.');
          }
          return false;
        }
        return true;
      } catch (err) {
        const error = err as Error;
        console.error('[DEBUG] Error initializing Wi-Fi:', error.message);
        setError('Failed to initialize Wi-Fi: ' + error.message);
        return false;
      }
    }
    console.log('[DEBUG] Not on Android, skipping Wi-Fi initialization');
    return true;
  }, []);

  // Monitor Wi-Fi state changes
  useEffect(() => {
    if (!isWifiManagerAvailable()) {
      console.log('[DEBUG] Cannot monitor Wi-Fi: WifiManager is null');
      return;
    }
    
    const checkWifiStatus = async () => {
      if (Platform.OS === 'android') {
        try {
          const isEnabled = await WifiManager.isEnabled();
          setIsWifiEnabled(isEnabled);
          if (!isEnabled) {
            setError('Wi-Fi is disabled. Please enable Wi-Fi to proceed.');
          }
        } catch (err) {
          console.error('[DEBUG] Error checking Wi-Fi status:', err);
        }
      }
    };

    checkWifiStatus();
    const intervalId = setInterval(checkWifiStatus, 5000); // Check every 5 seconds
    return () => clearInterval(intervalId);
  }, []);

  // Wi-Fi scanning with proper error handling
  const scanWifi = useCallback(async () => {
    console.log('[DEBUG] Starting Wi-Fi scan...');
    
    if (!isWifiManagerAvailable()) {
      console.log('[DEBUG] Cannot scan Wi-Fi: WifiManager is null');
      return null;
    }
    
    if (!hasPermissions) {
      console.log('[DEBUG] Skipping Wi-Fi scan: No permissions');
      return null;
    }
    
    if (!isWifiEnabled) {
      console.log('[DEBUG] Skipping Wi-Fi scan: Wi-Fi not enabled');
      return null;
    }

    try {
      console.log('[DEBUG] Calling WifiManager.loadWifiList()');
      const wifiEntries = await WifiManager.loadWifiList() as WifiEntry[];
      console.log('[DEBUG] Wi-Fi scan results count:', wifiEntries?.length || 0);
      
      if (!wifiEntries || wifiEntries.length === 0) {
        console.warn('[DEBUG] No Wi-Fi networks found in scan');
        return null;
      }

      const networksToLog = wifiEntries.slice(0, 3);
      networksToLog.forEach((network, index) => {
        console.log(`[DEBUG] Network ${index + 1}:`, {
          BSSID: network.BSSID,
          SSID: network.SSID,
          level: network.level,
        });
      });

      const scanResults: WifiScanResult[] = wifiEntries.map(entry => ({
        BSSID: entry.BSSID,
        RSSI: entry.level
      }));

      console.log('[DEBUG] Calculating position from scan results');
      const newPosition = calculatePosition(scanResults);
      console.log('[DEBUG] Calculated position:', newPosition);
      return newPosition;
    } catch (err) {
      const error = err as Error;
      console.error('[DEBUG] Wi-Fi scanning error:', error.message, error.stack);
      setError('Failed to scan Wi-Fi networks: ' + error.message);
      return null;
    }
  }, [hasPermissions, isWifiEnabled, calculatePosition]);

  // Update setup effect to check for WifiManager availability first
  useEffect(() => {
    const setup = async () => {
      console.log('[DEBUG] Starting setup process');
      
      // First check if WifiManager is available
      const wifiManagerAvailable = isWifiManagerAvailable();
      setIsWifiManagerNull(!wifiManagerAvailable);
      
      if (!wifiManagerAvailable) {
        console.log('[DEBUG] WifiManager is not available, setting up manual mode');
        setManualMode(true);
        // Make the error message more informative for Expo Go users
        setError('Wi-Fi scanning module is not available in Expo Go. Manual mode is enabled for testing. For full functionality, build the app using Expo Dev Client.');
        // Initialize app regardless of WifiManager availability
        console.log('[DEBUG] App initialized');
        return;
      }
      
      try {
        // Then check permissions
        const hasPerms = await checkAndRequestPermissions();
        if (!hasPerms) {
          console.log('[DEBUG] Permissions not granted');
          return;
        }
        
        // Then initialize Wi-Fi
        const wifiReady = await initializeWifi();
        if (!wifiReady) {
          console.log('[DEBUG] Wi-Fi is not ready');
          setError('Wi-Fi is not enabled. Please enable Wi-Fi to proceed.');
        } else {
          console.log('[DEBUG] Setup completed successfully');
          // Clear any previous errors if setup is successful
          setError('');
        }
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error('An unknown error occurred');
        console.error('[DEBUG] Setup error:', error.message);
        setError(error.message);
      }
    };

    setup();
  }, [checkAndRequestPermissions, initializeWifi]);

  // Wi-Fi scanning effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const startScanning = async () => {
      if (!hasPermissions || !isWifiEnabled) {
        return;
      }

      const newPosition = await scanWifi();
      if (newPosition) {
        setUserPosition(newPosition);
        checkGeofence(newPosition);
      }
    };

    if (hasPermissions && isWifiEnabled) {
      startScanning(); // Run immediately
      intervalId = setInterval(startScanning, SCAN_INTERVAL);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [hasPermissions, isWifiEnabled, scanWifi, checkGeofence]);

  // Find path
  const findPath = async () => {
    if (!selectedProduct) return;

    try {
      setError('');
      const response = await axios.post(`${API_URL}/api/navigation/find-path`, {
        start: userPosition,
        end: selectedProduct.coordinates
      });
      setPath(response.data.path);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred');
      console.error('Error:', error.message);
      setError(error.message);
    }
  };

  // Manual position update function
  const updatePositionManually = () => {
    if (tempX >= 0 && tempX < GRID_SIZE && tempY >= 0 && tempY < GRID_SIZE && grid[tempY][tempX] === 0) {
      console.log('[DEBUG] Setting position manually:', { x: tempX, y: tempY });
      setUserPosition({ x: tempX, y: tempY });
      checkGeofence({ x: tempX, y: tempY });
    } else {
      console.log('[DEBUG] Invalid manual position:', { x: tempX, y: tempY });
      Alert.alert('Invalid Position', 'The selected position is invalid or not walkable.');
    }
  };

  // Add a location refresh button for manual testing
  const refreshLocation = async () => {
    if (isWifiManagerNull || manualMode) {
      console.log('[DEBUG] In manual mode, not refreshing location');
      return;
    }
    
    console.log('[DEBUG] Manually refreshing location');
    const newPosition = await scanWifi();
    if (newPosition) {
      setUserPosition(newPosition);
      checkGeofence(newPosition);
      console.log('[DEBUG] Location updated:', newPosition);
    } else {
      console.log('[DEBUG] Failed to update location');
      Alert.alert('Location Update Failed', 'Could not determine your position from Wi-Fi signals.');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#4c669f', '#3b5998']}
        style={styles.gradientBackground}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* Current Location Information Panel */}
            <View style={styles.locationInfoContainer}>
              <Text style={styles.locationTitle}>Current Location</Text>
              <Text style={styles.locationText}>
                Grid Position: X: {userPosition.x}, Y: {userPosition.y}
              </Text>
              {currentGeofence ? (
                <Text style={styles.locationText}>
                  You are in: {currentGeofence}
                </Text>
              ) : (
                <Text style={styles.locationText}>
                  You are not in any specific area
                </Text>
              )}
              
              {!manualMode && !isWifiManagerNull && (
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={refreshLocation}
                >
                  <Text style={styles.buttonText}>Refresh Location</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* Status Information */}
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>
                Permissions: {hasPermissions ? '✅ Granted' : '❌ Missing'}
              </Text>
              <Text style={styles.statusText}>
                Wi-Fi: {isWifiEnabled ? '✅ Enabled' : '❌ Disabled'}
              </Text>
              <Text style={styles.statusText}>
                Network: {isOnline ? '✅ Online' : '❌ Offline'}
              </Text>
              <Text style={styles.statusText}>
                Wi-Fi Module: {isWifiManagerNull ? '❌ Not Available' : '✅ Available'}
              </Text>
            </View>

            {!hasPermissions && (
              <View>
                <TouchableOpacity
                  style={styles.button}
                  onPress={checkAndRequestPermissions}
                >
                  <Text style={styles.buttonText}>Grant Permissions</Text>
                </TouchableOpacity>
                <Text style={styles.helpText}>
                  This button will request the necessary permissions for Wi-Fi scanning and location access.
                  These permissions are required to determine your position within the building based on Wi-Fi signals.
                </Text>
              </View>
            )}

            {!isWifiEnabled && hasPermissions && (
              <View>
                <TouchableOpacity
                  style={styles.button}
                  onPress={initializeWifi}
                >
                  <Text style={styles.buttonText}>Enable Wi-Fi</Text>
                </TouchableOpacity>
                <Text style={styles.helpText}>
                  Wi-Fi is required to scan for networks and determine your position. Please enable Wi-Fi in the settings.
                </Text>
              </View>
            )}

            {isWifiManagerNull && (
              <View style={styles.errorContainer}>
                <Text style={styles.error}>
                  Wi-Fi scanning is not available in Expo Go. For full functionality, please use a development build.
                </Text>
                <Text style={styles.helpText}>
                  Manual mode is enabled for testing. You can use the position input below to simulate movement.
                </Text>
                <View style={styles.manualInputContainer}>
                  <Text style={styles.label}>X Position:</Text>
                  <TextInput
                    style={styles.input}
                    value={tempX.toString()}
                    onChangeText={value => setTempX(Number(value))}
                    keyboardType="numeric"
                  />
                  <Text style={styles.label}>Y Position:</Text>
                  <TextInput
                    style={styles.input}
                    value={tempY.toString()}
                    onChangeText={value => setTempY(Number(value))}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={styles.button}
                    onPress={() => {
                      setUserPosition({ x: tempX, y: tempY });
                      console.log('[DEBUG] Manual position set to:', { x: tempX, y: tempY });
                    }}
                  >
                    <Text style={styles.buttonText}>Set Position</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.error}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    setError('');
                    checkAndRequestPermissions();
                  }}
                >
                  <Text style={styles.buttonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            <Picker
              selectedValue={selectedProduct?.name || ''}
              style={styles.picker}
              onValueChange={(itemValue) => {
                const product = products.find(p => p.name === itemValue);
                setSelectedProduct(product || null);
              }}
            >
              <Picker.Item label="Select a product..." value="" />
              {products.map(product => (
                <Picker.Item
                  key={product.name}
                  label={`${product.name} (${product.aisle})`}
                  value={product.name}
                />
              ))}
            </Picker>

            {selectedProduct && (
              <View style={styles.productInfo}>
                <Text style={styles.text}>
                  Selected: {selectedProduct.name} in {selectedProduct.aisle}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.button,
                (!isOnline || !selectedProduct || !hasPermissions || !isWifiEnabled) && styles.buttonDisabled
              ]}
              onPress={findPath}
              disabled={!isOnline || !selectedProduct || !hasPermissions || !isWifiEnabled}
            >
              <Text style={styles.buttonText}>Find Path</Text>
            </TouchableOpacity>

            {!isWifiManagerNull && (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: manualMode ? '#FF9800' : '#2196F3' }]}
                onPress={() => setManualMode(!manualMode)}
              >
                <Text style={styles.buttonText}>
                  {manualMode ? 'Switch to Automatic Mode' : 'Switch to Manual Mode'}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.mapContainer}>
              <Svg width={BOARD_SIZE} height={BOARD_SIZE} style={styles.map}>
                {grid.map((row, y) =>
                  row.map((cell, x) => (
                    <Rect
                      key={`${x}-${y}`}
                      x={x * CELL_SIZE}
                      y={y * CELL_SIZE}
                      width={CELL_SIZE}
                      height={CELL_SIZE}
                      fill={cell === 1 ? '#808080' : 'transparent'}
                      stroke="#ccc"
                      strokeWidth="1"
                    />
                  ))
                )}

                {geofences.map((fence, index) => (
                  <Rect
                    key={fence.label}
                    x={fence.bounds.minX * CELL_SIZE}
                    y={fence.bounds.minY * CELL_SIZE}
                    width={(fence.bounds.maxX - fence.bounds.minX + 1) * CELL_SIZE}
                    height={(fence.bounds.maxY - fence.bounds.minY + 1) * CELL_SIZE}
                    fill="rgba(0, 0, 255, 0.2)"
                  />
                ))}

                {path.map((point, index) => {
                  if (index < path.length - 1) {
                    return (
                      <Line
                        key={`path-${index}`}
                        x1={(point[0] + 0.5) * CELL_SIZE}
                        y1={(point[1] + 0.5) * CELL_SIZE}
                        x2={(path[index + 1][0] + 0.5) * CELL_SIZE}
                        y2={(path[index + 1][1] + 0.5) * CELL_SIZE}
                        stroke="blue"
                        strokeWidth="2"
                      />
                    );
                  }
                  return null;
                })}

                <Rect
                  x={userPosition.x * CELL_SIZE + 5}
                  y={userPosition.y * CELL_SIZE + 5}
                  width={CELL_SIZE - 10}
                  height={CELL_SIZE - 10}
                  fill="yellow"
                />

                {selectedProduct && (
                  <Rect
                    x={selectedProduct.coordinates.x * CELL_SIZE + 5}
                    y={selectedProduct.coordinates.y * CELL_SIZE + 5}
                    width={CELL_SIZE - 10}
                    height={CELL_SIZE - 10}
                    fill="red"
                  />
                )}
              </Svg>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  picker: {
    width: '100%',
    backgroundColor: 'white',
    marginBottom: 20,
  },
  productInfo: {
    marginBottom: 20,
  },
  text: {
    color: 'white',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
    width: '100%',
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
    alignItems: 'center',
  },
  error: {
    color: 'red',
    marginBottom: 20,
  },
  mapContainer: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  map: {
    backgroundColor: 'white',
  },
  locationInfoContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
  },
  locationTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  locationText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 5,
  },
  statusContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 5,
  },
  helpText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: -15,
    marginBottom: 20,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 5,
  },
  manualInputContainer: {
    marginTop: 10,
    marginBottom: 20,
    width: '100%',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
  },
  label: {
    color: '#333',
    fontSize: 16,
    marginBottom: 5,
    fontWeight: '500',
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 4,
    marginBottom: 10,
    paddingHorizontal: 10,
    backgroundColor: 'white',
  },
  refreshButton: {
    backgroundColor: '#009688',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
    alignItems: 'center',
  },
});