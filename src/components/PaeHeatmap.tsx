'use client';

/**
 * PAE (Predicted Aligned Error) heatmap visualization.
 * Renders a canvas-based heatmap of the PAE matrix.
 */

import { useRef, useEffect, useState } from 'react';

interface PaeHeatmapProps {
  proteinId: string;
  height?: number;
}

// AlphaFold PAE color scale: dark blue (0) → white (15) → red (30+)
function paeColor(value: number): [number, number, number] {
  // Clamp to [0, 31.75] as in AF2/AF3
  const v = Math.max(0, Math.min(31.75, value));
  const t = v / 31.75;

  if (t < 0.5) {
    // Dark green/blue → white
    const s = t * 2;
    return [
      Math.round(0 + s * 255),
      Math.round(83 + s * 172),
      Math.round(214 + s * 41),
    ];
  } else {
    // White → dark red
    const s = (t - 0.5) * 2;
    return [
      Math.round(255 - s * 55),
      Math.round(255 - s * 220),
      Math.round(255 - s * 235),
    ];
  }
}

export default function PaeHeatmap({ proteinId, height = 400 }: PaeHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState(0);
  const [hovering, setHovering] = useState<{ x: number; y: number; value: number } | null>(null);
  const paeDataRef = useRef<number[][] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPae() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/pae/${proteinId}`);
        if (res.status === 404) {
          setError('No PAE data available');
          return;
        }
        if (!res.ok) throw new Error('Failed to load PAE data');

        const data = await res.json();
        if (cancelled) return;

        paeDataRef.current = data.pae;
        setSize(data.size);
        renderHeatmap(data.pae);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load PAE');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    function renderHeatmap(pae: number[][]) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const n = pae.length;
      // Draw at native resolution then CSS-scale
      canvas.width = n;
      canvas.height = n;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const imageData = ctx.createImageData(n, n);
      const data = imageData.data;

      for (let y = 0; y < n; y++) {
        const row = pae[y];
        for (let x = 0; x < n; x++) {
          const idx = (y * n + x) * 4;
          const [r, g, b] = paeColor(row[x]);
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }

    loadPae();
    return () => { cancelled = true; };
  }, [proteinId]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const pae = paeDataRef.current;
    if (!canvas || !pae) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = pae.length / rect.width;
    const scaleY = pae.length / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    if (x >= 0 && x < pae.length && y >= 0 && y < pae.length) {
      setHovering({ x: x + 1, y: y + 1, value: pae[y][x] });
    }
  };

  if (error) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center" style={{ height }}>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">
          Predicted Aligned Error {size > 0 && <span className="text-gray-500 font-normal">({size} x {size})</span>}
        </h3>
        {hovering && (
          <span className="text-xs text-gray-500">
            Residue {hovering.y} vs {hovering.x}: {hovering.value.toFixed(1)} &Aring;
          </span>
        )}
      </div>

      <div className="relative" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading PAE data...</p>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovering(null)}
        />
      </div>

      {/* Color scale legend */}
      {!loading && !error && size > 0 && (
        <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span>Expected position error (&Aring;):</span>
            <div className="flex items-center gap-0.5">
              <span>0</span>
              <div
                className="h-3 rounded"
                style={{
                  width: '120px',
                  background: 'linear-gradient(to right, #0053d6, #ffffff, #c82314)',
                }}
              />
              <span>30+</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
