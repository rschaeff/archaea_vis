'use client';

/**
 * Novel Fold Detail — members, foldseek edges, Pfam annotations, phylum distribution.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ProgressBar from '@/components/ProgressBar';

interface ClusterInfo {
  cluster_id: string;
  cluster_size: number;
  cross_phylum: boolean;
  min_plddt: number | null;
  max_plddt: number | null;
  avg_plddt: number | null;
  min_length: number;
  max_length: number;
  avg_length: number;
  phylum_count: number;
  phyla: string;
  genome_count: number;
  pfam_family_count: number;
  duf_count: number;
  pfam_families: string | null;
}

interface Member {
  protein_id: string;
  db_protein_id: string;
  mean_plddt: number | null;
  seq_length: number;
  phylum: string;
  major_group: string;
  organism: string;
  genome_accession: string;
  quality_tier: string;
  batch_num: string;
  pfam_hits: PfamHit[];
}

interface PfamHit {
  pfam_name: string;
  pfam_acc: string;
  pfam_description: string;
  evalue: string;
  score: string;
  ali_from: number;
  ali_to: number;
}

interface Edge {
  query: string;
  target: string;
  fident: number | null;
  alnlen: number;
  evalue: number | null;
  bits: number;
  lddt: number | null;
  prob: number | null;
}

interface PhylumDist {
  phylum: string;
  count: number;
}

interface PfamSummary {
  pfam_name: string;
  pfam_acc: string;
  description: string;
  hit_count: number;
  is_duf: boolean;
}

interface DetailData {
  cluster: ClusterInfo;
  members: Member[];
  edges: Edge[];
  phylum_distribution: PhylumDist[];
  pfam_summary: PfamSummary[];
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

  const { cluster, members, edges, phylum_distribution, pfam_summary } = data;
  const totalMembers = members.length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{cluster.cluster_id}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
            <span>{cluster.cluster_size} proteins</span>
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

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <Card label="Members" value={String(cluster.cluster_size)} />
        <Card label="Avg pLDDT" value={cluster.avg_plddt?.toFixed(1) || '-'} />
        <Card label="Avg Length" value={String(Math.round(cluster.avg_length))} />
        <Card label="Phyla" value={String(cluster.phylum_count)} />
        <Card label="Genomes" value={String(cluster.genome_count)} />
        <Card label="Pfam Families" value={String(cluster.pfam_family_count)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Phylum Distribution */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Phylum Distribution</h3>
          <div className="space-y-2">
            {phylum_distribution.map(p => (
              <ProgressBar
                key={p.phylum}
                label={p.phylum}
                value={p.count}
                total={totalMembers}
                color="bg-blue-500"
              />
            ))}
          </div>
        </div>

        {/* Pfam Summary */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Pfam Annotations</h3>
          {pfam_summary.length === 0 ? (
            <p className="text-gray-500 text-sm">No Pfam hits for this cluster.</p>
          ) : (
            <div className="space-y-2">
              {pfam_summary.map(p => (
                <div key={p.pfam_acc} className="text-sm">
                  <div className="flex items-center justify-between">
                    <a
                      href={`https://www.ebi.ac.uk/interpro/entry/pfam/${p.pfam_acc}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {p.pfam_name || p.pfam_acc}
                    </a>
                    <span className="text-gray-400 text-xs">{p.hit_count} hits</span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-gray-500 truncate" title={p.description}>{p.description}</p>
                  )}
                  {p.is_duf && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">DUF</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* pLDDT Range */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Quality Range</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Min pLDDT</dt>
              <dd className="text-gray-900">{cluster.min_plddt?.toFixed(1) || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Max pLDDT</dt>
              <dd className="text-gray-900">{cluster.max_plddt?.toFixed(1) || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Avg pLDDT</dt>
              <dd className="text-gray-900 font-medium">{cluster.avg_plddt?.toFixed(1) || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Length range</dt>
              <dd className="text-gray-900">{cluster.min_length} &ndash; {cluster.max_length}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Members ({members.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Protein</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Length</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">pLDDT</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phylum</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Organism</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Genome</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pfam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {members.map(m => (
                <tr key={m.protein_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm">
                    <Link href={`/proteins/${m.db_protein_id}`} className="text-blue-600 hover:text-blue-800 font-mono text-xs">
                      {m.protein_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-right">{m.seq_length}</td>
                  <td className="px-3 py-2 text-sm text-right">{m.mean_plddt?.toFixed(1) || '-'}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{m.phylum}</td>
                  <td className="px-3 py-2 text-sm text-gray-600 max-w-[150px] truncate" title={m.organism}>
                    {m.organism}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600 font-mono text-xs">{m.genome_accession}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{m.quality_tier}</td>
                  <td className="px-3 py-2 text-sm">
                    {m.pfam_hits.length === 0 ? (
                      <span className="text-gray-400">-</span>
                    ) : (
                      <div className="space-y-0.5">
                        {m.pfam_hits.map((h, i) => (
                          <span key={i} className="inline-block text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded mr-1">
                            {h.pfam_name || h.pfam_acc}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Foldseek Edges */}
      {edges.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900">Foldseek Edges ({edges.length})</h3>
          </div>
          <div className="overflow-x-auto">
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
                {edges.map((e, i) => (
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
