"""
Pose & Hand Landmark Extractor using MediaPipe Tasks API (mediapipe >= 0.10).

Processes sign language video frames to extract body pose (33 landmarks),
left hand (21 landmarks), and right hand (21 landmarks) per frame.

Model files are automatically downloaded on first use and cached locally.
"""

import cv2
import mediapipe as mp  # type: ignore[import-untyped]
import numpy as np
import logging
import urllib.request
import os
from typing import Any

logger = logging.getLogger(__name__)

# ── Model file URLs and local cache paths ─────────────────────────────────────
_MODEL_CACHE_DIR = os.path.join(os.path.dirname(__file__), "_models")
_POSE_MODEL_URL  = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
_HAND_MODEL_URL  = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
_POSE_MODEL_PATH = os.path.join(_MODEL_CACHE_DIR, "pose_landmarker_lite.task")
_HAND_MODEL_PATH = os.path.join(_MODEL_CACHE_DIR, "hand_landmarker.task")


def _ensure_model(url: str, path: str) -> None:
    """Download a model file if not already cached."""
    if os.path.exists(path):
        return
    os.makedirs(_MODEL_CACHE_DIR, exist_ok=True)
    logger.info(f"Downloading model from {url} to {path}")
    try:
        urllib.request.urlretrieve(url, path)
        logger.info(f"Model downloaded: {path}")
    except Exception as exc:
        raise RuntimeError(f"Failed to download model {url}: {exc}") from exc


# ── Import new Tasks API (mediapipe has no type stubs — ignore type errors) ───
from mediapipe.tasks import python as mp_tasks  # type: ignore[import-untyped]
from mediapipe.tasks.python import vision as mp_vision  # type: ignore[import-untyped]

PoseLandmarker: Any     = mp_vision.PoseLandmarker
PoseLandmarkerOpts: Any = mp_vision.PoseLandmarkerOptions
HandLandmarker: Any     = mp_vision.HandLandmarker
HandLandmarkerOpts: Any = mp_vision.HandLandmarkerOptions
BaseOptions: Any        = mp_tasks.BaseOptions
VisionRunningMode: Any  = mp_vision.RunningMode


class PoseExtractor:
    """Extracts pose and hand landmarks from sign language videos using MediaPipe Tasks."""

    def __init__(
        self,
        model_complexity: int = 1,  # kept for API compatibility (ignored by lite model)
        min_detection_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
    ):
        self.min_detection_confidence = min_detection_confidence
        self.min_tracking_confidence  = min_tracking_confidence

        # Ensure model files are available (downloaded once, cached forever)
        _ensure_model(_POSE_MODEL_URL, _POSE_MODEL_PATH)
        _ensure_model(_HAND_MODEL_URL, _HAND_MODEL_PATH)

    def process_video(self, video_path: str, sample_rate: int = 1) -> dict:
        """
        Process a video file and extract pose/hand landmarks for every sampled frame.

        Args:
            video_path:  Absolute path to the video file.
            sample_rate: Process every Nth frame (1 = every frame).

        Returns:
            Dictionary with keys: fps, total_frames, width, height, frames.
            Each frame contains pose, left_hand, right_hand landmark arrays.
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video file: {video_path}")

        fps          = cap.get(cv2.CAP_PROP_FPS) or 30.0
        width        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        logger.info(f"Video info: {width}x{height} @ {fps:.1f}fps, {total_frames} frames")

        result_data: dict = {
            "fps": fps / sample_rate,
            "original_fps": fps,
            "width": width,
            "height": height,
            "total_frames": 0,
            "original_total_frames": total_frames,
            "frames": [],
        }

        pose_opts = PoseLandmarkerOpts(
            base_options=BaseOptions(model_asset_path=_POSE_MODEL_PATH),
            running_mode=VisionRunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=self.min_detection_confidence,
            min_pose_presence_confidence=self.min_detection_confidence,
            min_tracking_confidence=self.min_tracking_confidence,
        )

        hand_opts = HandLandmarkerOpts(
            base_options=BaseOptions(model_asset_path=_HAND_MODEL_PATH),
            running_mode=VisionRunningMode.VIDEO,
            num_hands=2,
            min_hand_detection_confidence=self.min_detection_confidence,
            min_hand_presence_confidence=self.min_detection_confidence,
            min_tracking_confidence=self.min_tracking_confidence,
        )

        with PoseLandmarker.create_from_options(pose_opts) as pose_landmarker, \
             HandLandmarker.create_from_options(hand_opts) as hand_landmarker:

            frame_idx = 0
            processed = 0

            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                if frame_idx % sample_rate != 0:
                    frame_idx += 1
                    continue

                # MediaPipe requires RGB
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image  = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

                # Timestamp in milliseconds (must be monotonically increasing)
                ts_ms = int((frame_idx / fps) * 1000)

                pose_result = pose_landmarker.detect_for_video(mp_image, ts_ms)
                hand_result = hand_landmarker.detect_for_video(mp_image, ts_ms)

                frame_data = self._extract_landmarks(pose_result, hand_result)
                result_data["frames"].append(frame_data)

                processed += 1
                if processed % 30 == 0:
                    logger.info(f"Processed {processed} frames...")

                frame_idx += 1

        cap.release()
        result_data["total_frames"] = len(result_data["frames"])
        logger.info(f"Extraction complete: {result_data['total_frames']} frames processed")
        return result_data

    def _extract_landmarks(self, pose_result: Any, hand_result: Any) -> dict:
        """Extract pose, left hand, and right hand landmarks from MediaPipe Tasks results."""
        frame_data: dict = {"pose": None, "left_hand": None, "right_hand": None}

        # ── Pose: 33 landmarks normalised to [0,1] ─────────────────────────
        if pose_result.pose_landmarks:
            lms = pose_result.pose_landmarks[0]
            frame_data["pose"] = [
                {
                    "x": round(float(lm.x), 6),
                    "y": round(float(lm.y), 6),
                    "z": round(float(lm.z), 6),
                    "v": round(float(getattr(lm, "visibility", 1.0) or 1.0), 4),
                }
                for lm in lms
            ]

        # ── Hands: identify left/right by handedness label ──────────────────
        if hand_result.hand_landmarks:
            for idx, hand_lms in enumerate(hand_result.hand_landmarks):
                try:
                    # category_name is 'Left' or 'Right' (from camera perspective)
                    label: str = hand_result.handedness[idx][0].category_name
                except (IndexError, AttributeError):
                    label = "Right" if idx == 0 else "Left"

                landmarks = [
                    {
                        "x": round(float(lm.x), 6),
                        "y": round(float(lm.y), 6),
                        "z": round(float(lm.z), 6),
                    }
                    for lm in hand_lms
                ]

                # Assign hands based on MediaPipe anatomical label
                if label == "Left":
                    frame_data["left_hand"] = landmarks
                else:
                    frame_data["right_hand"] = landmarks

        return frame_data
