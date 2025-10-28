let PoseLandmarker, FilesetResolver; // dynamically loaded on client
let vision = null; // FilesetResolver instance cache
let landmarker = null;
let runningMode = "VIDEO";
let modelVariant = 'lite'; // 'lite' | 'full' | 'heavy'

export async function ensurePoseLoaded() {
  if (landmarker) return landmarker;
  if (!PoseLandmarker || !FilesetResolver) {
    const mod = await import('@mediapipe/tasks-vision');
    PoseLandmarker = mod.PoseLandmarker;
    FilesetResolver = mod.FilesetResolver;
  }
  if (!vision) {
    vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );
  }
  landmarker = await createLandmarker();
  return landmarker;
}

export function setRunningMode(mode) {
  runningMode = mode;
  if (landmarker) landmarker.setOptions({ runningMode: mode });
}

export function processVideoFrame(videoEl, timestampMs) {
  if (!landmarker) return null;
  return landmarker.detectForVideo(videoEl, timestampMs);
}

function modelPathFor(variant) {
  const base = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker';
  const v = (variant === 'full' || variant === 'heavy') ? variant : 'lite';
  return `${base}/pose_landmarker_${v}/float16/latest/pose_landmarker_${v}.task`;
}

async function createLandmarker() {
  const path = modelPathFor(modelVariant);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: path },
    runningMode,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false
  });
}

export async function setModelVariant(variant) {
  const next = (variant === 'full' || variant === 'heavy') ? variant : 'lite';
  if (next === modelVariant && landmarker) return landmarker;
  modelVariant = next;
  // Recreate landmarker with new model
  if (!PoseLandmarker || !FilesetResolver) {
    const mod = await import('@mediapipe/tasks-vision');
    PoseLandmarker = mod.PoseLandmarker;
    FilesetResolver = mod.FilesetResolver;
  }
  if (!vision) {
    vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );
  }
  try { landmarker?.close?.(); } catch {}
  landmarker = await createLandmarker();
  return landmarker;
}
