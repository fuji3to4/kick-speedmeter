import type { Landmarks2D, Landmarks3D } from './types';

let PoseLandmarker: any, FilesetResolver: any; // from @mediapipe/tasks-vision
let vision: any = null; // FilesetResolver instance cache
let landmarker: any = null;
let runningMode: 'VIDEO' | 'IMAGE' = 'VIDEO';

export async function ensurePoseLoaded() {
  if (landmarker) return landmarker;
  if (!PoseLandmarker || !FilesetResolver) {
    const mod = await import('@mediapipe/tasks-vision');
    PoseLandmarker = (mod as any).PoseLandmarker;
    FilesetResolver = (mod as any).FilesetResolver;
  }
  if (!vision) {
    // Pin to the installed package version to avoid runtime mismatches
    vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm'
    );
  }
  landmarker = await createLandmarker();
  return landmarker;
}

export function setRunningMode(_mode: 'VIDEO' | 'IMAGE') {
  // 常に VIDEO を使用（メカニクス簡素化）
  runningMode = 'VIDEO';
  if (landmarker) landmarker.setOptions({ runningMode: 'VIDEO' });
}

export function processVideoFrame(videoEl: HTMLVideoElement, timestampMs: number): { landmarks: Landmarks2D; worldLandmarks?: Landmarks3D } | null {
  if (!landmarker) return null;
  return landmarker.detectForVideo(videoEl, timestampMs);
}

function modelPathFor() {
  // 固定で full/float16/latest を使用（ユーザー指定）
  return 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';
}

async function createLandmarker() {
  const path = modelPathFor();
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

// バリアント切替は廃止（後方互換のため no-op を提供）
export async function setModelVariant(_variant: 'lite' | 'full' | 'heavy') {
  return ensurePoseLoaded();
}
