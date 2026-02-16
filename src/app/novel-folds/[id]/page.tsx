'use client';

/**
 * Novel Fold/Domain Detail — tier-aware cluster detail page.
 * Tier 1 (T1_CXXXX): Dark proteins with zero DPAM domains
 * Tier 2 (T2_CXXXX): Orphan domains — low-confidence DPAM, no Pfam
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ProgressBar from '@/components/ProgressBar';

// Tier 1 types
interface Tier1Cluster {
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

interface Tier1Member {
  protein_id: string;
  db_protein_id: string;
  mean_plddt: number | null;
  seq_length: number | null;
  phylum: string;
  major_group: string;
  organism: string;
  genome_accession: string;
}

interface Tier1Edge {
  query: string;
  target: string;
  fident: number | null;
  alnlen: number;
  evalue: number | null;
  bits: number;
  lddt: number | null;
  prob: number | null;
}

// Tier 2 types
interface Tier2Cluster {
  cluster_id: string;
  cluster_size: number;
  cross_phylum: boolean;
  phylum_count: number;
  genome_count: number;
  protein_count: number;
  domain_count: number;
  avg_plddt: number | null;
  avg_dpam_prob: number | null;
  avg_dali_zscore: number | null;
  phyla: string;
}

interface Tier2Member {
  protein_id: string;
  domain_num: number;
  domain_id: string;
  domain_range: string;
  dpam_prob: number | null;
  dali_zscore: number | null;
  mean_plddt: number | null;
  phylum: string;
  genome_accession: string;
}

interface Tier2Edge {
  query: string;
  target: string;
  fident: number | null;
  alnlen: number;
  evalue: number | null;
  bits: number;
  alntmscore: number | null;
  qtmscore: number | null;
  ttmscore: number | null;
}

// Common types
interface PhylumDist {
  phylum: string;
  count: number;
}

interface CrossTierHit {
  tier1_protein_id?: string;
  tier2_protein_id?: string;
  tier2_domain_num?: number;
  tier1_cluster_id?: string;
  tier1_cluster_size?: number;
  tier2_cluster_id?: string;
  tier2_cluster_size?: number;
  fident: number | null;
  alnlen: number;
  evalue: number | null;
  alntmscore: number | null;
}

interface DetailData {
  tier: number;
  cluster: Tier1Cluster | Tier2Cluster;
  members: (Tier1Member | Tier2Member)[];
  edges: (Tier1Edge | Tier2Edge)[];
  phylum_distribution: PhylumDist[];
  cross_tier_hits: CrossTierHit[];
}

export default function NovelFoldDetailPage() {
  const params = useParams();
  const clusterId = params.id as string;

  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clusterId) return;
    setLoading(true);
    fetch(`/api/novel-folds/${clusterId}`)
      .then(res => {
        if (res.status === 404) throw new Error('Cluster not found');
        if (!res.ok) throw new Error('Failed to fetch cluster');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
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
          <Link href="/novel-folds" className="mt-4 inline-block text-blue-600 hover:text-blue-800">&larr; Back</Link>
        </div>
      </div>
    );
  }

  const { tier, cluster, members, edges, phylum_distribution, cross_tier_hits } = data;
  const isTier1 = tier === 1;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{cluster.cluster_id}</h1>
            <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
              isTier1
                ? 'bg-red-100 text-red-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {isTier1 ? 'Tier 1: Dark Protein' : 'Tier 2: Orphan Domain'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {isTier1
              ? 'Zero DPAM domain assignments — completely dark proteins'
              : 'Low-confidence DPAM domains with no Pfam matches'}
          </p>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
            <span>{cluster.cluster_size} {isTier1 ? 'proteins' : 'domains'}</span>
            <span>&middot;</span>
            <span>{cluster.phylum_count} phyla</span>
            <span>&middot;</span>
            <span>{cluster.genome_count} genomes</span>
            {cluster.cross_phylum && (
              <>
                <span>&middot;</span>
                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-medium">cross-phylum</span>
              </>
            )}
          </div>
        </div>
        <Link href="/novel-folds" className="text-blue-600 hover:text-blue-800 font-medium text-sm">&larr; Back</Link>
      </div>

      {/* Summary cards */}
      <div className={`grid grid-cols-2 ${isTier1 ? 'md:grid-cols-4' : 'md:grid-cols-6'} gap-4 mb-6`}>
        <Card label={isTier1 ? 'Proteins' : 'Domains'} value={String(cluster.cluster_size)} />
        <Card label="Avg pLDDT" value={cluster.avg_plddt?.toFixed(1) || '-'} />
        <Card label="Phyla" value={String(cluster.phylum_count)} />
        <Card label="Genomes" value={String(cluster.genome_count)} />
        {!isTier1 && (
          <>
            <Card label="Avg DPAM Prob" value={(cluster as Tier2Cluster).avg_dpam_prob?.toFixed(3) || '-'} />
            <Card label="Avg DALI Z" value={(cluster as Tier2Cluster).avg_dali_zscore?.toFixed(1) || '-'} />
          </>
        )}
      </div>

      {/* Phylum distribution + Quality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Phylum Distribution</h3>
          <div className="space-y-2">
            {phylum_distribution.map(p => (
              <ProgressBar
                key={p.phylum}
                label={p.phylum}
                value={p.count}
                total={members.length}
                color="bg-blue-500"
              />
            ))}
          </div>
        </div>

        {isTier1 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Quality Range</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Min pLDDT</dt>
                <dd className="text-gray-900">{(cluster as Tier1Cluster).min_plddt?.toFixed(1) || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Max pLDDT</dt>
                <dd className="text-gray-900">{(cluster as Tier1Cluster).max_plddt?.toFixed(1) || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Avg pLDDT</dt>
                <dd className="text-gray-900 font-medium">{cluster.avg_plddt?.toFixed(1) || '-'}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      {/* Members Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">
            {isTier1 ? `Protein Members (${members.length})` : `Domain Members (${members.length})`}
          </h3>
        </div>
        <div className="overflow-x-auto">
          {isTier1 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Protein</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">pLDDT</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phylum</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Organism</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Genome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(members as Tier1Member[]).map(m => (
                  <tr key={m.protein_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm">
                      <Link href={`/proteins/${m.db_protein_id}`} className="text-blue-600 hover:text-blue-800 font-mono text-xs">
                        {m.protein_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm text-right">{m.mean_plddt?.toFixed(1) || '-'}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{m.phylum}</td>
                    <td className="px-3 py-2 text-sm text-gray-600 max-w-[150px] truncate" title={m.organism}>
                      {m.organism}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 font-mono text-xs">{m.genome_accession}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Protein</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dom#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Range</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">pLDDT</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">DPAM Prob</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">DALI Z</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phylum</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Genome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(members as Tier2Member[]).map((m, i) => (
                  <tr key={`${m.protein_id}_${m.domain_num}_${i}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm">
                      <Link href={`/proteins/${m.protein_id}`} className="text-blue-600 hover:text-blue-800 font-mono text-xs">
                        {m.protein_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">{m.domain_num}</td>
                    <td className="px-3 py-2 text-sm text-gray-600 font-mono text-xs">{m.domain_range}</td>
                    <td className="px-3 py-2 text-sm text-right">{m.mean_plddt?.toFixed(1) || '-'}</td>
                    <td className="px-3 py-2 text-sm text-right">{m.dpam_prob?.toFixed(3) || '-'}</td>
                    <td className="px-3 py-2 text-sm text-right">{m.dali_zscore?.toFixed(1) || '-'}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{m.phylum}</td>
                    <td className="px-3 py-2 text-sm text-gray-600 font-mono text-xs">{m.genome_accession}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Foldseek Edges */}
      {edges.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900">Foldseek Edges ({edges.length})</h3>
          </div>
          <div className="overflow-x-auto">
            {isTier1 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Query</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fident</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Aln Len</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">E-value</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bits</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">lDDT</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prob</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(edges as Tier1Edge[]).map((e, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs font-mono text-gray-700">{e.query}</td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-700">{e.target}</td>
                      <td className="px-3 py-2 text-sm text-right">{e.fident?.toFixed(3) || '-'}</td>
                      <td className="px-3 py-2 text-sm text-right">{e.alnlen}</td>
                      <td className="px-3 py-2 text-sm text-right">{e.evalue != null ? Number(e.evalue).toExponential(1) : '-'}</td>
                      <td className="px-3 py-2 text-sm text-right">{e.bits}</td>
                      <td className="px-3 py-2 text-sm text-right">{e.lddt?.toFixed(3) || '-'}</td>
                      <td className="px-3 py-2 text-sm text-right">{e.prob?.toFixed(3) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Query</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fident</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Aln Len</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">E-value</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bits</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">AlnTMscore</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">qTMscore</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">tTMscore</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(edges as Tier2Edge[]).map((e, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs font-mono text-gray-700">{e.query}</td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-700">{e.target}</td>
                      <td className="px-3 py-2 text-sm text-right">{e.fident?.toFixed(3) || '-'}</td>
                      <td className="px-3 py-2 text-sm text-right">{e.alnlen}</td>
                      <td className="px-3 py-2 text-sm text-right">{e.evalue != null ? Number(e.evalue).toExponential(1) : '-'}</td>
                      <td className="px-3 py-2 text-sm text-right">{e.bits}</td>
                      <td className="px-3 py-2 text-sm text-right">{e.alntmscore?.toFixed(3) || '-'}</td>
                      <td className="px-3 py-2 text-sm text-right">{e.qtmscore?.toFixed(3) || '-'}</td>
                      <td className="px-3 py-2 text-sm text-right">{e.ttmscore?.toFixed(3) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Cross-tier Hits */}
      {cross_tier_hits.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-purple-50">
            <h3 className="font-semibold text-purple-900">
              {isTier1 ? 'Matching Orphan Domains (Tier 2)' : 'Matching Dark Proteins (Tier 1)'} ({cross_tier_hits.length})
            </h3>
            <p className="text-xs text-purple-600 mt-0.5">
              Structural matches linking {isTier1 ? 'dark proteins to orphan domain clusters' : 'orphan domains to fully dark protein clusters'}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {isTier1 ? (
                    <>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">T1 Protein</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">T2 Protein</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">T2 Dom#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">T2 Cluster</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">T2 Size</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">T2 Protein</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">T2 Dom#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">T1 Protein</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">T1 Cluster</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">T1 Size</th>
                    </>
                  )}
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fident</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Aln Len</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">AlnTMscore</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {cross_tier_hits.map((h, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {isTier1 ? (
                      <>
                        <td className="px-3 py-2 text-xs font-mono text-gray-700">{h.tier1_protein_id}</td>
                        <td className="px-3 py-2 text-xs font-mono text-gray-700">{h.tier2_protein_id}</td>
                        <td className="px-3 py-2 text-sm text-right">{h.tier2_domain_num}</td>
                        <td className="px-3 py-2 text-sm">
                          {h.tier2_cluster_id && (
                            <Link href={`/novel-folds/${h.tier2_cluster_id}`} className="text-blue-600 hover:text-blue-800 font-mono text-xs">
                              {h.tier2_cluster_id}
                            </Link>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-right">{h.tier2_cluster_size || '-'}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-xs font-mono text-gray-700">{h.tier2_protein_id}</td>
                        <td className="px-3 py-2 text-sm text-right">{h.tier2_domain_num}</td>
                        <td className="px-3 py-2 text-xs font-mono text-gray-700">{h.tier1_protein_id}</td>
                        <td className="px-3 py-2 text-sm">
                          {h.tier1_cluster_id && (
                            <Link href={`/novel-folds/${h.tier1_cluster_id}`} className="text-blue-600 hover:text-blue-800 font-mono text-xs">
                              {h.tier1_cluster_id}
                            </Link>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-right">{h.tier1_cluster_size || '-'}</td>
                      </>
                    )}
                    <td className="px-3 py-2 text-sm text-right">{h.fident?.toFixed(3) || '-'}</td>
                    <td className="px-3 py-2 text-sm text-right">{h.alnlen}</td>
                    <td className="px-3 py-2 text-sm text-right">{h.alntmscore?.toFixed(3) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
