'use client';

/**
 * Curation Queue — filterable, sortable list of proteins pending curation.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Pagination from '@/components/Pagination';
import { noveltyColor, statusColor } from '@/lib/utils';

const PAGE_SIZE = 50;

const NOVELTY_OPTIONS = [
  { value: 'all', label: 'All Novelty' },
  { value: 'dark', label: 'Dark' },
  { value: 'sequence-orphan', label: 'Sequence Orphan' },
  { value: 'divergent', label: 'Divergent' },
  { value: 'known', label: 'Known' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'all', label: 'All Status' },
  { value: 'in_review', label: 'In Review' },
  { value: 'classified', label: 'Classified' },
  { value: 'deferred', label: 'Deferred' },
  { value: 'rejected', label: 'Rejected' },
];

const SORT_OPTIONS = [
  { value: 'priority_rank', label: 'Priority' },
  { value: 'quality_score', label: 'Quality Score' },
  { value: 'mean_plddt', label: 'pLDDT' },
  { value: 'sequence_length', label: 'Length' },
];

export default function CurationPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="h-16 bg-gray-200 rounded mb-6"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    }>
      <CurationQueueContent />
    </Suspense>
  );
}

interface QueueItem {
  id: number;
  protein_id: string;
  novelty_category: string;
  priority_category: string;
  priority_rank: number | null;
  curation_status: string;
  structural_cluster_id: number | null;
  structural_cluster_size: number | null;
  is_novel_fold: boolean | null;
  uniprot_acc: string | null;
  sequence_length: number;
  source: string;
  has_structure: boolean;
  mean_plddt: number | null;
  quality_score: number | null;
  af3_quality_category: string | null;
  phylum: string | null;
}

function CurationQueueContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [noveltyFilter, setNoveltyFilter] = useState(searchParams.get('novelty') || 'all');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'pending');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'priority_rank');
  const [sortOrder, setSortOrder] = useState(searchParams.get('order') || 'ASC');
  const [offset, setOffset] = useState(parseInt(searchParams.get('offset') || '0'));

  const [data, setData] = useState<{ items: QueueItem[]; total: number; limit: number; offset: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      novelty: noveltyFilter,
      status: statusFilter,
      sort: sortBy,
      order: sortOrder,
      limit: String(PAGE_SIZE),
      offset: String(offset),
      has_structure: 'true',
    });

    try {
      const res = await fetch(`/api/curation/queue?${params}`);
      if (!res.ok) throw new Error('Failed to fetch queue');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, [noveltyFilter, statusFilter, sortBy, sortOrder, offset]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  // Update URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (noveltyFilter !== 'all') params.set('novelty', noveltyFilter);
    if (statusFilter !== 'pending') params.set('status', statusFilter);
    if (sortBy !== 'priority_rank') params.set('sort', sortBy);
    if (sortOrder !== 'ASC') params.set('order', sortOrder);
    if (offset > 0) params.set('offset', String(offset));
    const qs = params.toString();
    router.replace(`/curation${qs ? '?' + qs : ''}`, { scroll: false });
  }, [noveltyFilter, statusFilter, sortBy, sortOrder, offset, router]);

  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setOffset(0);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Curation Queue</h1>
          <p className="text-gray-600">
            {data ? `${data.total.toLocaleString()} proteins` : 'Loading...'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Novelty:</label>
            <select
              value={noveltyFilter}
              onChange={e => handleFilterChange(setNoveltyFilter, e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            >
              {NOVELTY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={statusFilter}
              onChange={e => handleFilterChange(setStatusFilter, e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Sort:</label>
            <select
              value={sortBy}
              onChange={e => handleFilterChange(setSortBy, e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              {sortOrder === 'ASC' ? '\u2191' : '\u2193'}
            </button>
          </div>

          <button onClick={fetchQueue} className="ml-auto text-sm text-blue-600 hover:text-blue-800">
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Protein</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Length</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Novelty</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">pLDDT</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quality</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phylum</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cluster</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-3 py-2"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
                    ))}
                  </tr>
                ))
              ) : data?.items.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-500">No proteins found.</td></tr>
              ) : (
                data?.items.map(item => (
                  <tr key={item.protein_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm font-mono">
                      <Link href={`/proteins/${item.protein_id}`} className="text-blue-600 hover:text-blue-800">
                        {item.protein_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">{item.sequence_length}</td>
                    <td className="px-3 py-2 text-sm">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${noveltyColor(item.novelty_category)}`}>
                        {item.novelty_category}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <PriorityBadge category={item.priority_category} rank={item.priority_rank} />
                    </td>
                    <td className="px-3 py-2 text-sm text-right">
                      {item.mean_plddt ? (
                        <span className={item.mean_plddt >= 70 ? 'text-green-600' : item.mean_plddt >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                          {parseFloat(String(item.mean_plddt)).toFixed(1)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">
                      {item.quality_score ? parseFloat(String(item.quality_score)).toFixed(2) : '-'}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 max-w-[100px] truncate">{item.phylum || '-'}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{item.structural_cluster_size || '-'}</td>
                    <td className="px-3 py-2 text-sm">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColor(item.curation_status)}`}>
                        {item.curation_status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <Link
                        href={`/curation/review/${item.protein_id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Review &rarr;
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="px-4 border-t border-gray-200">
            <Pagination total={data.total} limit={PAGE_SIZE} offset={offset} onPageChange={setOffset} />
          </div>
        )}
      </div>
    </div>
  );
}

function PriorityBadge({ category, rank }: { category: string; rank: number | null }) {
  const match = category.match(/priority_(\d+)/);
  const priorityNum = match ? match[1] : '?';

  const colors: Record<string, string> = {
    '1': 'bg-red-100 text-red-800',
    '2': 'bg-orange-100 text-orange-800',
    '3': 'bg-yellow-100 text-yellow-800',
    '4': 'bg-green-100 text-green-800',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-mono font-medium rounded ${colors[priorityNum] || 'bg-gray-100 text-gray-800'}`}>
      P{priorityNum}-{rank || '?'}
    </span>
  );
}
