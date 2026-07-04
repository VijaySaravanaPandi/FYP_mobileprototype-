# SignAvatar — ISL Sign Language to 3D Avatar (Mobile App)

Convert Indian Sign Language (ISL) videos into animated 3D sign-language avatars on mobile devices.

## Architecture

```
┌───────────────────────────────┐                             ┌───────────────────┐
│  Mobile App (Expo/React Native)│    POST /api/process-video  │   Backend         │
│  ┌──────────────────────────┐ │  ─────────────────────────▶ │   (FastAPI)       │
│  │   WebView (Three.js)     │ │                             │   + MediaPipe     │
│  │   3D Avatar Rendering    │ │  ◀───────────────────────── │   + OpenCV        │
│  └──────────────────────────┘ │     JSON landmark data      └───────────────────┘
└───────────────────────────────┘
```

*   **Input** → Sign language video (MP4, WebM, AVI, MOV) uploaded from the phone's gallery.
*   **Processing** → MediaPipe Holistic extracts body and hand landmarks per frame on the Python FastAPI server.
*   **Output** → Animated 3D humanoid avatar mirroring the signer's movements inside a WebView using Three.js.

## Getting Started

### 1. Start the Backend Server

```bash
# Navigate to backend directory
cd backend

# Create & activate a virtual environment (optional but recommended)
python -m venv venv
.\venv\Scripts\activate  # On Windows

# Install Python dependencies
pip install -r requirements.txt

# Start the FastAPI server
python app.py
```
*Alternatively, you can run the `start.bat` script in the project root to start the backend.*

### 2. Start the Mobile Client (Expo)

Make sure you have Node.js installed.

```bash
# Navigate to frontend directory
cd frontend

# Install JavaScript dependencies
npm install

# Start the Expo development server
npx expo start
```
*Alternatively, you can run the `start_mobile.bat` script in the project root to start the Expo dev server.*

### 3. Connect and Test

1. Ensure both your computer running the backend and your mobile device running **Expo Go** are connected to the same Wi-Fi network.
2. Find your local IP address (LAN IP) by running `ipconfig` on Windows or `ifconfig` on macOS/Linux.
3. Launch the mobile app by scanning the QR code displayed in the Expo CLI with your phone's camera (iOS) or the Expo Go app (Android).
4. In the app settings (accessible via the settings gear icon), update the **Backend URL** to point to your backend's LAN IP (e.g., `http://192.168.1.100:8000`).
5. Process a test video or launch the **Demo Mode** to watch the animated 3D avatar mirror sign language movements.

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Backend  | Python, FastAPI, MediaPipe, OpenCV |
| Frontend | React Native, Expo, TypeScript    |
| 3D       | Three.js inside WebView           |

## Project Structure

```
├── backend/
│   ├── app.py                  # FastAPI server + demo data generator
│   ├── requirements.txt        # Python dependencies
│   └── processing/
│       ├── __init__.py
│       └── pose_extractor.py   # MediaPipe Holistic landmark extraction
├── frontend/
│   ├── App.tsx                 # Main React Native Application screen
│   ├── app.json                # Expo config
│   ├── package.json            # npm dependencies and scripts
│   └── assets/
│       └── avatar_view.html    # Three.js 3D avatar viewport loaded in WebView
├── start.bat                   # Batch script to launch backend
├── start_mobile.bat            # Batch script to launch Expo dev server
└── README.md
```
