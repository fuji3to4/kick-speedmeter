'use client'

import { useEffect } from 'react';
import initApp from '../lib/initApp';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
// shadcn Select を撤去し、ネイティブ select を使用

export default function Page() {
  useEffect(() => {
    initApp();
  }, []);

  return (
    <>
      <header className="px-5 py-4 border-b">
        <h1 className="m-0 text-xl">Kick Speedmeter</h1>
        <p className="m-0 text-sm text-gray-600">MediaPipe Pose を用いたキック速度計測（カメラ/動画/比較）</p>
      </header>

      <Tabs
        defaultValue="live"
        className="w-full"
        onValueChange={(v) => {
          if (v !== 'live') {
            try { document.getElementById('stopLive')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); } catch { }
          }
        }}
      >
        {/* <div className="flex items-center gap-2"> */}
        <TabsList>
          <TabsTrigger value="live">ライブ計測</TabsTrigger>
          <TabsTrigger value="video">動画から計測</TabsTrigger>
          <TabsTrigger value="compare">動画比較</TabsTrigger>
        </TabsList>
        {/* </div> */}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
          {/* <label className="grid gap-1 text-gray-700">
            測定部位:
            <select id="footSelect" className="border rounded px-2 py-2">
              <option value="right_foot">右足</option>
              <option value="left_foot">左足</option>
              <option value="right_hand">右手</option>
              <option value="left_hand">左手</option>
            </select>
          </label> */}
          {/* 仕様簡素化: 平滑化係数は 0.3 固定。m/px と 2D 切替も撤去済み */}
        </div>


        {/* Live Tab */}
        <TabsContent value="live" forceMount className="data-[state=inactive]:hidden">
          <div className="grid gap-4 md:grid-cols-[1.5fr_1fr] items-start px-5 pb-5">
            <Card className="relative overflow-hidden">
              <CardContent className="p-0">

                <video id="liveVideo" autoPlay playsInline muted className="block w-full max-h-[60vh] bg-black" />
                <canvas id="liveCanvas" className="absolute inset-0 w-full h-full pointer-events-none"></canvas>

              </CardContent>
              <CardFooter>
                <div className="px-5 pb-4 flex items-center gap-2 mt-4 flex-wrap">
                  <button id="startLive" className="h-10 border bg-white text-gray-900 px-4 py-0 rounded appearance-none">カメラ開始</button>
                  <button id="stopLive" disabled className="h-10 border bg-white text-gray-900 px-4 py-0 rounded disabled:opacity-50 appearance-none">停止</button>

                  <label htmlFor="footSelect" className="sr-only">測定部位</label>
                  <select id="footSelect" className="h-10 border rounded px-2 py-0">
                    <option value="right_foot">右足</option>
                    <option value="left_foot">左足</option>
                    <option value="right_hand">右手</option>
                    <option value="left_hand">左手</option>
                  </select>
                </div>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>速度 (3D m/s)</CardTitle>
                <label className="grid gap-1 text-gray-700" title="最大記録とスクショの基準 (絶対: 世界座標, 相対: 重心基準)">
                  速度の基準:
                  <select id="speedBasis" className="border rounded px-2 py-2">
                    <option value="absolute">絶対（ワールド座標）</option>
                    <option value="relative">相対（重心基準）</option>
                  </select>
                </label>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between py-1 border-b border-dashed"><span>現在(選択基準):</span><strong id="liveSpeedM">-</strong></div>
                <div className="flex justify-between py-1"><span>最大(選択基準):</span><strong id="liveMaxM">-</strong></div>
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input id="captureOnMax" type="checkbox" />
                    <label htmlFor="captureOnMax" className="text-gray-700">最大速度時にスクショを保存</label>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button id="resetMax" className="border bg-white text-gray-900 px-3 py-2 rounded appearance-none">最大速度リセット</button>
                    <a id="downloadMaxShot" className="border bg-white text-gray-900 px-3 py-2 rounded appearance-none hidden" download="max-speed-shot.png">スクショをダウンロード</a>
                  </div>
                  <div id="maxShotWrap" className="hidden">
                    <p className="text-sm text-gray-600 m-0">最大時のスクショ</p>
                    <img id="liveMaxShot" alt="最大速度時のスクリーンショット" className="border rounded max-w-full h-auto" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </TabsContent>

        {/* Video Tab */}
        <TabsContent value="video" forceMount className="data-[state=inactive]:hidden">
          <div className="grid gap-4 md:grid-cols-[1.5fr_1fr] items-start px-5 pb-5">
            <div>
              <input id="videoFile" type="file" accept="video/*" title="解析する動画を選択" className="mb-2" />
              <Card className="relative overflow-hidden">
                <CardContent className="p-0">
                  <video id="fileVideo" controls className="block w-full max-h-[60vh] bg-black" />
                  <canvas id="fileCanvas" className="absolute inset-0 w-full h-full pointer-events-none"></canvas>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>速度 (3D m/s)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between py-1 border-b border-dashed"><span>現在(m/s):</span><strong id="fileSpeedM">-</strong></div>
                <div className="flex justify-between py-1 border-b border-dashed"><span>最大(m/s):</span><strong id="fileMaxM">-</strong></div>
                <div className="flex justify-between py-1"><span>最大速度時刻:</span><strong id="fileMaxAt">-</strong></div>
              </CardContent>
            </Card>
          </div>
          <div className="px-5 pb-5">
            <Card>
              <CardContent>
                <canvas id="fileChart"></canvas>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Compare Tab */}
        <TabsContent value="compare" forceMount className="data-[state=inactive]:hidden">
          <div className="grid gap-4 md:grid-cols-2 items-start px-5 pb-5">
            <Card>
              <CardHeader>
                <CardTitle>お手本動画</CardTitle>
              </CardHeader>
              <CardContent>
                <input id="refVideoFile" type="file" accept="video/*" title="お手本動画を選択" className="mb-2" />
                <div className="relative border rounded overflow-hidden">
                  <video id="refVideo" controls className="block w-full max-h-[60vh] bg-black" />
                  <canvas id="refCanvas" className="absolute inset-0 w-full h-full pointer-events-none"></canvas>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>自分の動画</CardTitle>
              </CardHeader>
              <CardContent>
                <input id="usrVideoFile" type="file" accept="video/*" title="自分の動画を選択" className="mb-2" />
                <div className="relative border rounded overflow-hidden">
                  <video id="usrVideo" controls className="block w-full max-h-[60vh] bg-black" />
                  <canvas id="usrCanvas" className="absolute inset-0 w-full h-full pointer-events-none"></canvas>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="px-5 pb-5">
            <Card>
              <CardHeader>
                <CardTitle>速度(m/s)・角度の比較</CardTitle>
              </CardHeader>
              <CardContent>
                <canvas id="compareChart"></canvas>
              </CardContent>
            </Card>
          </div>
          <div className="px-5 pb-8 grid gap-3 md:grid-cols-2">
            <Card>
              <CardContent>
                <div className="flex justify-between py-1 border-b border-dashed border-slate-700"><span>速度カーブ相関(m/s):</span><strong id="corrSpeed">-</strong></div>
                <div className="flex justify-between py-1"><span>膝角カーブ相関:</span><strong id="corrKnee">-</strong></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <footer className="px-5 py-3 text-gray-600 border-t">
        <small>Powered by MediaPipe Tasks Vision (Pose Landmarker). 現在は 3D ワールド座標の m/s のみ対応です。</small>
      </footer>
    </>
  );
}
