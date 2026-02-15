'use client';

/**
 * Cluster Detail — shows cluster info and member table with quality/curation data.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ProvenanceBadge from '@/components/ProvenanceBadge';
import { noveltyColor, statusColor } from '@/lib/utils';

interface ClusterDetail {
  cluster_id: number;
  cluster_rep_id: string;
  cluster_size: number;
  clustering_method: string;
  tm_threshold: number;
  member_count: number;
  avg_plddt: number | null;
  avg_quality_score: number | null;
  dark_count: number;
  pending_count: number;
}

interface MemberRow {
  protein_id: string;
  uniprot_acc: string | null;
  sequence_length: number;
  source: string;
  cif_file: string | null;
  is_representative: boolean;
  mean_plddt: number | null;
  quality_score: number | null;
  af3_quality_category: string | null;
  novelty_category: string | null;
  curation_status: string | null;
  phylum: string | null;
}

export default function ClusterDetailPage() {
  const params = useParams();
  const clusterId = params.id as string;

  const [data, setData] = useState<{ cluster: ClusterDetail; members: MemberRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clusterId) return;
    setLoading(true);
    fetch(`/api/clusters/${clusterId}`)
      .then(res => {
        if (res.status === 404) throw new Error('Cluster not found');
        if (!res.ok) throw new Error('Failed to fetch cluster');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load cluster'))
      .finally(() => setLoading(false));
  }, [clusterId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
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
          <Link href="/clusters" className="mt-4 inline-block text-blue-600 hover:text-blue-800">&larr; Back to Clusters</Link>
        </div>
      </div>
    );
  }

  const { cluster, members } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cluster #{cluster.cluster_id}</h1>
          <p className="text-gray-600 mt-1">
            Representative:{' '}
            <Link href={`/proteins/${cluster.cluster_rep_id}`} className="text-blue-600 hover:text-blue-800 font-mono">
              {cluster.cluster_rep_id}
            </Link>
            {' '}&middot; {cluster.cluster_size} members
            {' '}&middot; TM threshold {cluster.tm_threshold}
          </p>
        </div>
        <Link href="/clusters" className="text-blue-600 hover:text-blue-800 font-medium text-sm">&larr; Back</Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{cluster.cluster_size}</div>
          <div className="text-xs text-gray-500">Members</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">
            {cluster.avg_plddt ? parseFloat(String(cluster.avg_plddt)).toFixed(1) : '-'}
          </div>
          <div className="text-xs text-gray-500">Avg pLDDT</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">
            {cluster.avg_quality_score ? parseFloat(String(cluster.avg_quality_score)).toFixed(2) : '-'}
          </div>
          <div className="text-xs text-gray-500">Avg Quality</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className={`text-2xl font-bold ${cluster.dark_count > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {cluster.dark_count}
          </div>
          <div className="text-xs text-gray-500">Dark</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className={`text-2xl font-bold ${cluster.pending_count > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
            {cluster.pending_count}
          </div>
          <div className="text-xs text-gray-500">Pending</div>
        </div>
      </div>

      {/* Members table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Cluster Members ({members.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Protein</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Length</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phylum</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">pLDDT</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quality</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Novelty</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {members.map(m => (
                <tr key={m.protein_id} className={`hover:bg-gray-50 ${m.is_representative ? 'bg-blue-50' : ''}`}>
                  <td className="px-3 py-2 text-sm">
                    <Link href={`/proteins/${m.protein_id}`} className="text-blue-600 hover:text-blue-800 font-mono">
                      {m.protein_id}
                    </Link>
                    {m.is_representative && <span className="ml-1 text-xs text-blue-600">(rep)</span>}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <ProvenanceBadge source={m.source} cifFile={m.cif_file} />
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-right">{m.sequence_length}</td>
                  <td className="px-3 py-2 text-sm text-gray-600 max-w-[120px] truncate">{m.phylum || '-'}</td>
                  <td className="px-3 py-2 text-sm text-right">{m.mean_plddt ? parseFloat(String(m.mean_plddt)).toFixed(1) : '-'}</td>
                  <td className="px-3 py-2 text-sm text-right">{m.quality_score ? parseFloat(String(m.quality_score)).toFixed(2) : '-'}</td>
                  <td className="px-3 py-2 text-sm">
                    {m.novelty_category ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${noveltyColor(m.novelty_category)}`}>
                        {m.novelty_category}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {m.curation_status ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(m.curation_status)}`}>
                        {m.curation_status}
                      </span>
                    ) : '-'}
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
