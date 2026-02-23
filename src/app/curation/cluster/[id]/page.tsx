'use client';

/**
 * DXC Cluster Detail — X-group composition, members, Pfam evidence, taxonomy,
 * LDDT distribution, and X-group suggestions.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Pagination from '@/components/Pagination';
import { judgeColor, lddtClassColor, lddtClassLabel } from '@/lib/utils';
import type { DxcClusterDetail, DxcXgroupComposition, DxcMember, DxcPfamEvidence, DxcTaxonDist, LddtBucket, XgroupSuggestion } from '@/lib/types';

const MEMBER_PAGE_SIZE = 50;

interface ClusterDetailData {
  cluster: DxcClusterDetail & { avg_best_lddt: number | null; lddt_classification: string | null };
  xgroup_composition: DxcXgroupComposition[];
  members: DxcMember[];
  members_total: number;
  pfam_evidence: DxcPfamEvidence[];
  taxonomy: DxcTaxonDist[];
  lddt_distribution: LddtBucket[];
  xgroup_suggestions: XgroupSuggestion[];
}

// LDDT bucket colors matching the 4-tier system
const BUCKET_COLORS: Record<string, string> = {
  'no_hit': '#d1d5db',   // gray-300
  '0.0-0.3': '#c084fc',  // purple-400
  '0.3-0.5': '#fb923c',  // orange-400
  '0.5-0.7': '#facc15',  // yellow-400
  '0.7+': '#4ade80',     // green-400
};

const BUCKET_LABELS: Record<string, string> = {
  'no_hit': 'No hit',
  '0.0-0.3': 'Novel (<0.3)',
  '0.3-0.5': 'Weak (0.3-0.5)',
  '0.5-0.7': 'Moderate (0.5-0.7)',
  '0.7+': 'Strong (0.7+)',
};

const BUCKET_ORDER = ['no_hit', '0.0-0.3', '0.3-0.5', '0.5-0.7', '0.7+'];

export default function ClusterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ClusterDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberOffset, setMemberOffset] = useState(0);

  const fetchCluster = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        member_limit: String(MEMBER_PAGE_SIZE),
        member_offset: String(memberOffset),
      });
      const res = await fetch(`/api/curation/clusters/${id}?${params}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Cluster not found');
        throw new Error('Failed to fetch cluster');
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cluster');
    } finally {
      setLoading(false);
    }
  }, [id, memberOffset]);

  useEffect(() => { fetchCluster(); }, [fetchCluster]);

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded mb-6"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link href="/curation" className="text-blue-600 hover:text-blue-800 text-sm">&larr; Back to browser</Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { cluster: c, xgroup_composition, members, members_total, pfam_evidence, taxonomy, lddt_distribution, xgroup_suggestions } = data;
  const allXgroups = [...new Set(pfam_evidence.flatMap(p => Object.keys(p.xgroup_counts)))].sort();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/curation" className="text-blue-600 hover:text-blue-800 text-sm">&larr; Back to browser</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{c.struct_cluster_id}</h1>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
          <span><b>{c.cluster_size}</b> domains</span>
          <span><b>{c.n_xgroups}</b> X-groups</span>
          <span><b>{c.n_tgroups}</b> T-groups</span>
          <span><b>{c.n_good_domain}</b> good domains</span>
          <span><b>{c.n_pfam_families}</b> Pfam families</span>
          <span><b>{c.n_seq_clusters}</b> seq clusters</span>
          {c.deep_homology_score != null && (
            <span>Deep homology: <b className="text-red-700">{c.deep_homology_score.toFixed(3)}</b></span>
          )}
          {c.taxonomic_entropy != null && (
            <span>Tax. entropy: <b>{c.taxonomic_entropy.toFixed(2)}</b></span>
          )}
          {c.lddt_classification && (
            <span>
              LDDT: <span className={`px-2 py-0.5 text-xs font-medium rounded ${lddtClassColor(c.lddt_classification)}`}>
                {lddtClassLabel(c.lddt_classification)}
              </span>
              {c.avg_best_lddt != null && (
                <span className="ml-1 text-gray-500">(avg {c.avg_best_lddt.toFixed(3)})</span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Section A: X-group Composition */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">X-group Composition</h2>
        {xgroup_composition.length === 0 ? (
          <p className="text-gray-500 text-sm">No members with T-group annotation.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">X-group</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">T-groups</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Domains</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Good</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Low Conf.</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pfam Families</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {xgroup_composition.map(xg => (
                  <tr key={xg.xgroup} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-mono font-bold">{xg.xgroup}</td>
                    <td className="px-4 py-2 text-sm text-right">{xg.n_tgroups}</td>
                    <td className="px-4 py-2 text-sm text-right font-medium">{xg.n_domains}</td>
                    <td className="px-4 py-2 text-sm text-right text-green-700">{xg.n_good}</td>
                    <td className="px-4 py-2 text-sm text-right text-yellow-700">{xg.n_low_conf}</td>
                    <td className="px-4 py-2 text-sm text-right">{xg.n_pfam}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section: LDDT Distribution */}
      {lddt_distribution && lddt_distribution.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">LDDT Distribution</h2>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <LddtStackedBar distribution={lddt_distribution} />
          </div>
        </section>
      )}

      {/* Section: X-group Suggestions */}
      {xgroup_suggestions && xgroup_suggestions.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            X-group Suggestions
            <span className="text-sm font-normal text-gray-500 ml-2">(for unclassified members)</span>
          </h2>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">X-group</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Hits</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Avg LDDT</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Max LDDT</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {xgroup_suggestions.map(sg => {
                  const confidence = sg.avg_lddt >= 0.7 && sg.n_hits >= 3
                    ? 'HIGH' : sg.avg_lddt >= 0.5 ? 'MODERATE' : 'LOW';
                  const confColor = confidence === 'HIGH'
                    ? 'bg-green-100 text-green-800'
                    : confidence === 'MODERATE'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800';
                  return (
                    <tr key={sg.xgroup} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm font-mono font-bold">{sg.xgroup}</td>
                      <td className="px-4 py-2 text-sm text-right">{sg.n_hits}</td>
                      <td className="px-4 py-2 text-sm text-right">
                        <span className={`font-medium ${sg.avg_lddt >= 0.7 ? 'text-green-700' : sg.avg_lddt >= 0.5 ? 'text-yellow-700' : sg.avg_lddt >= 0.3 ? 'text-orange-700' : 'text-purple-700'}`}>
                          {sg.avg_lddt.toFixed(3)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-right">{sg.max_lddt.toFixed(3)}</td>
                      <td className="px-4 py-2 text-sm text-center">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${confColor}`}>
                          {confidence}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section B: Member List */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Members <span className="text-sm font-normal text-gray-500">({members_total} total)</span>
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Protein</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Domain</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Range</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Judge</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">T-group</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">DPAM Prob</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">LDDT</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Suggested X</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pfam</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phylum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 11 }).map((_, j) => (
                        <td key={j} className="px-3 py-2"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
                      ))}
                    </tr>
                  ))
                ) : (
                  members.map(m => (
                    <tr key={m.domain_id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm font-mono">
                        <Link href={`/proteins/${m.protein_id}`} className="text-blue-600 hover:text-blue-800">
                          {m.protein_id}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">d{m.domain_num}</td>
                      <td className="px-3 py-2 text-sm font-mono text-gray-600">{m.range}</td>
                      <td className="px-3 py-2 text-sm">
                        {m.judge && (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${judgeColor(m.judge)}`}>
                            {m.judge}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm font-mono text-gray-600">{m.t_group || '-'}</td>
                      <td className="px-3 py-2 text-sm text-right">
                        {m.dpam_prob != null ? m.dpam_prob.toFixed(3) : '-'}
                      </td>
                      <td className="px-3 py-2 text-sm text-center">
                        {m.best_lddt != null ? (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${lddtClassColor(m.lddt_class)}`}>
                            {m.best_lddt.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm font-mono text-gray-600">
                        {!m.t_group && m.lddt_xgroup ? (
                          <span className="text-indigo-700 font-medium">{m.lddt_xgroup}</span>
                        ) : '-'}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {m.pfam_hits ? (
                          <div className="flex flex-wrap gap-1">
                            {m.pfam_hits.split(', ').map(acc => (
                              <a key={acc} href={`https://www.ebi.ac.uk/interpro/entry/pfam/${acc}`}
                                target="_blank" rel="noopener noreferrer"
                                className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-800 rounded hover:bg-purple-200">
                                {acc}
                              </a>
                            ))}
                          </div>
                        ) : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600 max-w-[100px] truncate">{m.class_name || '-'}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{m.phylum || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 border-t border-gray-200">
            <Pagination total={members_total} limit={MEMBER_PAGE_SIZE} offset={memberOffset} onPageChange={setMemberOffset} />
          </div>
        </div>
      </section>

      {/* Section C: Pfam Evidence */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Pfam Evidence</h2>
        {pfam_evidence.length === 0 ? (
          <p className="text-gray-500 text-sm">No Pfam hits in annotated domains.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pfam</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    {allXgroups.map(xg => (
                      <th key={xg} className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">X-{xg}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pfam_evidence.map(pf => {
                    const isShared = Object.keys(pf.xgroup_counts).length >= 2;
                    return (
                      <tr key={pf.pfam_acc} className={isShared ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-2 text-sm font-mono">
                          <a href={`https://www.ebi.ac.uk/interpro/entry/pfam/${pf.pfam_acc}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-purple-700 hover:text-purple-900">
                            {pf.pfam_acc}
                          </a>
                          {isShared && <span className="ml-1 text-xs text-yellow-700 font-bold">SHARED</span>}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 max-w-[200px] truncate">{pf.pfam_name || '-'}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{pf.total_domains}</td>
                        {allXgroups.map(xg => (
                          <td key={xg} className="px-4 py-2 text-sm text-right">
                            {pf.xgroup_counts[xg] || <span className="text-gray-300">-</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Section D: Taxonomic Distribution */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Taxonomic Distribution</h2>
        {taxonomy.length === 0 ? (
          <p className="text-gray-500 text-sm">No taxonomy data available.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="space-y-2">
              {taxonomy.map((t, i) => {
                const maxCount = taxonomy[0].count;
                const pct = (t.count / maxCount) * 100;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-40 text-sm text-gray-700 truncate" title={t.class_name}>
                      {t.class_name}
                    </div>
                    <div className="w-24 text-xs text-gray-500">{t.phylum || '-'}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div
                        className="bg-teal-500 h-full rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      >
                        {pct > 15 && <span className="text-xs text-white font-medium">{t.count}</span>}
                      </div>
                    </div>
                    {pct <= 15 && <span className="text-xs text-gray-600">{t.count}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/** Horizontal stacked bar showing LDDT bucket distribution. */
function LddtStackedBar({ distribution }: { distribution: LddtBucket[] }) {
  // Build counts map keyed by bucket
  const countMap: Record<string, number> = {};
  for (const b of distribution) {
    countMap[b.bucket] = b.count;
  }
  const total = distribution.reduce((s, b) => s + b.count, 0);
  if (total === 0) return <p className="text-gray-500 text-sm">No LDDT data.</p>;

  return (
    <div>
      {/* Stacked bar */}
      <div className="flex h-8 rounded-lg overflow-hidden">
        {BUCKET_ORDER.map(bucket => {
          const count = countMap[bucket] || 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={bucket}
              className="flex items-center justify-center text-xs font-medium text-gray-800"
              style={{ width: `${pct}%`, backgroundColor: BUCKET_COLORS[bucket], minWidth: pct > 3 ? undefined : '2px' }}
              title={`${BUCKET_LABELS[bucket]}: ${count} (${pct.toFixed(1)}%)`}
            >
              {pct > 8 && count}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3">
        {BUCKET_ORDER.map(bucket => {
          const count = countMap[bucket] || 0;
          return (
            <div key={bucket} className="flex items-center gap-1.5 text-xs text-gray-600">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: BUCKET_COLORS[bucket] }} />
              <span>{BUCKET_LABELS[bucket]}: <b>{count}</b></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
