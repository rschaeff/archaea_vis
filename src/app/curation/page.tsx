'use client';

/**
 * DXC Cluster Browser — filterable, sortable list of domain structural clusters.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Pagination from '@/components/Pagination';
import { lddtClassColor, lddtClassLabel } from '@/lib/utils';
import type { DxcClusterRow } from '@/lib/types';

const PAGE_SIZE = 50;

const XGROUP_OPTIONS = [
  { value: '0', label: 'All X-groups' },
  { value: '2', label: '2+ X-groups' },
  { value: '3', label: '3+ X-groups' },
  { value: '4', label: '4+ X-groups' },
];

const PFAM_OPTIONS = [
  { value: 'all', label: 'All Pfam' },
  { value: 'yes', label: 'Has Pfam' },
  { value: 'no', label: 'No Pfam' },
];

const LDDT_OPTIONS = [
  { value: 'all', label: 'All LDDT' },
  { value: 'NOVEL', label: 'Novel' },
  { value: 'WEAK_SIMILARITY', label: 'Weak Similarity' },
  { value: 'MODERATE_SIMILARITY', label: 'Moderate Similarity' },
  { value: 'ECOD_ASSIGNABLE', label: 'Strong Similarity' },
];

const SORT_OPTIONS = [
  { value: 'deep_homology_score', label: 'Deep Homology' },
  { value: 'cluster_size', label: 'Cluster Size' },
  { value: 'n_xgroups', label: 'X-groups' },
  { value: 'n_tgroups', label: 'T-groups' },
  { value: 'n_good_domain', label: 'Good Domains' },
  { value: 'n_seq_clusters', label: 'Seq Clusters' },
  { value: 'n_pfam_families', label: 'Pfam Families' },
  { value: 'taxonomic_entropy', label: 'Taxonomic Entropy' },
  { value: 'n_classes', label: 'Classes' },
  { value: 'avg_best_lddt', label: 'Avg LDDT' },
  { value: 'lddt_classification', label: 'LDDT Tier' },
];

interface OverviewStats {
  total_clusters: number;
  multi_xgroup_good_domain: number;
  reciprocal_bridges: number;
  mean_deep_homology: number | null;
  lddt_tier_counts: Record<string, number>;
}

interface ClusterResponse {
  overview: OverviewStats;
  items: DxcClusterRow[];
  total: number;
  limit: number;
  offset: number;
}

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
      <DxcBrowserContent />
    </Suspense>
  );
}

function DxcBrowserContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [minXgroups, setMinXgroups] = useState(searchParams.get('min_xgroups') || '0');
  const [minSize, setMinSize] = useState(searchParams.get('min_size') || '5');
  const [minDeepHomology, setMinDeepHomology] = useState(searchParams.get('min_deep_homology') || '0');
  const [minGoodDomain, setMinGoodDomain] = useState(searchParams.get('min_good_domain') || '0');
  const [hasPfam, setHasPfam] = useState(searchParams.get('has_pfam') || 'all');
  const [lddtClass, setLddtClass] = useState(searchParams.get('lddt_class') || 'all');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'deep_homology_score');
  const [sortOrder, setSortOrder] = useState(searchParams.get('order') || 'DESC');
  const [offset, setOffset] = useState(parseInt(searchParams.get('offset') || '0'));

  const [data, setData] = useState<ClusterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      min_xgroups: minXgroups,
      min_size: minSize,
      min_deep_homology: minDeepHomology,
      min_good_domain: minGoodDomain,
      has_pfam: hasPfam,
      lddt_class: lddtClass,
      sort: sortBy,
      order: sortOrder,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });

    try {
      const res = await fetch(`/api/curation/clusters?${params}`);
      if (!res.ok) throw new Error('Failed to fetch clusters');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clusters');
    } finally {
      setLoading(false);
    }
  }, [minXgroups, minSize, minDeepHomology, minGoodDomain, hasPfam, lddtClass, sortBy, sortOrder, offset]);

  useEffect(() => { fetchClusters(); }, [fetchClusters]);

  // Update URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (minXgroups !== '0') params.set('min_xgroups', minXgroups);
    if (minSize !== '5') params.set('min_size', minSize);
    if (minDeepHomology !== '0') params.set('min_deep_homology', minDeepHomology);
    if (minGoodDomain !== '0') params.set('min_good_domain', minGoodDomain);
    if (hasPfam !== 'all') params.set('has_pfam', hasPfam);
    if (lddtClass !== 'all') params.set('lddt_class', lddtClass);
    if (sortBy !== 'deep_homology_score') params.set('sort', sortBy);
    if (sortOrder !== 'DESC') params.set('order', sortOrder);
    if (offset > 0) params.set('offset', String(offset));
    const qs = params.toString();
    router.replace(`/curation${qs ? '?' + qs : ''}`, { scroll: false });
  }, [minXgroups, minSize, minDeepHomology, minGoodDomain, hasPfam, lddtClass, sortBy, sortOrder, offset, router]);

  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setOffset(0);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">DXC Cluster Browser</h1>
          <p className="text-gray-600">
            Domain structural clusters bridging ECOD X-groups and novel families
          </p>
        </div>
        <Link
          href="/curation/bridges"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          Reciprocal Bridges
        </Link>
      </div>

      {/* Score definitions */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-6 text-sm text-gray-600 space-y-2">
        <p>
          <span className="font-semibold text-gray-700">Deep Homology Score</span> (ad hoc) = H<sub>seq</sub> &times; H<sub>tax</sub>, where
          H<sub>seq</sub> is Shannon entropy (log2) over sequence cluster membership counts and
          H<sub>tax</sub> is Shannon entropy over organism class counts within the structural cluster.
          This is a convenience ranking metric, not literature-derived. High values flag clusters with both high sequence diversity and broad taxonomic spread.
        </p>
        <p>
          <span className="font-semibold text-gray-700">LDDT Classification</span> assigns each cluster a tier based on foldseek structural similarity (avg best LDDT) to ECOD representatives:
          {' '}<span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">Novel</span> (&lt;0.3)
          {' '}<span className="px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">Weak</span> (0.3&ndash;0.5)
          {' '}<span className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Moderate</span> (0.5&ndash;0.7)
          {' '}<span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Strong</span> (&ge;0.7).
        </p>
      </div>

      {/* Overview Stats */}
      {data?.overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Clusters" value={data.overview.total_clusters.toLocaleString()} />
          <StatCard label="Multi-X-group (good domain)" value={data.overview.multi_xgroup_good_domain.toLocaleString()} />
          <StatCard label="Reciprocal Bridges" value={String(data.overview.reciprocal_bridges)} />
          <StatCard
            label="Mean Deep Homology"
            value={data.overview.mean_deep_homology != null ? data.overview.mean_deep_homology.toFixed(3) : '-'}
          />
          {data.overview.lddt_tier_counts && Object.keys(data.overview.lddt_tier_counts).length > 0 && (
            <>
              <TierStatCard label="Novel" count={data.overview.lddt_tier_counts['NOVEL'] || 0} colorClass="text-purple-700" />
              <TierStatCard label="Weak Similarity" count={data.overview.lddt_tier_counts['WEAK_SIMILARITY'] || 0} colorClass="text-orange-700" />
              <TierStatCard label="Moderate" count={data.overview.lddt_tier_counts['MODERATE_SIMILARITY'] || 0} colorClass="text-yellow-700" />
              <TierStatCard label="Strong" count={data.overview.lddt_tier_counts['ECOD_ASSIGNABLE'] || 0} colorClass="text-green-700" />
            </>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <FilterSelect label="X-groups" value={minXgroups} options={XGROUP_OPTIONS}
            onChange={v => handleFilterChange(setMinXgroups, v)} />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Min Size</label>
            <input type="number" value={minSize} min={0}
              onChange={e => handleFilterChange(setMinSize, e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-20" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Min Deep Homology</label>
            <input type="number" value={minDeepHomology} min={0} step={0.1}
              onChange={e => handleFilterChange(setMinDeepHomology, e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-24" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Min Good Domain</label>
            <input type="number" value={minGoodDomain} min={0}
              onChange={e => handleFilterChange(setMinGoodDomain, e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-20" />
          </div>

          <FilterSelect label="Pfam" value={hasPfam} options={PFAM_OPTIONS}
            onChange={v => handleFilterChange(setHasPfam, v)} />

          <FilterSelect label="LDDT Tier" value={lddtClass} options={LDDT_OPTIONS}
            onChange={v => handleFilterChange(setLddtClass, v)} />

          <FilterSelect label="Sort" value={sortBy} options={SORT_OPTIONS}
            onChange={v => handleFilterChange(setSortBy, v)} />

          <button
            onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            {sortOrder === 'ASC' ? '\u2191 Asc' : '\u2193 Desc'}
          </button>

          <button onClick={fetchClusters} className="ml-auto text-sm text-blue-600 hover:text-blue-800">
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Filtered count */}
      {data && !loading && (
        <p className="text-sm text-gray-500 mb-2">{data.total.toLocaleString()} clusters match filters</p>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cluster</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Size</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">X-groups</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">T-groups</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dominant T-group</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Good Dom</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Seq Clust</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Classes</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pfam</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Deep Homol.</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">LDDT Tier</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 12 }).map((_, j) => (
                      <td key={j} className="px-3 py-2"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
                    ))}
                  </tr>
                ))
              ) : data?.items.length === 0 ? (
                <tr><td colSpan={12} className="px-3 py-8 text-center text-gray-500">No clusters match filters.</td></tr>
              ) : (
                data?.items.map(item => (
                  <tr key={item.struct_cluster_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm font-mono">
                      <Link href={`/curation/cluster/${item.struct_cluster_id}`} className="text-blue-600 hover:text-blue-800">
                        {item.struct_cluster_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm text-right">{item.cluster_size}</td>
                    <td className="px-3 py-2 text-sm text-right">
                      <span className={item.n_xgroups >= 2 ? 'font-bold text-indigo-700' : ''}>
                        {item.n_xgroups}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-right">{item.n_tgroups}</td>
                    <td className="px-3 py-2 text-sm text-gray-600 max-w-[120px] truncate" title={item.dominant_tgroup || ''}>
                      {item.dominant_tgroup || '-'}
                      {item.dominant_tgroup_frac != null && (
                        <span className="text-xs text-gray-400 ml-1">({(item.dominant_tgroup_frac * 100).toFixed(0)}%)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-right">{item.n_good_domain}</td>
                    <td className="px-3 py-2 text-sm text-right">{item.n_seq_clusters}</td>
                    <td className="px-3 py-2 text-sm text-right">{item.n_classes}</td>
                    <td className="px-3 py-2 text-sm text-right">
                      {item.n_pfam_families > 0 ? (
                        <span className="text-purple-700 font-medium">{item.n_pfam_families}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-right">
                      {item.deep_homology_score != null ? (
                        <span className={item.deep_homology_score >= 1 ? 'font-bold text-red-700' : item.deep_homology_score >= 0.5 ? 'text-orange-600' : ''}>
                          {item.deep_homology_score.toFixed(3)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 text-sm text-center">
                      {item.lddt_classification ? (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${lddtClassColor(item.lddt_classification)}`}>
                          {lddtClassLabel(item.lddt_classification)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-center">
                      <Link href={`/curation/cluster/${item.struct_cluster_id}`} className="text-blue-600 hover:text-blue-800">
                        Detail &rarr;
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function TierStatCard({ label, count, colorClass }: { label: string; count: number; colorClass: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{count.toLocaleString()}</p>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-700">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
