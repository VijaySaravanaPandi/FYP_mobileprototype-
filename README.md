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

---

## Quick Start Running Guide (Windows PowerShell)

Follow these exact steps to set up and launch both the backend and frontend components.

### Step 1: Run the Backend Server
Open a **new PowerShell window** and run the following commands:
```powershell
# Navigate to the project directory
cd "C:\Users\vijay\OneDrive\Desktop\project4\FYP_mobileprototype-"

# Create a virtual environment (only needed the first time)
python -m venv venv

# Install backend dependencies (only needed the first time)
.\venv\Scripts\pip install -r backend\requirements.txt

# Start the backend server
.\start.bat
```
*(Keep this terminal open. The backend API server will start on http://localhost:8000)*

---

### Step 2: Run the Mobile App (Expo Dev Server)
Open a **second PowerShell window** and run:
```powershell
# Navigate to the project directory
cd "C:\Users\vijay\OneDrive\Desktop\project4\FYP_mobileprototype-"

# Install frontend dependencies (only needed the first time)
cd frontend
npm install
cd ..

# Start the Expo development server in offline mode
.\start_mobile.bat
```
*(Keep this terminal open. It will launch the Metro Bundler and display a QR code in the terminal).*

---

### Step 3: Launch and Connect the App
1. Install the **Expo Go** app on your mobile device (available on Google Play Store and iOS App Store).
2. Ensure both your computer and your phone are connected to the **same Wi-Fi network**.
3. Scan the QR code displayed in the second PowerShell terminal using Expo Go.
4. Once the app loads on your phone:
   * Tap the **Settings gear icon** in the top-right corner.
   * Update the **Backend URL** field to point to your computer's LAN IP address using port `8000` (e.g. `http://192.168.1.17:8000`).
   * Save settings and start using the app!

---

## Troubleshooting & Common Errors

### 1. Processing Error: `libGLESv2.so.2: cannot open shared object file`
* **Why it happens:** This occurs when connecting to the online Render server (`https://signavatar-backend.onrender.com`). Render's standard Linux environment lacks the necessary GPU/OpenGL libraries required by MediaPipe.
* **Solution:** Run the backend locally on your computer instead (using **Step 1** above) and point the mobile app to your local computer's IP address (e.g., `http://192.168.1.17:8000`).

### 2. Command Error: `Interactive prompt was cancelled`
* **Why it happens:** When running Expo, it may prompt you to log in. In non-interactive environments, this prompt cancels and crashes the server.
* **Solution:** The project's mobile runner has been updated to use `--offline` mode automatically (`npx expo start --offline`), which skips the login prompt and starts Metro instantly.

### 3. Tunnel Error: `failed to start tunnel / remote gone away`
* **Why it happens:** The Ngrok tunnel service is blocked by your ISP, firewall, or is experiencing outages.
* **Solution:** Use the default LAN/offline connection. Make sure both your phone and computer are on the same Wi-Fi network and connect directly using your computer's LAN IP.

---

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
├── start_mobile.bat            # Batch script to launch Expo dev server (offline)
└── README.md
```
