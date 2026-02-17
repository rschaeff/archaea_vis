'use client';

/**
 * Clustering Analysis Page
 *
 * Overview of protein and domain clustering across 4 dimensions:
 * sequence (MMseqs2) and structure (Foldseek) for both proteins and domains.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SummaryItem {
  type: string;
  label: string;
  method: string;
  clusters: number;
  members: number;
  singletons: number;
  largest: number;
  pending?: boolean;
}

interface DistBin {
  bin: string;
  clusters: number;
  members: number;
}

interface CrossComparison {
  both_clustered: number;
  rescued_by_structure: number;
  both_singleton: number;
  seq_only: number;
  total: number;
}

interface TopCluster {
  cluster_id: string;
  cluster_size: number;
  cluster_rep: string;
  n_classes: number;
  classes: string;
}

interface ClusteringData {
  summary: SummaryItem[];
  size_distributions: Record<string, DistBin[]>;
  cross_comparison: CrossComparison;
  ecod_novelty: { has_ecod: number; novel: number };
  top_structural_clusters: TopCluster[];
}

const BIN_ORDER = ['1', '2-5', '6-20', '21-100', '100+'];

export default function ClusteringPage() {
  const [data, setData] = useState<ClusteringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/clustering')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch clustering data');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-96 mb-6"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-lg"></div>)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {[...Array(2)].map((_, i) => <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>)}
          </div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-red-800 font-medium text-lg">Error</h2>
          <p className="text-red-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const { cross_comparison: cross, ecod_novelty: novelty } = data;
  const noveltyTotal = novelty.has_ecod + novelty.novel;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clustering Analysis</h1>
        <p className="text-sm text-gray-600 mt-1">
          Protein and domain clustering across sequence (MMseqs2) and structure (Foldseek) dimensions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {data.summary.map(s => (
          <div
            key={s.type}
            className={`bg-white border rounded-lg p-4 ${
              s.pending ? 'border-gray-200 bg-gray-50' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-900">{s.label}</span>
              <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                s.method === 'MMseqs2' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
              }`}>
                {s.method}
              </span>
            </div>
            {s.pending ? (
              <div className="text-sm text-gray-400 italic">Pending</div>
            ) : (
              <>
                <div className="text-2xl font-bold text-gray-900">{s.clusters.toLocaleString()}</div>
                <div className="text-xs text-gray-500">clusters</div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>{s.members.toLocaleString()} members</span>
                  <span>{s.members > 0 ? (s.singletons / s.members * 100).toFixed(0) : 0}% singleton</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">Largest: {s.largest.toLocaleString()}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Insight Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Sequence vs Structure */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Sequence vs Structure Clustering</h3>
          <div className="space-y-2">
            {[
              { label: 'Clustered in both', value: cross.both_clustered, color: 'bg-blue-500' },
              { label: 'Rescued by structure', value: cross.rescued_by_structure, color: 'bg-green-500' },
              { label: 'Sequence only', value: cross.seq_only, color: 'bg-yellow-500' },
              { label: 'Singleton in both', value: cross.both_singleton, color: 'bg-gray-400' },
            ].map(({ label, value, color }) => {
              const pct = cross.total > 0 ? (value / cross.total * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span className="text-gray-700">{label}</span>
                    <span className="text-gray-600">{value.toLocaleString()} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 bg-green-50 border border-green-200 rounded p-2">
            <span className="text-sm font-medium text-green-800">
              {cross.rescued_by_structure.toLocaleString()} proteins
            </span>
            <span className="text-sm text-green-700"> rescued from sequence-singleton status by structural clustering</span>
          </div>
        </div>

        {/* ECOD Novelty */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">ECOD Sequence Homology</h3>
          <div className="space-y-2">
            {[
              { label: 'Has ECOD homolog', value: novelty.has_ecod, color: 'bg-blue-500' },
              { label: 'No ECOD homolog (novel)', value: novelty.novel, color: 'bg-red-400' },
            ].map(({ label, value, color }) => {
              const pct = noveltyTotal > 0 ? (value / noveltyTotal * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span className="text-gray-700">{label}</span>
                    <span className="text-gray-600">{value.toLocaleString()} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 bg-red-50 border border-red-200 rounded p-2">
            <span className="text-sm text-red-700">
              {noveltyTotal > 0 ? (novelty.novel / noveltyTotal * 100).toFixed(1) : 0}% of proteins have no ECOD sequence homolog
            </span>
          </div>
        </div>
      </div>

      {/* Cluster Size Distributions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {data.summary.filter(s => !s.pending).map(s => {
          const dist = data.size_distributions[s.type] || [];
          const sorted = BIN_ORDER.map(b => dist.find(d => d.bin === b) || { bin: b, clusters: 0, members: 0 });
          const maxClusters = Math.max(...sorted.map(d => d.clusters), 1);
          return (
            <div key={s.type} className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-1 text-sm">{s.label} Size Distribution</h3>
              <div className="text-xs text-gray-500 mb-3">{s.clusters.toLocaleString()} clusters</div>
              <div className="space-y-2">
                {sorted.map(d => {
                  const pct = (d.clusters / maxClusters * 100);
                  return (
                    <div key={d.bin}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-700 w-10">{d.bin}</span>
                        <span className="text-xs text-gray-500">
                          {d.clusters.toLocaleString()} cl / {d.members.toLocaleString()} mem
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${
                            s.method === 'MMseqs2' ? 'bg-blue-400' : 'bg-green-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Top Pan-Archaeal Structural Clusters */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Top Pan-Archaeal Structural Clusters</h3>
          <p className="text-xs text-gray-500 mt-0.5">Largest Foldseek protein clusters by member count</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cluster</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Size</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Classes</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Representative</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Class Names</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.top_structural_clusters.map(c => (
                <tr key={c.cluster_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm font-mono text-gray-900">{c.cluster_id}</td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-right">{c.cluster_size.toLocaleString()}</td>
                  <td className="px-3 py-2 text-sm text-right">
                    <span className={c.n_classes >= 50 ? 'font-medium text-green-700' : 'text-gray-900'}>
                      {c.n_classes} / 65
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <Link href={`/proteins/${c.cluster_rep}`} className="text-blue-600 hover:text-blue-800 font-mono">
                      {c.cluster_rep}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600 max-w-md truncate" title={c.classes}>
                    {c.classes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
