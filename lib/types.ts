export type Side = 'left' | 'right';

export interface Point2D {
  x: number;
  y: number;
  t?: number;
}

export interface Point3D {
  x: number;
  y: number;
  z?: number;
  t?: number;
}

export interface Landmark2D { x: number; y: number; z?: number; visibility?: number; presence?: number }
export interface Landmark3D { x: number; y: number; z: number; visibility?: number; presence?: number }

export type Landmarks2D = Landmark2D[][]; // [poses][keypoints]
export type Landmarks3D = Landmark3D[][]; // [poses][keypoints]
