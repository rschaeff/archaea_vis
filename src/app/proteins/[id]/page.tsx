'use client';

/**
 * Protein Detail Page
 *
 * Shows metadata, quality metrics, provenance chain, 3D structure viewer,
 * PAE heatmap, domain table with Pfam, and cluster membership.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import ProvenanceBadge from '@/components/ProvenanceBadge';
import type {
  ArchaeaProteinDetail,
  DomainWithPfam,
  ClusterMember,
} from '@/lib/types';
import { noveltyColor, statusColor, judgeColor } from '@/lib/utils';

const StructureViewer = dynamic(() => import('@/components/StructureViewer'), { ssr: false });
const PaeHeatmap = dynamic(() => import('@/components/PaeHeatmap'), { ssr: false });

interface ProteinDetailResponse {
  protein: ArchaeaProteinDetail;
  domains: DomainWithPfam[];
  cluster_members?: ClusterMember[];
}

export default function ProteinDetailPage() {
  const params = useParams();
  const proteinId = params.id as string;

  const [data, setData] = useState<ProteinDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!proteinId) return;

    setLoading(true);
    fetch(`/api/proteins/${proteinId}`)
      .then(res => {
        if (res.status === 404) throw new Error('Protein not found');
        if (!res.ok) throw new Error('Failed to fetch protein');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load protein'))
      .finally(() => setLoading(false));
  }, [proteinId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
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
          <p className="text-red-600 mt-2">{error || 'Failed to load protein'}</p>
          <Link href="/proteins" className="mt-4 inline-block text-blue-600 hover:text-blue-800 font-medium">
            &larr; Back to Proteins
          </Link>
        </div>
      </div>
    );
  }

  const { protein, domains, cluster_members } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{protein.protein_id}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <ProvenanceBadge source={protein.source} cifFile={protein.cif_file} />
            {protein.uniprot_acc && (
              <a
                href={`https://www.uniprot.org/uniprotkb/${protein.uniprot_acc}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                UniProt: {protein.uniprot_acc}
              </a>
            )}
            {protein.uniparc_id && (
              <span className="text-sm text-gray-600">UniParc: {protein.uniparc_id}</span>
            )}
            <span className="text-sm text-gray-600">{protein.sequence_length} residues</span>
            {protein.novelty_category && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${noveltyColor(protein.novelty_category)}`}>
                {protein.novelty_category}
              </span>
            )}
            {protein.curation_status && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColor(protein.curation_status)}`}>
                {protein.curation_status}
              </span>
            )}
          </div>
        </div>
        <Link href="/proteins" className="text-blue-600 hover:text-blue-800 font-medium text-sm">
          &larr; Back
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Taxonomy & Provenance */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Taxonomy & Provenance</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Organism" value={protein.organism_name} />
            <Row label="Class" value={protein.class_name} />
            <Row label="Phylum" value={protein.phylum} />
            <Row label="Major Group" value={protein.major_group} />
            <Row label="Genome" value={protein.genome_accession} />
            <Row label="Source" value={protein.source} />
            <Row label="Structure" value={protein.has_structure ? 'Yes' : 'No'} />
            <Row label="PAE" value={protein.has_pae ? 'Yes' : 'No'} />
          </dl>
        </div>

        {/* Quality Metrics */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Structure Quality</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Mean pLDDT</dt>
              <dd className={`font-medium ${getPlddtColor(protein.mean_plddt)}`}>
                {protein.mean_plddt?.toFixed(1) || '-'}
              </dd>
            </div>
            <Row label="pTM" value={protein.ptm?.toFixed(3)} />
            <Row label="Quality Score" value={protein.quality_score?.toFixed(2)} />
            <Row label="Quality Category" value={protein.af3_quality_category} />
            <Row label="Disordered" value={protein.fraction_disordered ? `${(protein.fraction_disordered * 100).toFixed(1)}%` : null} />
            <Row label="Rg Ratio" value={protein.rg_ratio?.toFixed(2)} />
            <Row label="Rg Category" value={protein.rg_category} />
          </dl>

          {/* Secondary Structure */}
          {(protein.helix_fraction !== null || protein.sheet_fraction !== null) && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Secondary Structure</h4>
              <div className="space-y-1.5">
                <SSBar label="Helix" fraction={protein.helix_fraction} color="bg-red-500" />
                <SSBar label="Sheet" fraction={protein.sheet_fraction} color="bg-blue-500" />
                <SSBar label="Coil" fraction={protein.coil_fraction} color="bg-gray-400" />
              </div>
              {protein.ss_category && (
                <p className="mt-2 text-xs text-gray-500">Category: {protein.ss_category}</p>
              )}
            </div>
          )}
        </div>

        {/* Curation & Cluster */}
        <div className="space-y-6">
          {/* Curation Info */}
          {protein.novelty_category && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Curation</h3>
              <dl className="space-y-2 text-sm">
                <Row label="Novelty" value={protein.novelty_category} />
                <Row label="Priority" value={protein.priority_category} />
                <Row label="Priority Rank" value={protein.priority_rank != null ? String(protein.priority_rank) : null} />
                <Row label="Status" value={protein.curation_status} />
                <Row label="Novel Fold" value={protein.is_novel_fold === true ? 'Yes' : protein.is_novel_fold === false ? 'No' : null} />
                {protein.curator_notes && (
                  <div className="pt-2">
                    <dt className="text-gray-500 mb-1">Notes</dt>
                    <dd className="text-gray-900 bg-gray-50 p-2 rounded text-xs">{protein.curator_notes}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Cluster Info */}
          {protein.structural_cluster_id && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">
                <Link href={`/clusters/${protein.structural_cluster_id}`} className="hover:text-blue-600">
                  Structural Cluster #{protein.structural_cluster_id}
                </Link>
              </h3>
              <dl className="space-y-2 text-sm">
                <Row label="Cluster Size" value={String(protein.actual_cluster_size || protein.structural_cluster_size || '-')} />
                <Row label="Representative" value={protein.is_representative ? 'Yes' : 'No'} />
              </dl>
              {cluster_members && cluster_members.length > 1 && (
                <details className="mt-3">
                  <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-800">
                    View {cluster_members.length} cluster members
                  </summary>
                  <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {cluster_members.map(m => (
                      <li key={m.protein_id} className="text-xs flex items-center gap-2">
                        <Link
                          href={`/proteins/${m.protein_id}`}
                          className={`font-mono hover:text-blue-600 ${m.protein_id === proteinId ? 'font-bold' : ''}`}
                        >
                          {m.protein_id}
                        </Link>
                        {m.is_representative && <span className="text-gray-400">(rep)</span>}
                        {m.novelty_category && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${noveltyColor(m.novelty_category)}`}>
                            {m.novelty_category}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Structure Viewer & PAE */}
      {protein.has_structure && (
        <div className={`grid gap-6 mb-6 ${protein.has_pae ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          <StructureViewer
            proteinId={protein.protein_id}
            domains={domains}
            height="500px"
          />
          {protein.has_pae && (
            <PaeHeatmap
              proteinId={protein.protein_id}
              height={500}
            />
          )}
        </div>
      )}

      {/* Domains Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">
            DPAM Domains ({domains.length})
          </h3>
        </div>
        {domains.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            No DPAM domains found for this protein.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Range</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">T-group</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Judge</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">DPAM Prob</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">HH Prob</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pfam Hits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {domains.map(domain => (
                  <tr key={domain.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-900">{domain.domain_num}</td>
                    <td className="px-3 py-2 text-sm font-mono text-gray-900">{domain.range}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{domain.t_group || '-'}</td>
                    <td className="px-3 py-2 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${judgeColor(domain.judge)}`}>
                        {domain.judge || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">
                      {domain.dpam_prob?.toFixed(3) || '-'}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">
                      {domain.hh_prob?.toFixed(3) || '-'}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {domain.pfam_hits.length === 0 ? (
                        <span className="text-gray-400">-</span>
                      ) : (
                        <div className="space-y-0.5">
                          {domain.pfam_hits.map((hit, i) => (
                            <div key={i} className="text-xs">
                              <a
                                href={`https://www.ebi.ac.uk/interpro/entry/pfam/${hit.pfam_acc}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                {hit.pfam_acc}
                              </a>
                              <span className="text-gray-400 ml-1">
                                E={Number(hit.e_value).toExponential(1)} [{hit.query_start}-{hit.query_end}]
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sequence */}
      {protein.sequence && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Sequence</h3>
          <div className="font-mono text-xs text-gray-700 break-all whitespace-pre-wrap bg-gray-50 p-3 rounded max-h-48 overflow-y-auto">
            {protein.sequence}
          </div>
        </div>
      )}
    </div>
  );
}

/* Helper components */

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 text-right max-w-[200px] truncate" title={value || ''}>
        {value || '-'}
      </dd>
    </div>
  );
}

function SSBar({ label, fraction, color }: { label: string; fraction: number | null; color: string }) {
  const pct = fraction ? fraction * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-12">{label}</span>
      <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function getPlddtColor(plddt: number | null): string {
  if (plddt === null) return 'text-gray-600';
  if (plddt >= 90) return 'text-blue-600';
  if (plddt >= 70) return 'text-cyan-600';
  if (plddt >= 50) return 'text-yellow-600';
  return 'text-orange-600';
}
