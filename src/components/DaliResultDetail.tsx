'use client';

/**
 * DALI result detail panel with 3D superposition viewer and alignment block visualization.
 * Loads full result data on demand when a DALI hit row is expanded.
 *
 * Superposition: aligned blocks are colored with matching colors on both query and hit.
 * Unaligned regions are shown as faded gray cartoon.
 * For ECOD domain hits, only the domain chain is displayed.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// Distinct colors for alignment blocks — matching between query and hit
const BLOCK_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#6366F1', // indigo
  '#84CC16', // lime
];

interface DaliResult {
  id: string;
  hit_cd2: string;
  zscore: number;
  rmsd: number | null;
  nblock: number | null;
  blocks: { l1: number; r1: number; l2: number; r2: number }[];
  rotation: number[][];
  translation: number[];
  alignments: [number, number][];
  round: number | null;
  query_protein_id: string;
  library_type: string;
  hit_pdb_code: string;
  hit_chain: string;
  hit_domain_range: string | null;
  ecod_h_group: string | null;
  ecod_x_group_name: string | null;
}

interface Props {
  resultId: string;
  onClose: () => void;
}

export default function DaliResultDetail({ resultId, onClose }: Props) {
  const [result, setResult] = useState<DaliResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/dali/results/${resultId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load result details');
        return res.json();
      })
      .then(setResult)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [resultId]);

  if (loading) {
    return (
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
        <div className="flex items-center gap-2 text-indigo-600 text-sm">
          <div className="animate-spin w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
          Loading alignment details...
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600 text-sm">{error || 'Failed to load'}</p>
        <button onClick={onClose} className="text-red-500 text-xs mt-1 hover:underline">Close</button>
      </div>
    );
  }

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-indigo-100 border-b border-indigo-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="font-semibold text-indigo-900">
            {result.hit_cd2}
          </h4>
          <span className="text-sm text-indigo-600">
            Z={result.zscore.toFixed(1)} &middot; {result.nblock} blocks &middot; {result.alignments?.length || 0} aligned residues
          </span>
          {result.ecod_x_group_name && (
            <span className="text-xs text-indigo-500">
              {result.ecod_h_group} {result.ecod_x_group_name}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-indigo-400 hover:text-indigo-600 text-lg leading-none"
          title="Close detail"
        >
          &times;
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Alignment block map */}
        {result.blocks && result.blocks.length > 0 && (
          <AlignmentBlockMap blocks={result.blocks} />
        )}

        {/* 3D Superposition */}
        <SuperpositionViewer result={result} />
      </div>
    </div>
  );
}

