export const metadata = {
  title: 'Kick Speedmeter | MediaPipe Pose',
  description: 'Soccer kick speed measurement (camera/video/compare) using MediaPipe Pose',
};

import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
