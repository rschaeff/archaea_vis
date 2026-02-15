'use client';

/**
 * Organism Browser — all 65 target organisms with aggregated stats.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { noveltyColor } from '@/lib/utils';

interface Organism {
  id: number;
  class_name: string;
  organism_name: string;
  phylum: string;
  major_group: string;
  genome_accession: string;
  tax_id: number;
  source_category: string;
  completeness: number | null;
  contamination: number | null;
  quality_tier: string | null;
  protein_count: number;
  actual_protein_count: string;
  proteins_with_structures: string;
  proteins_with_pae: string;
  domain_count: string;
  proteins_with_domains: string;
  good_domains: string;
  novel_fold_count: string;
  avg_plddt: string | null;
  avg_quality_score: string | null;
  curation_pending: string;
  curation_classified: string;
  curation_total: string;
}

interface FilterOption {
  value: string;
  count: number;
}

interface OrganismData {
  organisms: Organism[];
  total: number;
  filters: {
    phyla: FilterOption[];
    major_groups: FilterOption[];
  };
}

type SortKey = 'organism_name' | 'protein_count' | 'proteins_with_structures' |
  'proteins_with_domains' | 'domain_count' | 'novel_fold_count' | 'avg_plddt' |
  'completeness' | 'curation_pending';

export default function OrganismsPage() {
  const [data, setData] = useState<OrganismData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phylumFilter, setPhylumFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('protein_count');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  useEffect(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ sort: sortBy, order: sortOrder });
    if (phylumFilter !== 'all') params.set('phylum', phylumFilter);
    if (groupFilter !== 'all') params.set('major_group', groupFilter);

    fetch(`/api/organisms?${params}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch organisms');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [phylumFilter, groupFilter, sortBy, sortOrder]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(key);
      setSortOrder(key === 'organism_name' ? 'ASC' : 'DESC');
    }
  };

  const sortIndicator = (key: SortKey) =>
    sortBy === key ? (sortOrder === 'ASC' ? ' \u2191' : ' \u2193') : '';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Target Organisms</h1>
        <p className="text-gray-600">
          {data ? `${data.total} genomes across ${data.filters.phyla.length} phyla` : 'Loading...'}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Phylum:</label>
            <select
              value={phylumFilter}
              onChange={e => setPhylumFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            >
              <option value="all">All Phyla</option>
              {data?.filters.phyla.map(p => (
                <option key={p.value} value={p.value}>{p.value} ({p.count})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Group:</label>
            <select
              value={groupFilter}
              onChange={e => setGroupFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            >
              <option value="all">All Groups</option>
              {data?.filters.major_groups.map(g => (
                <option key={g.value} value={g.value}>{g.value} ({g.count})</option>
              ))}
            </select>
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
                <SortHeader label="Organism" sortKey="organism_name" current={sortBy} order={sortOrder} onClick={toggleSort} />
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phylum</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                <SortHeader label="Proteins" sortKey="protein_count" current={sortBy} order={sortOrder} onClick={toggleSort} right />
                <SortHeader label="Structures" sortKey="proteins_with_structures" current={sortBy} order={sortOrder} onClick={toggleSort} right />
                <SortHeader label="Domains" sortKey="domain_count" current={sortBy} order={sortOrder} onClick={toggleSort} right />
                <SortHeader label="Avg pLDDT" sortKey="avg_plddt" current={sortBy} order={sortOrder} onClick={toggleSort} right />
                <SortHeader label="Novel" sortKey="novel_fold_count" current={sortBy} order={sortOrder} onClick={toggleSort} right />
                <SortHeader label="Pending" sortKey="curation_pending" current={sortBy} order={sortOrder} onClick={toggleSort} right />
                <SortHeader label="Complete" sortKey="completeness" current={sortBy} order={sortOrder} onClick={toggleSort} right />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-3 py-2"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    ))}
                  </tr>
                ))
              ) : data?.organisms.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-500">No organisms found.</td></tr>
              ) : (
                data?.organisms.map(org => {
                  const proteins = parseInt(org.actual_protein_count);
                  const structures = parseInt(org.proteins_with_structures);
                  const structPct = proteins > 0 ? (structures / proteins * 100).toFixed(0) : '0';
                  const domains = parseInt(org.domain_count);
                  const domProteins = parseInt(org.proteins_with_domains);
                  const domPct = proteins > 0 ? (domProteins / proteins * 100).toFixed(0) : '0';
                  const novel = parseInt(org.novel_fold_count);
                  const pending = parseInt(org.curation_pending);
                  const curTotal = parseInt(org.curation_total);

                  return (
                    <tr key={org.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm">
                        <Link href={`/organisms/${org.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                          {org.organism_name}
                        </Link>
                        <div className="text-xs text-gray-500">{org.class_name}</div>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600 max-w-[120px] truncate" title={org.phylum}>
                        {org.phylum}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          org.source_category === 'AFDB' ? 'bg-blue-100 text-blue-800' :
                          org.source_category === 'UniParc' ? 'bg-green-100 text-green-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {org.source_category}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right">{proteins.toLocaleString()}</td>
                      <td className="px-3 py-2 text-sm text-right">
                        <span className="text-gray-900">{structures.toLocaleString()}</span>
                        <span className="text-gray-400 text-xs ml-1">({structPct}%)</span>
                      </td>
                      <td className="px-3 py-2 text-sm text-right">
                        <span className="text-gray-900">{domains.toLocaleString()}</span>
                        <span className="text-gray-400 text-xs ml-1">({domPct}%)</span>
                      </td>
                      <td className="px-3 py-2 text-sm text-right">
                        {org.avg_plddt ? (
                          <span className={
                            parseFloat(org.avg_plddt) >= 70 ? 'text-green-600' :
                            parseFloat(org.avg_plddt) >= 50 ? 'text-yellow-600' : 'text-red-600'
                          }>
                            {parseFloat(org.avg_plddt).toFixed(1)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-3 py-2 text-sm text-right">
                        {novel > 0 ? (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800">
                            {novel}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-3 py-2 text-sm text-right">
                        {curTotal > 0 ? (
                          <span className={pending > 0 ? 'text-yellow-600' : 'text-green-600'}>
                            {pending}/{curTotal}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-3 py-2 text-sm text-right">
                        {org.completeness != null ? (
                          <span className={
                            org.completeness >= 95 ? 'text-green-600' :
                            org.completeness >= 80 ? 'text-yellow-600' : 'text-red-600'
                          }>
                            {Number(org.completeness).toFixed(1)}%
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SortHeader({
  label, sortKey, current, order, onClick, right,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  order: 'ASC' | 'DESC';
  onClick: (key: SortKey) => void;
  right?: boolean;
}) {
  const active = current === sortKey;
  return (
    <th
      className={`px-3 py-2 text-xs font-medium uppercase cursor-pointer hover:bg-gray-100 select-none ${
        right ? 'text-right' : 'text-left'
      } ${active ? 'text-blue-600' : 'text-gray-500'}`}
      onClick={() => onClick(sortKey)}
    >
      {label}{active ? (order === 'ASC' ? ' \u2191' : ' \u2193') : ''}
    </th>
  );
}
