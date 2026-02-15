'use client';

/**
 * Curation Review Page — protein detail + decision form.
 * Combines protein info with curation controls.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import ProvenanceBadge from '@/components/ProvenanceBadge';
import { noveltyColor, statusColor, judgeColor } from '@/lib/utils';
import type { ArchaeaProteinDetail, DomainWithPfam } from '@/lib/types';

const StructureViewer = dynamic(() => import('@/components/StructureViewer'), { ssr: false });

interface ReviewData {
  protein: ArchaeaProteinDetail;
  domains: DomainWithPfam[];
}

export default function CurationReviewPage() {
  const params = useParams();
  const router = useRouter();
  const proteinId = params.id as string;

  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Curation form state
  const [curatorName, setCuratorName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [proteinId]);

  // Load curator name from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('archaea_curator_name');
    if (saved) setCuratorName(saved);
  }, []);

  const handleDecision = async (decisionType: string) => {
    if (!curatorName.trim()) {
      setSubmitError('Please enter your name');
      return;
    }

    // Save curator name
    localStorage.setItem('archaea_curator_name', curatorName.trim());

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/curation/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protein_id: proteinId,
          curator: curatorName.trim(),
          decision_type: decisionType,
          is_novel_fold: decisionType === 'flag_novel',
          notes: notes.trim() || undefined,
        }),
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit decision');
      }

      // Navigate to next protein or back to queue
      if (result.next_protein) {
        router.push(`/curation/review/${result.next_protein}`);
      } else {
        router.push('/curation');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

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
          <p className="text-red-600 mt-2">{error}</p>
          <Link href="/curation" className="mt-4 inline-block text-blue-600 hover:text-blue-800">&larr; Back to Queue</Link>
        </div>
      </div>
    );
  }

  const { protein, domains } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{protein.protein_id}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <ProvenanceBadge source={protein.source} cifFile={protein.cif_file} />
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
        <Link href="/curation" className="text-blue-600 hover:text-blue-800 font-medium text-sm">&larr; Queue</Link>
      </div>

      {/* Structure Viewer */}
      {protein.has_structure && (
        <div className="mb-6">
          <StructureViewer
            proteinId={protein.protein_id}
            domains={domains}
            height="400px"
          />
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left: Taxonomy + Quality */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Taxonomy</h3>
            <dl className="space-y-1.5 text-sm">
              <Row label="Organism" value={protein.organism_name} />
              <Row label="Class" value={protein.class_name} />
              <Row label="Phylum" value={protein.phylum} />
              <Row label="Major Group" value={protein.major_group} />
              <Row label="Source" value={protein.source} />
            </dl>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Quality</h3>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">pLDDT</dt>
                <dd className={`font-medium ${getPlddtColor(protein.mean_plddt)}`}>
                  {protein.mean_plddt?.toFixed(1) || '-'}
                </dd>
              </div>
              <Row label="pTM" value={protein.ptm?.toFixed(3)} />
              <Row label="Quality Score" value={protein.quality_score?.toFixed(2)} />
              <Row label="Category" value={protein.af3_quality_category} />
              <Row label="SS Category" value={protein.ss_category} />
              <Row label="Rg Category" value={protein.rg_category} />
            </dl>
          </div>

          {/* Curation Info */}
          {protein.priority_category && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Curation Info</h3>
              <dl className="space-y-1.5 text-sm">
                <Row label="Priority" value={protein.priority_category} />
                <Row label="Rank" value={protein.priority_rank != null ? String(protein.priority_rank) : null} />
                <Row label="Novel Fold" value={protein.is_novel_fold === true ? 'Yes' : protein.is_novel_fold === false ? 'No' : null} />
                {protein.structural_cluster_id && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Cluster</dt>
                    <dd>
                      <Link href={`/clusters/${protein.structural_cluster_id}`} className="text-blue-600 hover:text-blue-800">
                        #{protein.structural_cluster_id} ({protein.actual_cluster_size || protein.structural_cluster_size} members)
                      </Link>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>

        {/* Center: Domains */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">DPAM Domains ({domains.length})</h3>
            </div>
            {domains.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No domains</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {domains.map(d => (
                  <div key={d.id} className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm text-gray-900">{d.domain_num}: {d.range}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${judgeColor(d.judge)}`}>
                        {d.judge || '-'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      T-group: {d.t_group || '-'}
                      {' '}&middot; DPAM: {d.dpam_prob || '-'}
                      {' '}&middot; HH: {d.hh_prob || '-'}
                    </div>
                    {d.pfam_hits.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {d.pfam_hits.map((h, i) => (
                          <a
                            key={i}
                            href={`https://www.ebi.ac.uk/interpro/entry/pfam/${h.pfam_acc}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-100"
                          >
                            {h.pfam_acc}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Decision Form */}
        <div>
          {protein.curation_status === 'pending' ? (
            <div className="bg-white border border-gray-200 rounded-lg p-4 sticky top-6">
              <h3 className="font-semibold text-gray-900 mb-4">Curation Decision</h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Curator Name</label>
                <input
                  type="text"
                  value={curatorName}
                  onChange={e => setCuratorName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="Your name"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Observations..."
                />
              </div>

              {submitError && (
                <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                  {submitError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleDecision('approve')}
                  disabled={submitting}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleDecision('flag_novel')}
                  disabled={submitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium disabled:opacity-50"
                >
                  Flag Novel
                </button>
                <button
                  onClick={() => handleDecision('defer')}
                  disabled={submitting}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md text-sm font-medium disabled:opacity-50"
                >
                  Defer
                </button>
                <button
                  onClick={() => handleDecision('skip')}
                  disabled={submitting}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md text-sm font-medium disabled:opacity-50"
                >
                  Skip
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Already Reviewed</h3>
              <p className="text-sm text-gray-600">
                This protein has status: <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(protein.curation_status || '')}`}>{protein.curation_status}</span>
              </p>
              {protein.curator_notes && (
                <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-700">{protein.curator_notes}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sequence */}
      {protein.sequence && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Sequence</h3>
          <div className="font-mono text-xs text-gray-700 break-all whitespace-pre-wrap bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
            {protein.sequence}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 text-right max-w-[180px] truncate" title={value || ''}>{value || '-'}</dd>
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
