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

## Detailed Step-by-Step Running Guide (Windows PowerShell)

Follow these exact steps to launch and connect both the backend and frontend components.

### Step 1: Find Your Computer's LAN IP Address
Since your phone needs to connect to the backend server running on your computer, both devices must be on the **same Wi-Fi network**.
1. Open a PowerShell or Command Prompt window.
2. Type the following command and press Enter:
   ```powershell
   ipconfig
   ```
3. Locate the **IPv4 Address** under your active network adapter (e.g., `192.168.1.17`). Note this down.

---

### Step 2: Open the Project Directory
Open **two separate** PowerShell terminal windows. In both windows, navigate to the folder where you saved this project.

*Example command (replace the path below with the path where you saved the project on your laptop):*
```powershell
cd "C:\path\to\your\folder\FYP_mobileprototype-"
```
> [!TIP]
> **Shortcut:** You can also open the project folder in VS Code, and open two terminals inside VS Code. They will automatically open in the correct folder!

---

### Step 3: Run the Backend Server
1. In the **first** PowerShell window (navigated to the project folder), run:
   ```powershell
   .\start.bat
   ```
   *(Keep this terminal open and running. The backend API server starts on port `8000`)*.

---

### Step 4: Run the Mobile Dev Server (Expo)
1. In the **second** PowerShell window (navigated to the project folder), run:
   ```powershell
   .\start_mobile.bat
   ```
   *(Keep this terminal open and running. It will start the Expo dev server and display a QR code)*.

---

### Step 5: Launch and Configure the Mobile App
1. Install the **Expo Go** app on your phone (from Google Play Store or iOS App Store).
2. Open Expo Go (or your camera app on iOS) and scan the QR code displayed in the second PowerShell terminal.
3. Once the app loads on your phone:
   * Tap the **Settings gear icon** in the top-right corner.
   * Update the **Backend URL** field to point to your computer's LAN IP using port `8000` (e.g., using the IP you found in Step 1):
     ```
     http://<YOUR_LAN_IP>:8000
     ```
     *(Example: `http://192.168.1.17:8000`)*
   * Save settings and return to the main screen.
4. Try the **Demo Mode** or upload a video from your gallery to view the 3D sign-language avatar.

---

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
