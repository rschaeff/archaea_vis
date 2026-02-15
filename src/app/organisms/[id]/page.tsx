'use client';

/**
 * Organism Detail Page — per-genome breakdown of proteins, domains,
 * quality, curation, and novel folds.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { noveltyColor, statusColor, judgeColor } from '@/lib/utils';

interface OrganismDetail {
  organism: {
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
  };
  novelty_breakdown: { category: string; count: number }[];
  source_breakdown: { source: string; count: number }[];
  judge_breakdown: { judge: string; count: number }[];
  quality_distribution: { bucket: string; count: number }[];
  curation_breakdown: { status: string; count: number }[];
  top_proteins: {
    protein_id: string;
    source: string;
    sequence_length: number;
    has_structure: boolean;
    mean_plddt: number | null;
    quality_score: number | null;
    af3_quality_category: string | null;
    novelty_category: string | null;
    curation_status: string | null;
    is_novel_fold: boolean | null;
  }[];
  novel_fold_proteins: {
    protein_id: string;
    cluster_id: number;
    cluster_size: number;
    num_phyla: number;
    mean_plddt: number | null;
  }[];
}

export default function OrganismDetailPage() {
  const params = useParams();
  const classId = params.id as string;

  const [data, setData] = useState<OrganismDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    fetch(`/api/organisms/${classId}`)
      .then(res => {
        if (res.status === 404) throw new Error('Organism not found');
        if (!res.ok) throw new Error('Failed to fetch organism');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [classId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-96 mb-4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
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
          <Link href="/organisms" className="mt-4 inline-block text-blue-600 hover:text-blue-800">&larr; Back to Organisms</Link>
        </div>
      </div>
    );
  }

  const { organism: org } = data;
  const proteins = parseInt(org.actual_protein_count);
  const structures = parseInt(org.proteins_with_structures);
  const pae = parseInt(org.proteins_with_pae);
  const totalJudge = data.judge_breakdown.reduce((s, j) => s + j.count, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{org.organism_name}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-sm text-gray-600">{org.class_name}</span>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm text-gray-600">{org.phylum}</span>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm text-gray-600">{org.major_group}</span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
              org.source_category === 'AFDB' ? 'bg-blue-100 text-blue-800' :
              org.source_category === 'UniParc' ? 'bg-green-100 text-green-800' :
              'bg-orange-100 text-orange-800'
            }`}>
              {org.source_category}
            </span>
          </div>
        </div>
        <Link href="/organisms" className="text-blue-600 hover:text-blue-800 font-medium text-sm">&larr; Back</Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <Card label="Proteins" value={proteins.toLocaleString()} />
        <Card label="Structures" value={structures.toLocaleString()} sub={`${proteins > 0 ? (structures / proteins * 100).toFixed(0) : 0}%`} />
        <Card label="PAE Files" value={pae.toLocaleString()} sub={`${proteins > 0 ? (pae / proteins * 100).toFixed(0) : 0}%`} />
        <Card
          label="Completeness"
          value={org.completeness != null ? `${Number(org.completeness).toFixed(1)}%` : '-'}
          sub={org.quality_tier || undefined}
        />
        <Card
          label="Contamination"
          value={org.contamination != null ? `${Number(org.contamination).toFixed(1)}%` : '-'}
        />
        <Card label="NCBI Tax ID" value={org.tax_id ? String(org.tax_id) : '-'} link={org.tax_id ? `https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${org.tax_id}` : undefined} />
      </div>

      {/* Genome info */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-gray-500">Assembly: </span>
            <a
              href={`https://www.ncbi.nlm.nih.gov/datasets/genome/${org.genome_accession}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 font-mono"
            >
              {org.genome_accession}
            </a>
          </div>
          {org.tax_id && (
            <div>
              <span className="text-gray-500">NCBI Taxonomy: </span>
              <a
                href={`https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${org.tax_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                {org.tax_id}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {/* Novelty */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Novelty Breakdown</h3>
          <div className="space-y-2">
            {data.novelty_breakdown.map(n => (
              <div key={n.category} className="flex items-center justify-between">
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${noveltyColor(n.category)}`}>
                  {n.category}
                </span>
                <span className="text-sm text-gray-600">{n.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Domain Judges */}
        {totalJudge > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Domain Judges ({totalJudge.toLocaleString()} domains)</h3>
            <div className="space-y-2">
              {data.judge_breakdown.map(j => {
                const pct = totalJudge > 0 ? (j.count / totalJudge * 100) : 0;
                return (
                  <div key={j.judge}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${judgeColor(j.judge)}`}>
                        {j.judge || 'NULL'}
                      </span>
                      <span className="text-sm text-gray-600">{j.count.toLocaleString()} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-gray-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quality Distribution */}
        {data.quality_distribution.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">pLDDT Distribution</h3>
            <div className="space-y-2">
              {[
                { key: 'very_high', label: 'Very High (>90)', color: 'bg-blue-500' },
                { key: 'confident', label: 'Confident (70-90)', color: 'bg-cyan-500' },
                { key: 'low', label: 'Low (50-70)', color: 'bg-yellow-500' },
                { key: 'very_low', label: 'Very Low (<50)', color: 'bg-orange-500' },
              ].map(({ key, label, color }) => {
                const entry = data.quality_distribution.find(q => q.bucket === key);
                const count = entry?.count || 0;
                const pct = structures > 0 ? (count / structures * 100) : 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="text-gray-700">{label}</span>
                      <span className="text-gray-600">{count.toLocaleString()} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Curation */}
        {data.curation_breakdown.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Curation Status</h3>
            <div className="space-y-2">
              {data.curation_breakdown.map(c => (
                <div key={c.status} className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColor(c.status)}`}>
                    {c.status}
                  </span>
                  <span className="text-sm text-gray-600">{c.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Source */}
        {data.source_breakdown.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Protein Sources</h3>
            <div className="space-y-2">
              {data.source_breakdown.map(s => (
                <div key={s.source} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{s.source}</span>
                  <span className="text-sm text-gray-600">{s.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Novel Fold Proteins */}
      {data.novel_fold_proteins.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-200 bg-purple-50">
            <h3 className="font-semibold text-purple-900">Novel Fold Clusters ({data.novel_fold_proteins.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Protein</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cluster</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Size</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Phyla</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">pLDDT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.novel_fold_proteins.map(nf => (
                  <tr key={nf.protein_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm">
                      <Link href={`/proteins/${nf.protein_id}`} className="text-blue-600 hover:text-blue-800 font-mono">
                        {nf.protein_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <Link href={`/novel-folds/${nf.cluster_id}`} className="text-blue-600 hover:text-blue-800">
                        #{nf.cluster_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">{nf.cluster_size}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">{nf.num_phyla}</td>
                    <td className="px-3 py-2 text-sm text-right">
                      {nf.mean_plddt ? parseFloat(String(nf.mean_plddt)).toFixed(1) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Proteins */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Top Proteins by Quality (up to 20)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Protein</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Length</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">pLDDT</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quality</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Novelty</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Novel Fold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.top_proteins.map(p => (
                <tr key={p.protein_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm">
                    <Link href={`/proteins/${p.protein_id}`} className="text-blue-600 hover:text-blue-800 font-mono">
                      {p.protein_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.sequence_length}</td>
                  <td className="px-3 py-2 text-sm text-right">
                    {p.mean_plddt ? (
                      <span className={parseFloat(String(p.mean_plddt)) >= 70 ? 'text-green-600' : 'text-yellow-600'}>
                        {parseFloat(String(p.mean_plddt)).toFixed(1)}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-right">
                    {p.quality_score ? parseFloat(String(p.quality_score)).toFixed(2) : '-'}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {p.novelty_category ? (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${noveltyColor(p.novelty_category)}`}>
                        {p.novelty_category}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {p.curation_status ? (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColor(p.curation_status)}`}>
                        {p.curation_status}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {p.is_novel_fold ? (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800">Yes</span>
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

function Card({ label, value, sub, link }: { label: string; value: string; sub?: string; link?: string }) {
  const content = (
    <>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </>
  );

  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className="bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
        {content}
      </a>
    );
  }

  return <div className="bg-white border border-gray-200 rounded-lg p-3">{content}</div>;
}
