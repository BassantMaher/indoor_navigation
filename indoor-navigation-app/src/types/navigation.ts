export interface Coordinates {
  x: number;
  y: number;
}

export interface AccessPoint {
  x: number;
  y: number;
  mac: string;
}

export interface Product {
  name: string;
  aisle: string;
  coordinates: Coordinates;
}

export interface GeofenceBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Geofence {
  label: string;
  bounds: GeofenceBounds;
}

export interface WifiScanResult {
  BSSID: string;
  RSSI: number;
}

export interface PathfindingResponse {
  path: number[][];
  error?: string;
} 