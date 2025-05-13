# Indoor Navigation App

A React Native app for indoor navigation using Wi-Fi RSSI positioning. The app helps users find products in a store by showing the shortest path on a map.

## Features

- Real-time user position tracking using Wi-Fi RSSI
- Product selection from a dropdown menu
- Visual map with obstacles, aisles, and geofences
- Shortest path calculation to selected products
- Geofence alerts when entering/exiting areas
- Beautiful UI with gradient background and shadows

## Prerequisites

- Node.js 14+
- Android Studio (for Android development)
- Physical Android device (Wi-Fi scanning doesn't work in emulators)
- Expo CLI (`npm install -g expo-cli`)

## Installation

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
node server.js
```

The server will run on http://localhost:5000.

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd indoor-navigation-app
```

2. Install dependencies:
```bash
npm install
```

3. Update Wi-Fi Access Point MAC addresses:
Edit `src/constants/store.ts` and update the `accessPoints` array with your actual Wi-Fi access point MAC addresses.

4. Build and run on Android:
```bash
npx expo prebuild --clean
npx expo run:android
```

## Required Permissions

The app requires the following Android permissions:
- ACCESS_FINE_LOCATION
- NEARBY_WIFI_DEVICES
- ACCESS_WIFI_STATE
- CHANGE_WIFI_STATE

These permissions will be requested automatically when the app starts.

## Development Notes

- The app uses a 10x10 grid system for the store layout
- Wi-Fi scanning occurs every 2 seconds
- Position is calculated using trilateration and weighted averages
- The pathfinding algorithm uses A* search
- Geofences are defined for different store areas

## Troubleshooting

1. If Wi-Fi scanning fails:
   - Ensure all permissions are granted
   - Check that you're using a physical device
   - Verify Wi-Fi is enabled

2. If pathfinding fails:
   - Check backend server is running
   - Verify network connectivity
   - Ensure start and end positions are walkable

## License

MIT "# indoor_navigation" 
"# indoor_navigation" 
