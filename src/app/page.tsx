'use client';

/**
 * Dashboard — Archaea Protein Atlas overview
 *
 * Fetches /api/stats and /api/clustering in parallel to show
 * protein coverage, clustering insights, and ECOD novelty.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import StatCard from '@/components/StatCard';
import ProgressBar from '@/components/ProgressBar';
import type { ArchaeaStats } from '@/lib/types';

interface ClusteringSummaryItem {
  type: string;
  label: string;
  method: string;
  clusters: number;
  members: number;
  singletons: number;
  largest: number;
  pending?: boolean;
}

interface CrossComparison {
  both_clustered: number;
  rescued_by_structure: number;
  both_singleton: number;
  seq_only: number;
  total: number;
}

interface EcodNovelty {
  has_ecod: number;
  novel: number;
}

interface ClusteringData {
  summary: ClusteringSummaryItem[];
  cross_comparison: CrossComparison;
  ecod_novelty: EcodNovelty;
}

interface DashboardData {
  stats: ArchaeaStats;
  clustering: ClusteringData;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/stats').then(r => {
        if (!r.ok) throw new Error('Failed to fetch stats');
        return r.json();
      }),
      fetch('/api/clustering').then(r => {
        if (!r.ok) throw new Error('Failed to fetch clustering');
        return r.json();
      }),
    ])
      .then(([statsData, clusteringData]) =>
        setData({ stats: statsData.stats, clustering: clusteringData })
      )
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-96 mb-8"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-medium">Error Loading Dashboard</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const { stats, clustering } = data!;
  const cross = clustering.cross_comparison;
  const novelty = clustering.ecod_novelty;
  const noveltyTotal = novelty.has_ecod + novelty.novel;
  const novelPct = noveltyTotal > 0 ? ((novelty.novel / noveltyTotal) * 100).toFixed(1) : '0';

  // summary[0] = protein_seq, summary[1] = protein_struct
  const protSeq = clustering.summary.find(s => s.type === 'protein_seq');
  const protStruct = clustering.summary.find(s => s.type === 'protein_struct');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Archaea Protein Atlas</h1>
        <p className="text-gray-600 mt-2">
          Structural characterization and novel fold discovery across 124,000+ archaeal proteins
        </p>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Proteins"
          value={stats.total_proteins.toLocaleString()}
          color="blue"
        />
        <StatCard
          title="With Structure"
          value={stats.with_structure.toLocaleString()}
          subtitle={`${((stats.with_structure / stats.total_proteins) * 100).toFixed(1)}%`}
          color="green"
        />
        <StatCard
          title="DPAM Domains"
          value={stats.total_domains.toLocaleString()}
          subtitle={`${stats.proteins_with_domains.toLocaleString()} proteins`}
          color="purple"
        />
        <StatCard
          title="Novel to ECOD"
          value={`${novelPct}%`}
          subtitle={`${novelty.novel.toLocaleString()} proteins`}
          color="red"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Structural Families"
          value={protStruct ? protStruct.clusters.toLocaleString() : '—'}
          subtitle={protSeq ? `from ${protSeq.clusters.toLocaleString()} seq clusters` : ''}
          color="orange"
        />
        <StatCard
          title="Rescued by Structure"
          value={cross.rescued_by_structure.toLocaleString()}
          subtitle={cross.total > 0 ? `${((cross.rescued_by_structure / cross.total) * 100).toFixed(0)}% of proteins` : ''}
          color="green"
        />
        <StatCard
          title="Novel Fold Clusters"
          value={(stats.novel_fold_clusters + stats.novel_domain_clusters).toLocaleString()}
          subtitle={`${stats.novel_fold_clusters} dark protein + ${stats.novel_domain_clusters.toLocaleString()} orphan domain`}
          color="red"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link
          href="/clustering"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Clustering Analysis</h3>
          <p className="text-gray-600 text-sm mb-4">
            Protein and domain clustering across sequence and structure
          </p>
          <div className="flex items-center text-orange-600 font-medium">
            <span>{protStruct ? protStruct.clusters.toLocaleString() : '—'} structural families</span>
            <span className="ml-2">&rarr;</span>
          </div>
        </Link>

        <Link
          href="/novel-folds"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Novel Fold Discovery</h3>
          <p className="text-gray-600 text-sm mb-4">
            Two-tier novelty: dark proteins and orphan domains
          </p>
          <div className="flex items-center text-red-600 font-medium">
            <span>{(stats.novel_fold_clusters + stats.novel_domain_clusters).toLocaleString()} clusters</span>
            <span className="ml-2">&rarr;</span>
          </div>
        </Link>

        <Link
          href="/organisms"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Browse Organisms</h3>
          <p className="text-gray-600 text-sm mb-4">
            65 archaeal genomes across 21 phyla
          </p>
          <div className="flex items-center text-blue-600 font-medium">
            <span>{stats.total_proteins.toLocaleString()} proteins</span>
            <span className="ml-2">&rarr;</span>
          </div>
        </Link>
      </div>

      {/* Insight Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Sequence vs Structure */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sequence vs Structure</h3>
          <div className="space-y-3">
            <ProgressBar
              label="Both clustered"
              value={cross.both_clustered}
              total={cross.total || 1}
              color="bg-blue-500"
            />
            <ProgressBar
              label="Rescued by structure"
              value={cross.rescued_by_structure}
              total={cross.total || 1}
              color="bg-green-500"
            />
            <ProgressBar
              label="Sequence only"
              value={cross.seq_only}
              total={cross.total || 1}
              color="bg-yellow-500"
            />
            <ProgressBar
              label="Both singleton"
              value={cross.both_singleton}
              total={cross.total || 1}
              color="bg-gray-400"
            />
          </div>
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
            <span className="text-green-800 text-sm font-medium">
              {cross.rescued_by_structure.toLocaleString()} proteins rescued by structural clustering
            </span>
          </div>
        </div>

        {/* ECOD Sequence Homology */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">ECOD Sequence Homology</h3>
          <div className="space-y-3">
            <ProgressBar
              label="Has ECOD homolog"
              value={novelty.has_ecod}
              total={noveltyTotal || 1}
              color="bg-blue-500"
            />
            <ProgressBar
              label="Novel (no ECOD match)"
              value={novelty.novel}
              total={noveltyTotal || 1}
              color="bg-red-500"
            />
          </div>
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <span className="text-red-800 text-sm font-medium">
              {novelPct}% of proteins have no ECOD sequence homolog
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Protein Sources */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Protein Sources</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(stats.source_breakdown).map(([source, count]) => (
              <div key={source} className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{count.toLocaleString()}</div>
                <div className="text-sm text-gray-600">{source}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Domain Classification */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Domain Classification</h3>
          <div className="space-y-3">
            {Object.entries(stats.domain_judge_breakdown).map(([judge, count]) => (
              <ProgressBar
                key={judge}
                label={judge === 'NULL' ? 'Unclassified' : judge}
                value={count}
                total={stats.total_domains || 1}
                color={
                  judge === 'CLEAR_GOOD' ? 'bg-green-500' :
                  judge === 'AMBIGUOUS' ? 'bg-yellow-500' :
                  judge === 'CLEAR_BAD' ? 'bg-red-500' :
                  'bg-gray-400'
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
