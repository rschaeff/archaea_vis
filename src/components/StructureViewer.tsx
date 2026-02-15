'use client';

/**
 * 3D structure viewer using 3Dmol.js.
 * Supports pLDDT coloring and domain boundary visualization.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import type { DomainWithPfam } from '@/lib/types';

const DOMAIN_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
];

type ColorMode = 'plddt' | 'domains' | 'spectrum';

interface StructureViewerProps {
  proteinId: string;
  domains?: DomainWithPfam[];
  height?: string;
}

export default function StructureViewer({ proteinId, domains = [], height = '500px' }: StructureViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [colorMode, setColorMode] = useState<ColorMode>('plddt');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [structureLoaded, setStructureLoaded] = useState(false);

  // Initialize viewer and load structure
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;

      setLoading(true);
      setError(null);

      try {
        // Dynamic import to avoid SSR
        // @ts-ignore - 3dmol types
        const $3Dmol = await import('3dmol/build/3Dmol.js');
        const lib = $3Dmol.default || $3Dmol;

        if (cancelled) return;

        // Fetch structure
        const res = await fetch(`/api/structure/${proteinId}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to load structure');
        }
        const structureData = await res.text();

        if (cancelled) return;

        // Clear previous viewer
        if (viewerRef.current) {
          viewerRef.current.clear();
        }

        // Create viewer
        containerRef.current.innerHTML = '';
        const viewer = lib.createViewer(containerRef.current, {
          backgroundColor: 'white',
        });
        viewerRef.current = viewer;

        // Detect format and add model
        const format = structureData.includes('data_') ? 'cif' : 'pdb';
        viewer.addModel(structureData, format);

        // Default: pLDDT coloring
        applyPlddt(viewer);
        viewer.zoomTo();
        viewer.render();

        setStructureLoaded(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load structure');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [proteinId]);

  // Apply color mode changes
  const applyColorMode = useCallback((mode: ColorMode) => {
    const viewer = viewerRef.current;
    if (!viewer || !structureLoaded) return;

    if (mode === 'plddt') {
      applyPlddt(viewer);
    } else if (mode === 'domains' && domains.length > 0) {
      applyDomainColors(viewer, domains);
    } else if (mode === 'spectrum') {
      viewer.setStyle({}, {
        cartoon: { color: 'spectrum' },
      });
    } else {
      // Fallback to pLDDT if domains requested but none available
      applyPlddt(viewer);
    }

    viewer.render();
  }, [structureLoaded, domains]);

  useEffect(() => {
    applyColorMode(colorMode);
  }, [colorMode, applyColorMode]);

  const handleColorChange = (mode: ColorMode) => {
    setColorMode(mode);
  };

  if (error) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center" style={{ height }}>
        <div className="text-center px-4">
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">3D Structure</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleColorChange('plddt')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
              colorMode === 'plddt'
                ? 'bg-blue-100 text-blue-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            pLDDT
          </button>
          {domains.length > 0 && (
            <button
              onClick={() => handleColorChange('domains')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                colorMode === 'domains'
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Domains
            </button>
          )}
          <button
            onClick={() => handleColorChange('spectrum')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
              colorMode === 'spectrum'
                ? 'bg-blue-100 text-blue-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Rainbow
          </button>
        </div>
      </div>

      {/* Viewer */}
      <div className="relative" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading structure...</p>
            </div>
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Legend */}
      {structureLoaded && (
        <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
          {colorMode === 'plddt' && <PlddtLegend />}
          {colorMode === 'domains' && <DomainLegend domains={domains} />}
          {colorMode === 'spectrum' && (
            <p className="text-xs text-gray-500">N-terminus (blue) to C-terminus (red)</p>
          )}
        </div>
      )}
    </div>
  );
}

/* Color application functions */

function applyPlddt(viewer: any) {
  viewer.setStyle({}, {
    cartoon: {
      colorfunc: (atom: { b: number }) => {
        const plddt = atom.b;
        if (plddt >= 90) return '#3b82f6'; // blue
        if (plddt >= 70) return '#06b6d4'; // cyan
        if (plddt >= 50) return '#eab308'; // yellow
        return '#f97316'; // orange
      },
    },
  });
}

function applyDomainColors(viewer: any, domains: DomainWithPfam[]) {
  // Start with gray background
  viewer.setStyle({}, {
    cartoon: { color: '#d1d5db', opacity: 0.5 },
  });

  // Color each domain
  domains.forEach((domain, index) => {
    const color = DOMAIN_COLORS[index % DOMAIN_COLORS.length];
    const ranges = parseRange(domain.range);

    for (const [start, end] of ranges) {
      viewer.setStyle(
        { resi: [`${start}-${end}`] },
        { cartoon: { color, opacity: 0.9 } }
      );
    }
  });
}

/**
 * Parse DPAM domain range string like "10-50,60-80" into pairs.
 */
function parseRange(range: string): [number, number][] {
  if (!range) return [];
  return range.split(',').map(seg => {
    const [start, end] = seg.trim().split('-').map(Number);
    return [start, end || start] as [number, number];
  });
}

/* Legend components */

function PlddtLegend() {
  return (
    <div className="flex items-center gap-3 text-xs text-gray-600">
      <span className="font-medium">pLDDT:</span>
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }}></span>
        &ge;90
      </span>
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded" style={{ backgroundColor: '#06b6d4' }}></span>
        70-90
      </span>
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded" style={{ backgroundColor: '#eab308' }}></span>
        50-70
      </span>
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded" style={{ backgroundColor: '#f97316' }}></span>
        &lt;50
      </span>
    </div>
  );
}

function DomainLegend({ domains }: { domains: DomainWithPfam[] }) {
  return (
    <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
      <span className="font-medium">Domains:</span>
      {domains.map((d, i) => (
        <span key={d.id} className="flex items-center gap-1">
          <span
            className="w-3 h-3 rounded"
            style={{ backgroundColor: DOMAIN_COLORS[i % DOMAIN_COLORS.length] }}
          ></span>
          D{d.domain_num}: {d.range}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded bg-gray-300"></span>
        Unassigned
      </span>
    </div>
  );
}
