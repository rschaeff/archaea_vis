'use client';

/**
 * Structural Cluster Browser — filterable, sortable list of foldseek clusters.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Pagination from '@/components/Pagination';

interface ClusterRow {
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

export default function ClusterBrowser() {
  const [data, setData] = useState<{ items: ClusterRow[]; total: number; limit: number; offset: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [minSize, setMinSize] = useState('2');
  const [hasDark, setHasDark] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('cluster_size');
  const [order, setOrder] = useState('DESC');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    params.set('sort', sort);
    params.set('order', order);
    if (minSize) params.set('min_size', minSize);
    if (hasDark) params.set('has_dark', hasDark);
    if (search) params.set('search', search);

    try {
      const res = await fetch(`/api/clusters?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch clusters');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clusters');
    } finally {
      setLoading(false);
    }
  }, [minSize, hasDark, search, sort, order, offset]);

  useEffect(() => { fetchClusters(); }, [fetchClusters]);

  const handleSort = (column: string) => {
    if (sort === column) {
      setOrder(order === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSort(column);
      setOrder('DESC');
    }
    setOffset(0);
  };

  const SortHeader = ({ column, label }: { column: string; label: string }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
      onClick={() => handleSort(column)}
    >
      {label}
      {sort === column && <span className="ml-1">{order === 'ASC' ? '\u25B2' : '\u25BC'}</span>}
    </th>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Structural Clusters</h1>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Search (rep ID)</label>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setOffset(0); }}
              placeholder="Representative ID"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Min Size</label>
            <input
              type="number"
              value={minSize}
              onChange={e => { setMinSize(e.target.value); setOffset(0); }}
              min="1"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Dark Proteins</label>
            <select
              value={hasDark}
              onChange={e => { setHasDark(e.target.value); setOffset(0); }}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            >
              <option value="">Any</option>
              <option value="true">Has Dark</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setSearch(''); setMinSize('2'); setHasDark(''); setOffset(0); }}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
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
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Representative</th>
                <SortHeader column="cluster_size" label="Size" />
                <SortHeader column="avg_plddt" label="Avg pLDDT" />
                <SortHeader column="avg_quality_score" label="Avg Quality" />
                <SortHeader column="dark_count" label="Dark" />
                <SortHeader column="pending_count" label="Pending" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-3 py-2"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
                    ))}
                  </tr>
                ))
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">No clusters found.</td>
                </tr>
              ) : (
                data?.items.map(c => (
                  <tr key={c.cluster_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm">
                      <Link href={`/clusters/${c.cluster_id}`} className="text-blue-600 hover:text-blue-800">
                        {c.cluster_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <Link href={`/proteins/${c.cluster_rep_id}`} className="text-blue-600 hover:text-blue-800 font-mono">
                        {c.cluster_rep_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">{c.cluster_size}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">
                      {c.avg_plddt ? parseFloat(String(c.avg_plddt)).toFixed(1) : '-'}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">
                      {c.avg_quality_score ? parseFloat(String(c.avg_quality_score)).toFixed(2) : '-'}
                    </td>
                    <td className="px-3 py-2 text-sm text-right">
                      {c.dark_count > 0 ? (
                        <span className="text-red-600 font-medium">{c.dark_count}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-right">
                      {c.pending_count > 0 ? (
                        <span className="text-orange-600">{c.pending_count}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="px-4 border-t border-gray-200">
            <Pagination total={data.total} limit={data.limit} offset={data.offset} onPageChange={setOffset} />
          </div>
        )}
      </div>
    </div>
  );
}
