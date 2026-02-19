'use client';

/**
 * Reciprocal Bridges — X-group pairs connected by multiple DXC clusters.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { BridgePair } from '@/lib/types';

export default function BridgesPage() {
  const [bridges, setBridges] = useState<BridgePair[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBridges() {
      try {
        const res = await fetch('/api/curation/bridges');
        if (!res.ok) throw new Error('Failed to fetch bridges');
        const data = await res.json();
        setBridges(data.bridges);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bridges');
      } finally {
        setLoading(false);
      }
    }
    fetchBridges();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/curation" className="text-blue-600 hover:text-blue-800 text-sm">&larr; Back to browser</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Reciprocal Bridges</h1>
        <p className="text-gray-600">
          X-group pairs connected by 2+ DXC clusters with good_domain members from both sides
        </p>
      </div>

      {loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mb-2"></div>
          <p className="text-blue-700">Computing bridges... this may take a few seconds.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {bridges && bridges.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
          No reciprocal bridges found.
        </div>
      )}

      {bridges && bridges.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {bridges.map((b, i) => {
            const confidence = b.total_domains >= 100 && b.n_clusters >= 3 ? 'HIGH' : 'MEDIUM';
            return (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-900">
                    X-{b.xg1} &#8596; X-{b.xg2}
                  </h3>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                    confidence === 'HIGH' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {confidence}
                  </span>
                </div>

                <div className="flex gap-4 text-sm text-gray-600 mb-4">
                  <span><b>{b.n_clusters}</b> clusters</span>
                  <span><b>{b.total_domains}</b> domains</span>
                </div>

                {/* Clusters */}
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Clusters</p>
                  <div className="flex flex-wrap gap-1">
                    {b.cluster_ids.map(cid => (
                      <Link key={cid} href={`/curation/cluster/${cid}`}
                        className="px-2 py-0.5 text-xs font-mono bg-blue-50 text-blue-700 rounded hover:bg-blue-100">
                        {cid}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Shared Pfam */}
                {b.shared_pfam.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">Shared Pfam</p>
                    <div className="flex flex-wrap gap-1">
                      {b.shared_pfam.map(acc => (
                        <a key={acc} href={`https://www.ebi.ac.uk/interpro/entry/pfam/${acc}`}
                          target="_blank" rel="noopener noreferrer"
                          className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded hover:bg-purple-200">
                          {acc}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
