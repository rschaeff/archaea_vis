'use client';

/**
 * Protein Browser — paginated, filterable table of all archaea proteins
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Pagination from '@/components/Pagination';
import ProvenanceBadge from '@/components/ProvenanceBadge';

interface ProteinRow {
  protein_id: string;
  uniprot_acc: string | null;
  sequence_length: number;
  source: string;
  has_structure: boolean;
  cif_file: string | null;
  class_name: string | null;
  phylum: string | null;
  mean_plddt: number | null;
  quality_score: number | null;
  af3_quality_category: string | null;
  ss_category: string | null;
  domain_count: number;
}

interface ProteinListResponse {
  items: ProteinRow[];
  total: number;
  limit: number;
  offset: number;
}

export default function ProteinBrowserPage() {
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
      <ProteinBrowser />
    </Suspense>
  );
}

function ProteinBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State from URL params
  const [source, setSource] = useState(searchParams.get('source') || '');
  const [hasStructure, setHasStructure] = useState(searchParams.get('has_structure') || '');
  const [hasDomains, setHasDomains] = useState(searchParams.get('has_domains') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'protein_id');
  const [order, setOrder] = useState(searchParams.get('order') || 'ASC');
  const [offset, setOffset] = useState(parseInt(searchParams.get('offset') || '0'));
  const limit = 50;

  const [data, setData] = useState<ProteinListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProteins = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    params.set('sort', sort);
    params.set('order', order);
    if (source) params.set('source', source);
    if (hasStructure) params.set('has_structure', hasStructure);
    if (hasDomains) params.set('has_domains', hasDomains);
    if (search) params.set('search', search);

    try {
      const res = await fetch(`/api/proteins?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch proteins');
      const result: ProteinListResponse = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proteins');
    } finally {
      setLoading(false);
    }
  }, [source, hasStructure, hasDomains, search, sort, order, offset]);

  useEffect(() => {
    fetchProteins();
  }, [fetchProteins]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (source) params.set('source', source);
    if (hasStructure) params.set('has_structure', hasStructure);
    if (hasDomains) params.set('has_domains', hasDomains);
    if (search) params.set('search', search);
    if (sort !== 'protein_id') params.set('sort', sort);
    if (order !== 'ASC') params.set('order', order);
    if (offset > 0) params.set('offset', String(offset));

    const qs = params.toString();
    router.replace(`/proteins${qs ? '?' + qs : ''}`, { scroll: false });
  }, [source, hasStructure, hasDomains, search, sort, order, offset, router]);

  const handleSort = (column: string) => {
    if (sort === column) {
      setOrder(order === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSort(column);
      setOrder('ASC');
    }
    setOffset(0);
  };

  const handleFilterChange = () => {
    setOffset(0);
  };

  const SortHeader = ({ column, label, className }: { column: string; label: string; className?: string }) => (
    <th
      className={`px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none ${className || ''}`}
      onClick={() => handleSort(column)}
    >
      {label}
      {sort === column && (
        <span className="ml-1">{order === 'ASC' ? '\u25B2' : '\u25BC'}</span>
      )}
    </th>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Protein Browser</h1>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Search */}
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); handleFilterChange(); }}
              placeholder="Protein ID or UniProt"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>

          {/* Source */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Source</label>
            <select
              value={source}
              onChange={e => { setSource(e.target.value); handleFilterChange(); }}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            >
              <option value="">All Sources</option>
              <option value="AFDB">AFDB</option>
              <option value="Prodigal">Prodigal</option>
              <option value="UniParc">UniParc</option>
            </select>
          </div>

          {/* Has Structure */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Structure</label>
            <select
              value={hasStructure}
              onChange={e => { setHasStructure(e.target.value); handleFilterChange(); }}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            >
              <option value="">Any</option>
              <option value="true">Has Structure</option>
              <option value="false">No Structure</option>
            </select>
          </div>

          {/* Has Domains */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Domains</label>
            <select
              value={hasDomains}
              onChange={e => { setHasDomains(e.target.value); handleFilterChange(); }}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            >
              <option value="">Any</option>
              <option value="true">Has Domains</option>
              <option value="false">No Domains</option>
            </select>
          </div>

          {/* Clear */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearch('');
                setSource('');
                setHasStructure('');
                setHasDomains('');
                setOffset(0);
              }}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
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
                <SortHeader column="protein_id" label="Protein ID" />
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">UniProt</th>
                <SortHeader column="source" label="Source" />
                <SortHeader column="sequence_length" label="Length" />
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phylum</th>
                <SortHeader column="mean_plddt" label="pLDDT" />
                <SortHeader column="quality_score" label="Quality" />
                <SortHeader column="domain_count" label="Domains" />
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Structure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-3 py-2">
                        <div className="h-4 bg-gray-200 rounded w-16"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                    No proteins found matching your filters.
                  </td>
                </tr>
              ) : (
                data?.items.map(protein => (
                  <tr key={protein.protein_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm">
                      <Link
                        href={`/proteins/${protein.protein_id}`}
                        className="text-blue-600 hover:text-blue-800 font-mono"
                      >
                        {protein.protein_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {protein.uniprot_acc || '-'}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <ProvenanceBadge source={protein.source} cifFile={protein.cif_file} />
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">
                      {protein.sequence_length}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 max-w-[120px] truncate" title={protein.phylum || ''}>
                      {protein.phylum || '-'}
                    </td>
                    <td className="px-3 py-2 text-sm text-right">
                      <span className={getPlddtColor(protein.mean_plddt)}>
                        {protein.mean_plddt?.toFixed(1) || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">
                      {protein.quality_score?.toFixed(2) || '-'}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">
                      {protein.domain_count || 0}
                    </td>
                    <td className="px-3 py-2 text-sm text-center">
                      {protein.has_structure ? (
                        <span className="text-green-600" title="Has structure">&#x2713;</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && (
          <div className="px-4 border-t border-gray-200">
            <Pagination
              total={data.total}
              limit={data.limit}
              offset={data.offset}
              onPageChange={setOffset}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function getPlddtColor(plddt: number | null): string {
  if (plddt === null) return 'text-gray-400';
  if (plddt >= 90) return 'text-blue-600 font-medium';
  if (plddt >= 70) return 'text-cyan-600';
  if (plddt >= 50) return 'text-yellow-600';
  return 'text-orange-600';
}
