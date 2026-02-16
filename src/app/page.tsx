'use client';

/**
 * Dashboard — Overview of archaeal protein dataset and pipeline progress
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import StatCard from '@/components/StatCard';
import ProgressBar from '@/components/ProgressBar';
import type { ArchaeaStats, CurationProgress } from '@/lib/types';

interface DashboardData {
  stats: ArchaeaStats;
  progress: CurationProgress[];
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch stats');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load statistics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-8"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
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

  const stats = data!.stats;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Archaea Protein Curation</h1>
        <p className="text-gray-600 mt-2">
          Novel fold discovery in archaeal proteins using AlphaFold structure predictions
        </p>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
          title="Novel Clusters"
          value={(stats.novel_fold_clusters + stats.novel_domain_clusters).toLocaleString()}
          subtitle={`${stats.novel_fold_clusters} dark protein + ${stats.novel_domain_clusters.toLocaleString()} orphan domain`}
          color="red"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Structural Clusters"
          value={stats.total_clusters.toLocaleString()}
          color="orange"
        />
        <StatCard
          title="Curation Candidates"
          value={stats.curation_candidates.toLocaleString()}
          color="purple"
        />
        <StatCard
          title="Quality Metrics"
          value={stats.with_quality_metrics.toLocaleString()}
          subtitle={`${((stats.with_quality_metrics / stats.total_proteins) * 100).toFixed(1)}%`}
          color="green"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link
          href="/curation?novelty=dark"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Dark Proteins</h3>
          <p className="text-gray-600 text-sm mb-4">
            Proteins with no sequence homologs — highest priority for novel fold discovery
          </p>
          <div className="flex items-center text-red-600 font-medium">
            <span>{stats.novelty_breakdown.dark.toLocaleString()} proteins</span>
            <span className="ml-2">&rarr;</span>
          </div>
        </Link>

        <Link
          href="/novel-folds"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Novel Domain Analysis</h3>
          <p className="text-gray-600 text-sm mb-4">
            Two-tier novelty: dark proteins and orphan domains clustered by foldseek structural similarity
          </p>
          <div className="flex items-center text-purple-600 font-medium">
            <span>{(stats.novel_fold_clusters + stats.novel_domain_clusters).toLocaleString()} clusters</span>
            <span className="ml-2">&rarr;</span>
          </div>
        </Link>

        <Link
          href="/clusters"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Structural Clusters</h3>
          <p className="text-gray-600 text-sm mb-4">
            All structural clusters from foldseek — browse by size and novelty content
          </p>
          <div className="flex items-center text-orange-600 font-medium">
            <span>{stats.total_clusters.toLocaleString()} clusters</span>
            <span className="ml-2">&rarr;</span>
          </div>
        </Link>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Novelty Breakdown */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">By Novelty Category</h3>
          <div className="space-y-3">
            <ProgressBar
              label="Dark (no homologs)"
              value={stats.novelty_breakdown.dark}
              total={stats.curation_candidates || 1}
              color="bg-red-500"
            />
            <ProgressBar
              label="Sequence Orphan"
              value={stats.novelty_breakdown['sequence-orphan']}
              total={stats.curation_candidates || 1}
              color="bg-orange-500"
            />
            <ProgressBar
              label="Divergent"
              value={stats.novelty_breakdown.divergent}
              total={stats.curation_candidates || 1}
              color="bg-yellow-500"
            />
            <ProgressBar
              label="Known"
              value={stats.novelty_breakdown.known}
              total={stats.curation_candidates || 1}
              color="bg-green-500"
            />
          </div>
        </div>

        {/* Curation Status */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Curation Status</h3>
          <div className="space-y-3">
            <ProgressBar
              label="Pending"
              value={stats.status_breakdown.pending}
              total={stats.curation_candidates || 1}
              color="bg-gray-500"
            />
            <ProgressBar
              label="In Review"
              value={stats.status_breakdown.in_review}
              total={stats.curation_candidates || 1}
              color="bg-blue-500"
            />
            <ProgressBar
              label="Classified"
              value={stats.status_breakdown.classified}
              total={stats.curation_candidates || 1}
              color="bg-green-500"
            />
            <ProgressBar
              label="Deferred"
              value={stats.status_breakdown.deferred}
              total={stats.curation_candidates || 1}
              color="bg-yellow-500"
            />
            <ProgressBar
              label="Rejected"
              value={stats.status_breakdown.rejected}
              total={stats.curation_candidates || 1}
              color="bg-red-500"
            />
          </div>
        </div>
      </div>

      {/* Source and Domain Breakdowns */}
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

        {/* Domain Judge Breakdown */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Domain Classification (Judge)</h3>
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
