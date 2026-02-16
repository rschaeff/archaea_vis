'use client';

/**
 * Domain Landscape — T-group distribution, judge breakdown, Pfam coverage.
 * Pfam coverage differentiates ECOD-known vs novel Pfam families.
 */

import { useState, useEffect } from 'react';
import { judgeColor } from '@/lib/utils';

interface TgroupEntry {
  t_group: string;
  t_group_name: string | null;
  count: number;
  ecod_pfam: number;
  novel_pfam: number;
  no_pfam: number;
}

interface JudgeEntry {
  judge: string;
  count: number;
}

interface DomainData {
  total_domains: number;
  proteins_with_domains: number;
  unique_tgroups: number;
  multi_domain_proteins: number;
  novel_pfam_families: number;
  tgroup_distribution: TgroupEntry[];
  judge_breakdown: JudgeEntry[];
  pfam_coverage: { ecod_pfam: number; novel_pfam: number; no_pfam: number };
}

export default function DomainsPage() {
  const [data, setData] = useState<DomainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/domains')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch domain data');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-200 rounded"></div>)}
          </div>
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
        </div>
      </div>
    );
  }

  const totalJudge = data.judge_breakdown.reduce((s, j) => s + j.count, 0);
  const totalPfam = data.pfam_coverage.ecod_pfam + data.pfam_coverage.novel_pfam + data.pfam_coverage.no_pfam;
  const maxTgroupCount = data.tgroup_distribution[0]?.count || 1;
  const singleDomainProteins = data.proteins_with_domains - data.multi_domain_proteins;

  // Donut percentages
  const ecodPct = totalPfam > 0 ? (data.pfam_coverage.ecod_pfam / totalPfam) * 100 : 0;
  const novelPct = totalPfam > 0 ? (data.pfam_coverage.novel_pfam / totalPfam) * 100 : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Domain Landscape</h1>
      <p className="text-gray-600 mb-6">
        DPAM domain classification across {data.proteins_with_domains.toLocaleString()} archaeal proteins
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{data.total_domains.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Total Domains</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{data.proteins_with_domains.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Proteins with Domains</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{data.pfam_coverage.ecod_pfam.toLocaleString()}</div>
          <div className="text-sm text-gray-500">ECOD-Known Pfam</div>
          <div className="text-xs text-gray-400 mt-1">
            {data.pfam_coverage.novel_pfam.toLocaleString()} novel Pfam, {data.pfam_coverage.no_pfam.toLocaleString()} no Pfam
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{data.unique_tgroups.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Unique T-groups</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Judge Breakdown */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold text-gray-900 mb-4">Judge Categories</h2>
          <div className="space-y-3">
            {data.judge_breakdown.map(j => {
              const pct = totalJudge > 0 ? (j.count / totalJudge) * 100 : 0;
              return (
                <div key={j.judge}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${judgeColor(j.judge)}`}>
                      {j.judge || 'NULL'}
                    </span>
                    <span className="text-sm text-gray-600">
                      {j.count.toLocaleString()} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-gray-400 h-2 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pfam Coverage — 3-way donut */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold text-gray-900 mb-4">Pfam Coverage</h2>
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <div className="relative w-32 h-32 mx-auto">
                <svg viewBox="0 0 36 36" className="w-32 h-32 transform -rotate-90">
                  {/* Gray background ring */}
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="3"
                  />
                  {/* ECOD Pfam arc (blue) — starts at 0 */}
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    strokeDasharray={`${ecodPct}, 100`}
                  />
                  {/* Novel Pfam arc (amber) — starts after ECOD */}
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3"
                    strokeDasharray={`${novelPct}, 100`}
                    strokeDashoffset={`${-ecodPct}`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-gray-900">
                    {totalPfam > 0 ? (ecodPct + novelPct).toFixed(0) : 0}%
                  </span>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex items-center gap-2 justify-center">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <span>ECOD Pfam: {data.pfam_coverage.ecod_pfam.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <span>Novel Pfam: {data.pfam_coverage.novel_pfam.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <span className="w-3 h-3 rounded-full bg-gray-200"></span>
                  <span>No Pfam: {data.pfam_coverage.no_pfam.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold text-gray-900 mb-4">Quick Stats</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Domains / Protein</dt>
              <dd className="font-medium text-gray-900">
                {data.proteins_with_domains > 0
                  ? (data.total_domains / data.proteins_with_domains).toFixed(1)
                  : '-'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Unique T-groups</dt>
              <dd className="font-medium text-gray-900">{data.unique_tgroups.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Multi-domain Proteins</dt>
              <dd className="font-medium text-gray-900">{data.multi_domain_proteins.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Single-domain Proteins</dt>
              <dd className="font-medium text-gray-900">{singleDomainProteins.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Novel Pfam Families</dt>
              <dd className="font-medium text-amber-600">{data.novel_pfam_families.toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* T-group Distribution */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">T-group Distribution (Top 30)</h2>
        </div>
        <div className="p-4 space-y-2">
          {data.tgroup_distribution.map(t => {
            const pct = (t.count / maxTgroupCount) * 100;
            const ecodBarPct = t.count > 0 ? (t.ecod_pfam / t.count) * 100 : 0;
            const novelBarPct = t.count > 0 ? (t.novel_pfam / t.count) * 100 : 0;
            const label = t.t_group_name || t.t_group;
            return (
              <div key={t.t_group} className="flex items-center gap-3">
                <div
                  className="w-48 text-sm text-gray-700 truncate flex-shrink-0"
                  title={`${t.t_group}${t.t_group_name ? ' — ' + t.t_group_name : ''}`}
                >
                  {label}
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                  {/* ECOD Pfam (blue) */}
                  <div
                    className="bg-blue-500 h-5 absolute left-0"
                    style={{ width: `${pct * (ecodBarPct / 100)}%` }}
                    title={`ECOD Pfam: ${t.ecod_pfam.toLocaleString()}`}
                  />
                  {/* Novel Pfam (amber) */}
                  <div
                    className="bg-amber-500 h-5 absolute"
                    style={{
                      left: `${pct * (ecodBarPct / 100)}%`,
                      width: `${pct * (novelBarPct / 100)}%`,
                    }}
                    title={`Novel Pfam: ${t.novel_pfam.toLocaleString()}`}
                  />
                  {/* No Pfam (gray) */}
                  <div
                    className="bg-gray-300 h-5 absolute"
                    style={{
                      left: `${pct * ((ecodBarPct + novelBarPct) / 100)}%`,
                      width: `${pct * ((100 - ecodBarPct - novelBarPct) / 100)}%`,
                    }}
                    title={`No Pfam: ${t.no_pfam.toLocaleString()}`}
                  />
                </div>
                <div className="w-16 text-sm text-gray-600 text-right flex-shrink-0">
                  {t.count.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-500"></span> ECOD Pfam
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-500"></span> Novel Pfam
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-gray-300"></span> No Pfam
          </span>
        </div>
      </div>
    </div>
  );
}