function AlignmentBlockMap({ blocks }: {
  blocks: { l1: number; r1: number; l2: number; r2: number }[];
}) {
  const maxQuery = Math.max(...blocks.map(b => b.r1));
  const maxHit = Math.max(...blocks.map(b => b.r2));

  return (
    <div>
      <h5 className="text-sm font-medium text-gray-700 mb-2">Alignment Blocks</h5>
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="min-w-[400px]">
          {/* Query track */}
          <div className="flex items-center gap-2 mb-1.5 text-xs text-gray-500">
            <span className="w-12 text-right font-medium">Query</span>
            <div className="flex-1 relative h-5 bg-gray-100 rounded">
              {blocks.map((b, i) => {
                const left = ((b.l1 - 1) / maxQuery) * 100;
                const width = ((b.r1 - b.l1 + 1) / maxQuery) * 100;
                const color = BLOCK_COLORS[i % BLOCK_COLORS.length];
                return (
                  <div
                    key={i}
                    className="absolute h-full rounded flex items-center justify-center"
                    style={{ left: `${left}%`, width: `${Math.max(width, 1)}%`, backgroundColor: color }}
                    title={`Block ${i + 1}: ${b.l1}-${b.r1} (${b.r1 - b.l1 + 1} res)`}
                  >
                    {width > 6 && (
                      <span className="text-[9px] text-white font-medium">{b.r1 - b.l1 + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <span className="w-10 text-left">{maxQuery}</span>
          </div>
          {/* Hit track */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-12 text-right font-medium">Hit</span>
            <div className="flex-1 relative h-5 bg-gray-100 rounded">
              {blocks.map((b, i) => {
                const left = ((b.l2 - 1) / maxHit) * 100;
                const width = ((b.r2 - b.l2 + 1) / maxHit) * 100;
                const color = BLOCK_COLORS[i % BLOCK_COLORS.length];
                return (
                  <div
                    key={i}
                    className="absolute h-full rounded flex items-center justify-center"
                    style={{ left: `${left}%`, width: `${Math.max(width, 1)}%`, backgroundColor: color }}
                    title={`Block ${i + 1}: ${b.l2}-${b.r2} (${b.r2 - b.l2 + 1} res)`}
                  >
                    {width > 6 && (
                      <span className="text-[9px] text-white font-medium">{b.r2 - b.l2 + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <span className="w-10 text-left">{maxHit}</span>
          </div>
        </div>
        {/* Block details with color swatches */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          {blocks.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BLOCK_COLORS[i % BLOCK_COLORS.length] }}></span>
              B{i + 1}: {b.l1}-{b.r1} &harr; {b.l2}-{b.r2}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Parse an ECOD domain range string like "A:4-330" or "A:47-349,A:395-402"
 * into an array of {chain, start, end} objects.
 */
function parseDomainRange(range: string): { chain: string; start: number; end: number }[] {
  if (!range) return [];
  return range.split(',').map(seg => {
    const [chainPart, resPart] = seg.trim().split(':');
    const [start, end] = resPart.split('-').map(Number);
    return { chain: chainPart, start, end: end || start };
  });
}

/**
 * Apply visibility and block-color styles to both models.
 * Called on init and whenever show toggles change.
 */
function applyStyles(viewer: any, result: DaliResult, showQuery: boolean, showHit: boolean) {
  const hitChain = result.hit_chain;

  // --- Hit (model 0) ---
  if (!showHit) {
    viewer.setStyle({ model: 0 }, { cartoon: { hidden: true } });
  } else {
    // Hide everything first (other chains)
    viewer.setStyle({ model: 0 }, { cartoon: { hidden: true } });

    if (result.hit_domain_range) {
      const segments = parseDomainRange(result.hit_domain_range);
      for (const seg of segments) {
        viewer.setStyle(
          { model: 0, chain: seg.chain, resi: [`${seg.start}-${seg.end}`] },
          { cartoon: { color: '#d1d5db', opacity: 0.4 } }
        );
      }
    } else {
      viewer.setStyle(
        { model: 0, chain: hitChain },
        { cartoon: { color: '#d1d5db', opacity: 0.4 } }
      );
    }

    // Color aligned blocks
    if (result.blocks) {
      for (let i = 0; i < result.blocks.length; i++) {
        const block = result.blocks[i];
        const color = BLOCK_COLORS[i % BLOCK_COLORS.length];
        viewer.setStyle(
          { model: 0, chain: hitChain, resi: [`${block.l2}-${block.r2}`] },
          { cartoon: { color, opacity: 1.0 } }
        );
      }
    }
  }

  // --- Query (model 1) ---
  if (!showQuery) {
    viewer.setStyle({ model: 1 }, { cartoon: { hidden: true } });
  } else {
    viewer.setStyle({ model: 1 }, {
      cartoon: { color: '#d1d5db', opacity: 0.4 },
    });

    if (result.blocks) {
      for (let i = 0; i < result.blocks.length; i++) {
        const block = result.blocks[i];
        const color = BLOCK_COLORS[i % BLOCK_COLORS.length];
        viewer.setStyle(
          { model: 1, resi: [`${block.l1}-${block.r1}`] },
          { cartoon: { color, opacity: 1.0 } }
        );
      }
    }
  }
}

function SuperpositionViewer({ result }: { result: DaliResult }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [viewerLoading, setViewerLoading] = useState(true);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [showQuery, setShowQuery] = useState(true);
  const [showHit, setShowHit] = useState(true);
  const readyRef = useRef(false);

  // Re-apply styles when visibility toggles change
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !readyRef.current) return;

    applyStyles(viewer, result, showQuery, showHit);
    viewer.render();
  }, [showQuery, showHit, result]);

  const initViewer = useCallback(async () => {
    if (!containerRef.current) return;

    setViewerLoading(true);
    setViewerError(null);

    try {
      // @ts-ignore
      const $3Dmol = await import('3dmol/build/3Dmol.js');
      const lib = $3Dmol.default || $3Dmol;

      // Fetch both structures in parallel
      const [queryRes, hitRes] = await Promise.all([
        fetch(`/api/structure/${encodeURIComponent(result.query_protein_id)}`),
        fetch(`/api/dali/structure/${result.hit_cd2}`),
      ]);

      if (!queryRes.ok) throw new Error('Failed to load query structure');
      if (!hitRes.ok) throw new Error('Failed to load hit structure');

      const [queryData, hitData] = await Promise.all([
        queryRes.text(),
        hitRes.text(),
      ]);

      // Create viewer
      containerRef.current.innerHTML = '';
      const viewer = lib.createViewer(containerRef.current, {
        backgroundColor: 'white',
      });
      viewerRef.current = viewer;

      // --- Model 0: Hit structure ---
      const hitFormat = hitData.includes('data_') ? 'cif' : 'pdb';
      viewer.addModel(hitData, hitFormat);

      // --- Model 1: Query structure ---
      const queryFormat = queryData.includes('data_') ? 'cif' : 'pdb';
      viewer.addModel(queryData, queryFormat);

      // Apply DALI rotation + translation to the query
      if (result.rotation && result.translation) {
        const queryModel = viewer.getModel(1);
        const atoms = queryModel.selectedAtoms({});
        const R = result.rotation;
        const t = result.translation;

        for (const atom of atoms) {
          const x = atom.x;
          const y = atom.y;
          const z = atom.z;
          atom.x = R[0][0] * x + R[0][1] * y + R[0][2] * z + t[0];
          atom.y = R[1][0] * x + R[1][1] * y + R[1][2] * z + t[1];
          atom.z = R[2][0] * x + R[2][1] * y + R[2][2] * z + t[2];
        }
      }

      // Apply initial styles
      readyRef.current = true;
      applyStyles(viewer, result, true, true);

      viewer.zoomTo();
      viewer.render();
    } catch (err) {
      setViewerError(err instanceof Error ? err.message : 'Failed to load viewer');
    } finally {
      setViewerLoading(false);
    }
  }, [result]);

  useEffect(() => {
    initViewer();
    return () => {
      if (viewerRef.current) {
        viewerRef.current.clear();
      }
    };
  }, [initViewer]);

  return (
    <div>
      <h5 className="text-sm font-medium text-gray-700 mb-2">Structure Superposition</h5>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="relative" style={{ height: 400 }}>
          {viewerLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
              <div className="text-center">
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-xs text-gray-500">Loading structures...</p>
              </div>
            </div>
          )}
          {viewerError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
              <p className="text-sm text-red-500">{viewerError}</p>
            </div>
          )}
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>
        {/* Toolbar + Legend */}
        <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-gray-600 mr-1">Show:</span>
            <button
              onClick={() => setShowQuery(v => !v)}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                showQuery
                  ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-300'
                  : 'bg-gray-200 text-gray-400 line-through'
              }`}
            >
              Query
            </button>
            <button
              onClick={() => setShowHit(v => !v)}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                showHit
                  ? 'bg-green-100 text-green-800 ring-1 ring-green-300'
                  : 'bg-gray-200 text-gray-400 line-through'
              }`}
            >
              Hit ({result.hit_cd2})
            </button>
            <span className="ml-auto text-gray-400">
              Query: transformed &middot; Hit: reference frame
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
            <span className="font-medium text-gray-600">Blocks:</span>
            {(result.blocks || []).map((_b, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: BLOCK_COLORS[i % BLOCK_COLORS.length] }}></span>
                B{i + 1}
              </span>
            ))}
            <span className="flex items-center gap-1 ml-2">
              <span className="w-3 h-3 rounded bg-gray-300"></span>
              Unaligned
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
