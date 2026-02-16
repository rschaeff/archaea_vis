'use client';

/**
 * Novel Domain Analysis — two-tier browser for dark proteins and orphan domains.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import StatCard from '@/components/StatCard';
import Pagination from '@/components/Pagination';

interface Overview {
  tier1: { clusters: number; proteins: number; multi_member: number; cross_phylum: number };
  tier2: { clusters: number; domains: number; proteins: number; multi_member: number; cross_phylum_5plus: number };
  cross_tier_hits: number;
}

interface Tier1Row {
  cluster_id: string;
  cluster_size: number;
  cross_phylum: boolean;
  min_plddt: number | null;
  max_plddt: number | null;
  avg_plddt: number | null;
  phylum_count: number;
  phyla: string;
  genome_count: number;
}

interface Tier2Row {
  cluster_id: string;
  cluster_size: number;
  cross_phylum: boolean;
  min_plddt: number | null;
  max_plddt: number | null;
  avg_plddt: number | null;
  avg_dpam_prob: number | null;
  phylum_count: number;
  phyla: string;
  genome_count: number;
  protein_count: number;
}

interface ApiResponse {
  overview: Overview;
  tier: number;
  items: (Tier1Row | Tier2Row)[];
  total: number;
  limit: number;
  offset: number;
}

export default function NovelFoldBrowser() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tier, setTier] = useState<1 | 2>(1);
  const [minSize, setMinSize] = useState('1');
  const [crossPhylum, setCrossPhylum] = useState('');
  const [phylum, setPhylum] = useState('');
  const [sort, setSort] = useState('cluster_size');
  const [order, setOrder] = useState('DESC');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('tier', String(tier));
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    params.set('sort', sort);
    params.set('order', order);
    if (minSize && parseInt(minSize) > 1) params.set('min_size', minSize);
    if (crossPhylum) params.set('cross_phylum', crossPhylum);
    if (phylum) params.set('phylum', phylum);

    try {
      const res = await fetch(`/api/novel-folds?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch novel folds');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tier, minSize, crossPhylum, phylum, sort, order, offset]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTierChange = (newTier: 1 | 2) => {
    setTier(newTier);
    setSort('cluster_size');
    setOrder('DESC');
    setOffset(0);
    setMinSize('1');
    setCrossPhylum('');
    setPhylum('');
  };

  const handleSort = (column: string) => {
    if (sort === column) {
      setOrder(order === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSort(column);
      setOrder('DESC');
    }
    setOffset(0);
  };

  const SortHeader = ({ column, label, className }: { column: string; label: string; className?: string }) => (
    <th
      className={`px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none ${className || ''}`}
      onClick={() => handleSort(column)}
    >
      {label}
      {sort === column && <span className="ml-1">{order === 'ASC' ? '\u25B2' : '\u25BC'}</span>}
    </th>
  );

  const overview = data?.overview;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Novel Domain Analysis</h1>
        <p className="text-gray-600 mt-1">
          Two-tier novelty spectrum: fully dark proteins (zero DPAM domains) and orphan domains (low-confidence, no Pfam)
        </p>
      </div>

      {/* Overview Stats */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Tier 1: Dark Proteins"
            value={String(overview.tier1.proteins)}
            subtitle={`${overview.tier1.clusters} clusters`}
            color="red"
          />
          <StatCard
            title="Tier 2: Orphan Domains"
            value={overview.tier2.domains.toLocaleString()}
            subtitle={`${overview.tier2.clusters.toLocaleString()} clusters`}
            color="amber"
          />
          <StatCard
            title="Cross-tier Matches"
            value={String(overview.cross_tier_hits)}
            subtitle="structural links"
            color="purple"
          />
          <StatCard
            title="Cross-phylum (5+)"
            value={String(overview.tier2.cross_phylum_5plus)}
            subtitle="T2 clusters span 5+ phyla"
            color="green"
          />
        </div>
      )}

      {/* Tier Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => handleTierChange(1)}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            tier === 1
              ? 'border-red-500 text-red-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Tier 1: Dark Proteins
          {overview && <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{overview.tier1.clusters}</span>}
        </button>
        <button
          onClick={() => handleTierChange(2)}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            tier === 2
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Tier 2: Orphan Domains
          {overview && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{overview.tier2.clusters.toLocaleString()}</span>}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Cross-phylum</label>
            <select
              value={crossPhylum}
              onChange={e => { setCrossPhylum(e.target.value); setOffset(0); }}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Phylum</label>
            <input
              type="text"
              value={phylum}
              onChange={e => { setPhylum(e.target.value); setOffset(0); }}
              placeholder="Filter by phylum"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setMinSize('1'); setCrossPhylum(''); setPhylum(''); setOffset(0); }}
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
          {tier === 1 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortHeader column="cluster_id" label="Cluster" />
                  <SortHeader column="cluster_size" label="Size" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cross-phylum</th>
                  <SortHeader column="avg_plddt" label="Avg pLDDT" />
                  <SortHeader column="phylum_count" label="Phyla" />
                  <SortHeader column="genome_count" label="Genomes" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phyla</th>
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
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">No clusters found.</td></tr>
                ) : (
                  (data?.items as Tier1Row[])?.map(c => (
                    <tr key={c.cluster_id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm">
                        <Link href={`/novel-folds/${c.cluster_id}`} className="text-blue-600 hover:text-blue-800 font-mono">
                          {c.cluster_id}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right">{c.cluster_size}</td>
                      <td className="px-3 py-2 text-sm text-center">
                        {c.cross_phylum ? (
                          <span className="text-green-600 font-medium">Yes</span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right">{c.avg_plddt?.toFixed(1) || '-'}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right">{c.phylum_count}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right">{c.genome_count}</td>
                      <td className="px-3 py-2 text-sm text-gray-600 max-w-[200px] truncate" title={c.phyla}>
                        {c.phyla}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortHeader column="cluster_id" label="Cluster" />
                  <SortHeader column="cluster_size" label="Domains" />
                  <SortHeader column="protein_count" label="Proteins" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cross-phylum</th>
                  <SortHeader column="avg_plddt" label="Avg pLDDT" />
                  <SortHeader column="avg_dpam_prob" label="Avg DPAM" />
                  <SortHeader column="phylum_count" label="Phyla" />
                  <SortHeader column="genome_count" label="Genomes" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phyla</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-3 py-2"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
                      ))}
                    </tr>
                  ))
                ) : data?.items.length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">No clusters found.</td></tr>
                ) : (
                  (data?.items as Tier2Row[])?.map(c => (
                    <tr key={c.cluster_id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm">
                        <Link href={`/novel-folds/${c.cluster_id}`} className="text-blue-600 hover:text-blue-800 font-mono">
                          {c.cluster_id}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right">{c.cluster_size}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right">{c.protein_count}</td>
                      <td className="px-3 py-2 text-sm text-center">
                        {c.cross_phylum ? (
                          <span className="text-green-600 font-medium">Yes</span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right">{c.avg_plddt?.toFixed(1) || '-'}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right">{c.avg_dpam_prob?.toFixed(3) || '-'}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right">{c.phylum_count}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right">{c.genome_count}</td>
                      <td className="px-3 py-2 text-sm text-gray-600 max-w-[200px] truncate" title={c.phyla}>
                        {c.phyla}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
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
