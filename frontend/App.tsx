import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  StatusBar,
  LogBox,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import Slider from '@react-native-community/slider';
import { AVATAR_HTML } from './assets/avatar_view_html';

LogBox.ignoreLogs([
  /Method uploadAsync/,
  /Method readAsStringAsync/,
  /ImagePicker\.MediaTypeOptions/,
]);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Default API URL (Fallback to standard localhost/LAN IP format)
const DEFAULT_API_URL = 'http://10.219.243.115:8000';

export default function App() {
  // Navigation & General state
  const [currentScreen, setCurrentScreen] = useState<'UPLOAD' | 'PROCESSING' | 'RESULT'>('UPLOAD');
  const [backendUrl, setBackendUrl] = useState(DEFAULT_API_URL);
  const [showSettings, setShowSettings] = useState(false);

  // File Picker states
  const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<{
    uri: string;
    name: string;
    type: string;
    size: number;
  } | null>(null);

  // Loading/Processing states
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingDetail, setProcessingDetail] = useState('');

  // Results & Playback states
  const [landmarkData, setLandmarkData] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isMirrored, setIsMirrored] = useState(false);
  const [showVideoPanel, setShowVideoPanel] = useState(true);

  // Statistics
  const [stats, setStats] = useState({
    frames: 0,
    fps: 30,
    duration: 0,
    landmarksPerFrame: 0,
  });

  // WebView reference
  const webViewRef = useRef<WebView>(null);
  
  const player = useVideoPlayer(selectedVideoUri || null, (player) => {
    player.loop = true;
    player.muted = true;
  });

  // HTML content loaded via TS literal

  // Post messages to WebView
  const sendToWebView = (msg: any) => {
    if (webViewRef.current) {
      const msgStr = JSON.stringify(msg);
      const jsCode = `
        try {
          var event = new MessageEvent('message', { data: '${msgStr}' });
          window.dispatchEvent(event);
          document.dispatchEvent(event);
        } catch (e) {}
        true;
      `;
      webViewRef.current.injectJavaScript(jsCode);
    }
  };

  // Synchronise play/pause from React Native controls
  useEffect(() => {
    if (currentScreen === 'RESULT') {
      sendToWebView({ type: isPlaying ? 'PLAY' : 'PAUSE' });
      
      // Video synchronization
      if (player) {
        if (isPlaying) {
          player.play();
        } else {
          player.pause();
        }
      }
    }
  }, [isPlaying, currentScreen, player]);

  // Synchronise speed
  useEffect(() => {
    if (currentScreen === 'RESULT') {
      sendToWebView({ type: 'SPEED', speed: playbackSpeed });
      if (player) {
        player.playbackRate = playbackSpeed;
      }
    }
  }, [playbackSpeed, currentScreen, player]);

  // Synchronise mirror
  useEffect(() => {
    if (currentScreen === 'RESULT') {
      sendToWebView({ type: 'MIRROR', mirror: isMirrored });
    }
  }, [isMirrored, currentScreen]);

  // Request media picker
  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'SignAvatar needs access to your gallery to load videos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'Videos' as any,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setSelectedVideoUri(asset.uri);
      setSelectedVideoFile({
        uri: asset.uri,
        name: asset.fileName || 'sign_video.mp4',
        type: asset.mimeType || 'video/mp4',
        size: asset.fileSize || 0,
      });
    }
  };

  // Process Video upload
  const handleUploadVideo = async () => {
    if (!selectedVideoFile) {
      Alert.alert('No Video Selected', 'Please select a sign-language video first.');
      return;
    }

    setProcessingProgress(0.15);
    setProcessingDetail('Uploading video file...');
    setCurrentScreen('PROCESSING');

    try {
      setProcessingProgress(0.4);
      setProcessingDetail('Sending file to server for processing...');

      const uploadResponse = await FileSystem.uploadAsync(`${backendUrl}/api/process-video`, selectedVideoFile.uri, {
        fieldName: 'video',
        httpMethod: 'POST',
        uploadType: 1 as any,
        mimeType: selectedVideoFile.type || 'video/mp4',
        headers: {
          'Accept': 'application/json',
        },
      });

      setProcessingProgress(0.8);
      setProcessingDetail('Extracting MediaPipe body & hand landmarks...');

      if (uploadResponse.status !== 200) {
        let errMessage = 'Failed to process video on backend';
        try {
          const parsed = JSON.parse(uploadResponse.body);
          if (parsed.detail) errMessage = parsed.detail;
        } catch(e) {}
        throw new Error(errMessage);
      }

      const landmarkData = JSON.parse(uploadResponse.body);
      setProcessingProgress(1.0);
      setProcessingDetail('Done!');

      setTimeout(() => {
        setupPlayback(landmarkData, selectedVideoFile.uri);
      }, 500);

    } catch (err: any) {
      console.error(err);
      Alert.alert('Processing Error', err.message || 'An error occurred during landmark extraction.');
      setCurrentScreen('UPLOAD');
    }
  };

  // Process Demo data loading
  const handleLoadDemo = async () => {
    setProcessingProgress(0.35);
    setProcessingDetail('Downloading demo landmark data...');
    setCurrentScreen('PROCESSING');

    try {
      const response = await fetch(`${backendUrl}/api/demo-data`);
      if (!response.ok) {
        throw new Error('Could not fetch demo data from backend');
      }

      const data = await response.json();
      setProcessingProgress(1.0);
      setProcessingDetail('Ready!');

      setTimeout(() => {
        setupPlayback(data, null);
      }, 500);

    } catch (err: any) {
      console.error(err);
      Alert.alert('Demo Error', err.message || 'Could not connect to FastAPI server.');
      setCurrentScreen('UPLOAD');
    }
  };

  // Playback configuration
  const setupPlayback = (data: any, videoUri: string | null) => {
    setLandmarkData(data);
    setSelectedVideoUri(videoUri);
    setCurrentFrame(0);
    setTotalFrames(data.total_frames);
    setPlaybackSpeed(1.0);
    setIsMirrored(false);
    setIsPlaying(true);

    const duration = data.total_frames / (data.fps || 30);
    let avgLandmarks = 0;
    let counted = 0;
    for (const f of data.frames) {
      let count = 0;
      if (f.pose) count += f.pose.length;
      if (f.left_hand) count += f.left_hand.length;
      if (f.right_hand) count += f.right_hand.length;
      avgLandmarks += count;
      counted++;
    }

    setStats({
      frames: data.total_frames,
      fps: Math.round(data.fps || 30),
      duration: duration,
      landmarksPerFrame: counted > 0 ? Math.round(avgLandmarks / counted) : 75,
    });

    setCurrentScreen('RESULT');
  };

  // WebView Event bridge
  const onWebViewMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'FRAME_CHANGE') {
        setCurrentFrame(message.frame);
      }
    } catch (err) {
      // Non-json logs
    }
  };

  // Load landmark data on WebView load
  const onWebViewLoad = () => {
    if (landmarkData) {
      sendToWebView({ type: 'LOAD_DATA', data: landmarkData });
      sendToWebView({ type: 'PLAY' });
    }
  };

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Navigate back to upload screen
  const handleReset = () => {
    if (player) {
      player.pause();
    }
    setLandmarkData(null);
    setSelectedVideoUri(null);
    setSelectedVideoFile(null);
    setIsPlaying(false);
    setCurrentFrame(0);
    setCurrentScreen('UPLOAD');
  };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#06060f" />
      
      {/* ================= HEADER ================= */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <MaterialCommunityIcons name="human-handsdown" size={28} color="#00e5ff" />
          <Text style={styles.logoText}>Sign<Text style={styles.accentText}>Avatar</Text></Text>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettings(!showSettings)}>
          <Ionicons name={showSettings ? "close" : "settings-outline"} size={22} color="#a0a8c8" />
        </TouchableOpacity>
      </View>

      {/* ================= SETTINGS COLLAPSIBLE ================= */}
      {showSettings && (
        <View style={[styles.glassCard, styles.settingsCard]}>
          <Text style={styles.settingsTitle}>Server Settings</Text>
          <Text style={styles.settingsLabel}>FastAPI Backend Address</Text>
          <View style={styles.settingsInputRow}>
            <TextInput
              style={styles.settingsInput}
              value={backendUrl}
              onChangeText={setBackendUrl}
              placeholder="e.g. http://192.168.1.100:8000"
              placeholderTextColor="#5c6488"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={() => setShowSettings(false)}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.settingsNotice}>
            * Ensure the backend server is active and accessible on your local network (Wi-Fi).
          </Text>
        </View>
      )}

      {/* ================= MAIN CONTAINER ================= */}
      <View style={styles.mainContainer}>

        {/* SCREEN 1: UPLOAD & SETUP */}
        {currentScreen === 'UPLOAD' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={[styles.glassCard, styles.uploadCard]}>
              <TouchableOpacity style={styles.dropZone} onPress={pickVideo}>
                <Ionicons name="cloud-upload-outline" size={60} color="#00e5ff" />
                <Text style={styles.dropZoneTitle}>Select Sign Language Video</Text>
                <Text style={styles.dropZoneSubtitle}>Tap to browse your device files</Text>
                <Text style={styles.dropZoneFormats}>Supports MP4, WebM, AVI, MOV</Text>
              </TouchableOpacity>

              {selectedVideoFile && (
                <View style={styles.fileDetailsRow}>
                  <Ionicons name="videocam-outline" size={24} color="#eef0fa" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.fileName} numberOfLines={1}>{selectedVideoFile.name}</Text>
                    <Text style={styles.fileSize}>{(selectedVideoFile.size / 1024 / 1024).toFixed(1)} MB</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedVideoFile(null)}>
                    <Ionicons name="trash-outline" size={20} color="#ff3d71" />
                  </TouchableOpacity>
                </View>
              )}

              {selectedVideoFile ? (
                <TouchableOpacity style={styles.primaryActionBtn} onPress={handleUploadVideo}>
                  <Text style={styles.primaryActionBtnText}>Extract 3D Avatar</Text>
                  <Ionicons name="arrow-forward-outline" size={18} color="#06060f" />
                </TouchableOpacity>
              ) : (
                <View style={styles.demoGroup}>
                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>
                  <TouchableOpacity style={styles.secondaryActionBtn} onPress={handleLoadDemo}>
                    <Ionicons name="play-circle-outline" size={20} color="#7c4dff" style={{ marginRight: 6 }} />
                    <Text style={styles.secondaryActionBtnText}>Try Demo Avatar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {/* SCREEN 2: PROCESSING */}
        {currentScreen === 'PROCESSING' && (
          <View style={styles.centerContainer}>
            <View style={[styles.glassCard, styles.processingCard]}>
              <ActivityIndicator size="large" color="#00e5ff" style={{ marginBottom: 20 }} />
              <Text style={styles.processingTitle}>Processing landmarks...</Text>
              <Text style={styles.processingSubtitle}>{processingDetail}</Text>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${processingProgress * 100}%` }]} />
              </View>
            </View>
          </View>
        )}

        {/* SCREEN 3: RESULT DASHBOARD */}
        {currentScreen === 'RESULT' && (
          <View style={styles.resultContainer}>
            
            {/* Top Collapsible Video Panel */}
            {selectedVideoUri && showVideoPanel && (
              <View style={styles.videoPanelContainer}>
                <View style={styles.panelTitleBar}>
                  <Text style={styles.panelBadge}>INPUT VIDEO</Text>
                  <TouchableOpacity onPress={() => setShowVideoPanel(false)}>
                    <Ionicons name="eye-off-outline" size={18} color="#a0a8c8" />
                  </TouchableOpacity>
                </View>
                {player && (
                  <VideoView
                    player={player}
                    style={styles.nativeVideo}
                    contentFit="contain"
                    nativeControls={false}
                  />
                )}
              </View>
            )}

            {/* Video show toggle button if collapsed */}
            {selectedVideoUri && !showVideoPanel && (
              <TouchableOpacity style={styles.showVideoFloatingBtn} onPress={() => setShowVideoPanel(true)}>
                <Ionicons name="eye-outline" size={16} color="#00e5ff" />
                <Text style={styles.showVideoFloatingText}>Show Input Video</Text>
              </TouchableOpacity>
            )}

            {/* 3D Avatar Viewport */}
            <View style={styles.avatarPanelContainer}>
              <View style={styles.panelTitleBar}>
                <Text style={[styles.panelBadge, styles.accentBadge]}>3D AVATAR RECONSTRUCTION</Text>
              </View>
              <View style={styles.avatarCanvasWrapper}>
                  <WebView
                    ref={webViewRef}
                    originWhitelist={['*']}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    allowFileAccess={true}
                    allowFileAccessFromFileURLs={true}
                    allowUniversalAccessFromFileURLs={true}
                    onMessage={onWebViewMessage}
                    onLoad={onWebViewLoad}
                    source={{ html: AVATAR_HTML }}
                    style={styles.webViewAvatar}
                  />
              </View>
            </View>

            {/* Timeline Slider */}
            <View style={styles.sliderSection}>
              <Slider
                style={styles.timelineSlider}
                minimumValue={0}
                maximumValue={totalFrames - 1}
                value={currentFrame}
                minimumTrackTintColor="#00e5ff"
                maximumTrackTintColor="rgba(255, 255, 255, 0.15)"
                thumbTintColor="#00e5ff"
                onValueChange={(val) => {
                  sendToWebView({ type: 'SEEK', frame: Math.round(val) });
                }}
              />
              <View style={styles.timerRow}>
                <Text style={styles.timeLabel}>
                  {formatTime(currentFrame / stats.fps)}
                </Text>
                <Text style={styles.timeDivider}>/</Text>
                <Text style={styles.timeLabel}>
                  {formatTime(stats.duration)}
                </Text>
              </View>
            </View>

            {/* Controls Bar */}
            <View style={styles.controlsBar}>
              <TouchableOpacity style={styles.controlIconBtn} onPress={handleReset}>
                <Ionicons name="arrow-back-outline" size={20} color="#ff3d71" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlIconBtn} onPress={() => {
                sendToWebView({ type: 'SEEK', frame: 0 });
                setCurrentFrame(0);
              }}>
                <Ionicons name="refresh-outline" size={20} color="#eef0fa" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.playBtn, isPlaying && styles.pauseBtnActive]} 
                onPress={() => setIsPlaying(!isPlaying)}
              >
                <Ionicons 
                  name={isPlaying ? "pause" : "play"} 
                  size={24} 
                  color="#06060f" 
                />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.controlIconBtn, isMirrored && styles.mirrorBtnActive]} 
                onPress={() => setIsMirrored(!isMirrored)}
              >
                <MaterialCommunityIcons 
                  name="reflect-horizontal" 
                  size={20} 
                  color={isMirrored ? "#00e5ff" : "#eef0fa"} 
                />
              </TouchableOpacity>

              <View style={styles.speedPillsRow}>
                {[0.5, 1.0, 1.5, 2.0].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.speedPill, playbackSpeed === s && styles.speedPillActive]}
                    onPress={() => setPlaybackSpeed(s)}
                  >
                    <Text style={[styles.speedText, playbackSpeed === s && styles.speedTextActive]}>
                      {s}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Stats Dashboard */}
            <View style={styles.statsCardGrid}>
              <View style={[styles.glassCard, styles.statCard]}>
                <Text style={styles.statValue}>{stats.frames}</Text>
                <Text style={styles.statLabel}>Frames</Text>
              </View>
              <View style={[styles.glassCard, styles.statCard]}>
                <Text style={styles.statValue}>{stats.fps}</Text>
                <Text style={styles.statLabel}>FPS</Text>
              </View>
              <View style={[styles.glassCard, styles.statCard]}>
                <Text style={styles.statValue}>{stats.duration.toFixed(1)}s</Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
              <View style={[styles.glassCard, styles.statCard]}>
                <Text style={styles.statValue}>{stats.landmarksPerFrame}</Text>
                <Text style={styles.statLabel}>Pts/Frame</Text>
              </View>
            </View>

          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

// ================= STYLING SHEET =================
const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#06060f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100, 180, 255, 0.08)',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#eef0fa',
    marginLeft: 6,
  },
  accentText: {
    color: '#00e5ff',
  },
  settingsBtn: {
    padding: 6,
  },
  settingsCard: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 77, 255, 0.2)',
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#eef0fa',
    marginBottom: 12,
  },
  settingsLabel: {
    fontSize: 12,
    color: '#a0a8c8',
    marginBottom: 6,
  },
  settingsInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsInput: {
    flex: 1,
    backgroundColor: '#111128',
    borderRadius: 8,
    color: '#eef0fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(100, 180, 255, 0.15)',
  },
  saveBtn: {
    backgroundColor: '#7c4dff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginLeft: 10,
  },
  saveBtnText: {
    color: '#eef0fa',
    fontWeight: '600',
    fontSize: 13,
  },
  settingsNotice: {
    fontSize: 10,
    color: '#5c6488',
    marginTop: 8,
    lineHeight: 14,
  },
  mainContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 30,
  },
  glassCard: {
    backgroundColor: 'rgba(12, 12, 35, 0.65)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(100, 180, 255, 0.08)',
    padding: 20,
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
  },
  uploadCard: {
    marginTop: 20,
  },
  dropZone: {
    borderWidth: 2,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.02)',
  },
  dropZoneTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#eef0fa',
    marginTop: 14,
  },
  dropZoneSubtitle: {
    fontSize: 13,
    color: '#a0a8c8',
    marginTop: 6,
  },
  dropZoneFormats: {
    fontSize: 10,
    color: '#5c6488',
    marginTop: 10,
  },
  fileDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111128',
    borderRadius: 12,
    padding: 12,
    marginTop: 18,
    borderWidth: 1,
    borderColor: 'rgba(100, 180, 255, 0.1)',
  },
  fileName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#eef0fa',
  },
  fileSize: {
    fontSize: 11,
    color: '#a0a8c8',
    marginTop: 2,
  },
  primaryActionBtn: {
    backgroundColor: '#00e5ff',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryActionBtnText: {
    color: '#06060f',
    fontSize: 15,
    fontWeight: '800',
    marginRight: 6,
  },
  demoGroup: {
    width: '100%',
    alignItems: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    color: '#5c6488',
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryActionBtn: {
    borderWidth: 1.5,
    borderColor: '#7c4dff',
    borderRadius: 14,
    paddingVertical: 12,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnText: {
    color: '#eef0fa',
    fontSize: 14,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  processingCard: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#eef0fa',
    marginBottom: 6,
  },
  processingSubtitle: {
    fontSize: 13,
    color: '#a0a8c8',
    marginBottom: 20,
    textAlign: 'center',
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00e5ff',
    borderRadius: 3,
  },
  resultContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  videoPanelContainer: {
    height: 180,
    backgroundColor: '#0c0c1e',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100, 180, 255, 0.08)',
  },
  panelTitleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(6, 6, 15, 0.8)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  panelBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#eef0fa',
    letterSpacing: 0.8,
  },
  accentBadge: {
    color: '#00e5ff',
  },
  nativeVideo: {
    width: '100%',
    height: '100%',
  },
  showVideoFloatingBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(12, 12, 35, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  showVideoFloatingText: {
    color: '#00e5ff',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  avatarPanelContainer: {
    flex: 1,
    backgroundColor: '#06060f',
    position: 'relative',
  },
  avatarCanvasWrapper: {
    flex: 1,
  },
  webViewAvatar: {
    flex: 1,
    backgroundColor: '#06060f',
  },
  canvasPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: '#06060f',
  },
  timelineSlider: {
    width: '100%',
    height: 40,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
  },
  timeLabel: {
    fontSize: 11,
    color: '#a0a8c8',
    fontWeight: '500',
  },
  timeDivider: {
    fontSize: 11,
    color: '#5c6488',
    marginHorizontal: 4,
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#0c0c1e',
  },
  controlIconBtn: {
    padding: 8,
    borderRadius: 8,
  },
  playBtn: {
    backgroundColor: '#00e5ff',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  pauseBtnActive: {
    backgroundColor: '#00e5ff',
  },
  mirrorBtnActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: 8,
  },
  speedPillsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 2,
  },
  speedPill: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  speedPillActive: {
    backgroundColor: '#7c4dff',
  },
  speedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#a0a8c8',
  },
  speedTextActive: {
    color: '#eef0fa',
  },
  statsCardGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#06060f',
  },
  statCard: {
    width: (SCREEN_WIDTH - 50) / 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderRadius: 12,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#eef0fa',
  },
  statLabel: {
    fontSize: 8,
    color: '#a0a8c8',
    marginTop: 2,
    textTransform: 'uppercase',
  },
});
