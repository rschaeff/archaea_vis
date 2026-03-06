'use client';

/**
 * Novel Domain Analysis — two-tier browser for dark proteins and orphan domains.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import StatCard from '@/components/StatCard';
import Pagination from '@/components/Pagination';
import { lddtClassColor, lddtClassLabel, darkMatterClassColor, darkMatterClassLabel, daliZscoreColor, daliZscoreLabel } from '@/lib/utils';

interface Overview {
  tier1: { clusters: number; proteins: number; multi_member: number; cross_phylum: number; dark_matter_counts: Record<string, number> };
  tier2: { clusters: number; domains: number; proteins: number; multi_member: number; cross_phylum_5plus: number; lddt_tier_counts: Record<string, number> };
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
  dark_matter_class: string | null;
  all_helix: boolean;
  dali_best_zscore: number | null;
  dali_hit_count: number;
  dali_best_hit: string | null;
  dali_best_library: string | null;
  dali_searched: boolean;
  avg_neff: number | null;
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
  avg_best_lddt: number | null;
  lddt_classification: string | null;
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
  const [lddtClass, setLddtClass] = useState('');
  const [darkMatterClassFilter, setDarkMatterClassFilter] = useState('');
  const [excludeHelix, setExcludeHelix] = useState(false);
  const [daliFilter, setDaliFilter] = useState('');
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
    if (lddtClass && tier === 2) params.set('lddt_class', lddtClass);
    if (darkMatterClassFilter && tier === 1) params.set('dark_matter_class', darkMatterClassFilter);
    if (excludeHelix && tier === 1) params.set('exclude_helix', 'true');
    if (daliFilter && tier === 1) params.set('dali_filter', daliFilter);

    try {
      const res = await fetch(`/api/novel-folds?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch novel folds');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tier, minSize, crossPhylum, phylum, lddtClass, darkMatterClassFilter, excludeHelix, daliFilter, sort, order, offset]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTierChange = (newTier: 1 | 2) => {
    setTier(newTier);
    setSort('cluster_size');
    setOrder('DESC');
    setOffset(0);
    setMinSize('1');
    setCrossPhylum('');
    setPhylum('');
    setLddtClass('');
    setDarkMatterClassFilter('');
    setExcludeHelix(false);
    setDaliFilter('');
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
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
          {tier === 1 && overview.tier1.dark_matter_counts && (
            <>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
                <DmStatCard label="Genuine Dark" count={overview.tier1.dark_matter_counts['GENUINE_DARK'] || 0} colorClass="text-red-700" bgClass="bg-red-50" />
                <DmStatCard label="Rescue" count={overview.tier1.dark_matter_counts['RESCUE'] || 0} colorClass="text-green-700" bgClass="bg-green-50" />
                <DmStatCard label="Sub-threshold" count={overview.tier1.dark_matter_counts['SUB_THRESHOLD'] || 0} colorClass="text-yellow-700" bgClass="bg-yellow-50" />
                <DmStatCard label="Low Quality" count={overview.tier1.dark_matter_counts['LOW_CONFIDENCE_STRUCTURE'] || 0} colorClass="text-gray-500" bgClass="bg-gray-50" />
                <DmStatCard label="Too Short" count={overview.tier1.dark_matter_counts['TOO_SHORT'] || 0} colorClass="text-gray-500" bgClass="bg-gray-50" />
                <DmStatCard label="Classified" count={overview.tier1.dark_matter_counts['CLASSIFIED'] || 0} colorClass="text-blue-700" bgClass="bg-blue-50" />
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 text-sm text-gray-600">
                <p className="font-medium text-gray-800 mb-2">Dark Matter Classification</p>
                <p className="mb-2">
                  Each Tier 1 cluster is classified by cross-referencing its members against
                  protein-level structural clusters (PXC). The class reflects the most &ldquo;novel&rdquo;
                  member&mdash;if any member lacks explanation, the whole cluster is flagged for curation.
                </p>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
                  <div className="flex gap-2">
                    <dt><span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Genuine Dark</span></dt>
                    <dd>No DPAM domains, well-folded (pLDDT &ge; 70), &ge; 100 aa. True curation targets.</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt><span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Rescue</span></dt>
                    <dd>Sub-threshold domains whose DXC cluster contains good_domain members&mdash;classifiable by transitivity.</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt><span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Sub-threshold</span></dt>
                    <dd>DPAM found a domain hit but scored below the good_domain threshold. Calibration artifact.</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt><span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Low Quality</span></dt>
                    <dd>No domains and all members have pLDDT &lt; 70. Likely disordered or poorly predicted.</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt><span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Too Short</span></dt>
                    <dd>No domains, well-folded, but all members &lt; 100 aa. Below DPAM template matching sensitivity.</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt><span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Classified</span></dt>
                    <dd>At least one PXC cluster member has a good_domain assignment. Not structurally novel.</dd>
                  </div>
                </dl>
              </div>
            </>
          )}
          {tier === 2 && overview.tier2.lddt_tier_counts && (
            <div className="grid grid-cols-4 gap-3 mb-6">
              <LddtStatCard label="Novel" count={overview.tier2.lddt_tier_counts['NOVEL'] || 0} colorClass="text-purple-700" bgClass="bg-purple-50" />
              <LddtStatCard label="Weak" count={overview.tier2.lddt_tier_counts['WEAK_SIMILARITY'] || 0} colorClass="text-orange-700" bgClass="bg-orange-50" />
              <LddtStatCard label="Moderate" count={overview.tier2.lddt_tier_counts['MODERATE_SIMILARITY'] || 0} colorClass="text-yellow-700" bgClass="bg-yellow-50" />
              <LddtStatCard label="Strong" count={overview.tier2.lddt_tier_counts['ECOD_ASSIGNABLE'] || 0} colorClass="text-green-700" bgClass="bg-green-50" />
            </div>
          )}
        </>
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
          {tier === 1 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Dark Matter Class</label>
              <select
                value={darkMatterClassFilter}
                onChange={e => { setDarkMatterClassFilter(e.target.value); setOffset(0); }}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              >
                <option value="">All</option>
                <option value="GENUINE_DARK">Genuine Dark</option>
                <option value="RESCUE">Rescue</option>
                <option value="SUB_THRESHOLD">Sub-threshold</option>
                <option value="LOW_CONFIDENCE_STRUCTURE">Low Quality</option>
                <option value="TOO_SHORT">Too Short</option>
                <option value="CLASSIFIED">Classified</option>
              </select>
            </div>
          )}
          {tier === 1 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">DALI Result</label>
              <select
                value={daliFilter}
                onChange={e => { setDaliFilter(e.target.value); setOffset(0); }}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              >
                <option value="">All</option>
                <option value="strong">Strong (Z&ge;8)</option>
                <option value="moderate">Moderate (4-8)</option>
                <option value="weak">Weak (2-4)</option>
                <option value="no_hits">No Hits</option>
                <option value="not_searched">Not Searched</option>
              </select>
            </div>
          )}
          {tier === 2 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">LDDT Tier</label>
              <select
                value={lddtClass}
                onChange={e => { setLddtClass(e.target.value); setOffset(0); }}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              >
                <option value="">All</option>
                <option value="NOVEL">Novel (&lt;0.3)</option>
                <option value="WEAK_SIMILARITY">Weak (0.3-0.5)</option>
                <option value="MODERATE_SIMILARITY">Moderate (0.5-0.7)</option>
                <option value="ECOD_ASSIGNABLE">Strong (&ge;0.7)</option>
              </select>
            </div>
          )}
          <div className="flex items-end gap-3">
            {tier === 1 && (
              <label className="flex items-center gap-1.5 text-sm text-gray-600 pb-1 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={excludeHelix}
                  onChange={e => { setExcludeHelix(e.target.checked); setOffset(0); }}
                  className="rounded border-gray-300"
                />
                Hide single-helix
              </label>
            )}
            <button
              onClick={() => { setMinSize('1'); setCrossPhylum(''); setPhylum(''); setLddtClass(''); setDarkMatterClassFilter(''); setExcludeHelix(false); setDaliFilter(''); setOffset(0); }}
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
                  <SortHeader column="dark_matter_class" label="DM Class" />
                  <SortHeader column="dali_best_zscore" label="DALI Best Z" />
                  <SortHeader column="avg_neff" label="Avg Neff" />
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
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="px-3 py-2"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
                      ))}
                    </tr>
                  ))
                ) : data?.items.length === 0 ? (
                  <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-500">No clusters found.</td></tr>
                ) : (
                  (data?.items as Tier1Row[])?.map(c => (
                    <tr key={c.cluster_id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm">
                        <Link href={`/novel-folds/${c.cluster_id}`} target="_blank" className="text-blue-600 hover:text-blue-800 font-mono">
                          {c.cluster_id}
                        </Link>
                        {c.all_helix && (
                          <span className="ml-1.5 px-1 py-0.5 rounded text-[10px] font-medium bg-pink-100 text-pink-700" title="All members are single-helix structures">helix</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right">{c.cluster_size}</td>
                      <td className="px-3 py-2 text-sm text-center">
                        {c.cross_phylum ? (
                          <span className="text-green-600 font-medium">Yes</span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {c.dark_matter_class ? (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${darkMatterClassColor(c.dark_matter_class)}`}>
                            {darkMatterClassLabel(c.dark_matter_class)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {c.dali_searched ? (
                          c.dali_best_zscore != null ? (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${daliZscoreColor(c.dali_best_zscore)}`}>
                              Z={c.dali_best_zscore.toFixed(1)}
                              <span className="ml-1 opacity-75">({c.dali_hit_count})</span>
                            </span>
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${daliZscoreColor(0)}`}>
                              No hits
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-right">
                        {c.avg_neff != null ? (
                          <span className={c.avg_neff < 3 ? 'text-red-600' : c.avg_neff < 6 ? 'text-yellow-600' : 'text-green-600'}>
                            {c.avg_neff.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
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
                  <SortHeader column="avg_best_lddt" label="Avg LDDT" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">LDDT Tier</th>
                  <SortHeader column="phylum_count" label="Phyla" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phyla</th>
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
                  <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-500">No clusters found.</td></tr>
                ) : (
                  (data?.items as Tier2Row[])?.map(c => (
                    <tr key={c.cluster_id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm">
                        <Link href={`/novel-folds/${c.cluster_id}`} target="_blank" className="text-blue-600 hover:text-blue-800 font-mono">
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
                      <td className="px-3 py-2 text-sm text-gray-900 text-right">{c.avg_best_lddt?.toFixed(3) || '-'}</td>
                      <td className="px-3 py-2 text-sm">
                        {c.lddt_classification ? (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${lddtClassColor(c.lddt_classification)}`}>
                            {lddtClassLabel(c.lddt_classification)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right">{c.phylum_count}</td>
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

function DmStatCard({ label, count, colorClass, bgClass }: { label: string; count: number; colorClass: string; bgClass: string }) {
  return (
    <div className={`${bgClass} border border-gray-200 rounded-lg px-3 py-2 text-center`}>
      <div className={`text-lg font-bold ${colorClass}`}>{count.toLocaleString()}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function LddtStatCard({ label, count, colorClass, bgClass }: { label: string; count: number; colorClass: string; bgClass: string }) {
  return (
    <div className={`${bgClass} border border-gray-200 rounded-lg px-3 py-2 text-center`}>
      <div className={`text-lg font-bold ${colorClass}`}>{count.toLocaleString()}</div>
      <div className="text-xs text-gray-500">LDDT {label}</div>
    </div>
  );
}
