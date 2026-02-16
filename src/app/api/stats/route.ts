/**
 * GET /api/stats
 *
 * Returns comprehensive statistics for the archaea dashboard.
 * Queries protein counts, domain coverage, source breakdown,
 * curation progress, and novel fold summary.
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { ArchaeaStats, CurationProgress } from '@/lib/types';

export async function GET() {
  try {
    // Run independent queries in parallel
    const [
      proteinCounts,
      domainCounts,
      clusterCount,
      candidateCount,
      novelFoldCounts,
      novelDomainCounts,
      statusBreakdown,
      noveltyBreakdown,
      sourceBreakdown,
      judgeBreakdown,
      progressResult,
    ] = await Promise.all([
      // Protein counts
      query<{ total: string; with_structure: string; with_quality: string }>(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE has_structure = TRUE) AS with_structure,
          COUNT(*) FILTER (WHERE protein_id IN (
            SELECT protein_id FROM archaea.structure_quality_metrics
          )) AS with_quality
        FROM archaea.target_proteins
      `),

      // Domain counts
      query<{ total_domains: string; proteins_with_domains: string }>(`
        SELECT
          COUNT(*) AS total_domains,
          COUNT(DISTINCT protein_id) AS proteins_with_domains
        FROM archaea.domains
      `),

      // Cluster count
      query<{ count: string }>(`
        SELECT COUNT(*) AS count FROM archaea.structural_clusters
      `),

      // Curation candidate count
      query<{ count: string }>(`
        SELECT COUNT(*) AS count FROM archaea.curation_candidates
      `),

      // Novel fold counts (Tier 1)
      query<{ clusters: string; proteins: string }>(`
        SELECT
          COUNT(DISTINCT cluster_id) AS clusters,
          COUNT(*) AS proteins
        FROM archaea.novel_fold_clusters
      `),

      // Novel domain counts (Tier 2)
      query<{ clusters: string; domains: string }>(`
        SELECT
          COUNT(DISTINCT cluster_id) AS clusters,
          COUNT(*) AS domains
        FROM archaea.novel_domain_clusters
      `),

      // Status breakdown
      query<{ status: string; count: string }>(`
        SELECT curation_status AS status, COUNT(*) AS count
        FROM archaea.curation_candidates
        GROUP BY curation_status
      `),

      // Novelty breakdown
      query<{ novelty: string; count: string }>(`
        SELECT novelty_category AS novelty, COUNT(*) AS count
        FROM archaea.curation_candidates
        GROUP BY novelty_category
      `),

      // Source breakdown
      query<{ source: string; count: string }>(`
        SELECT source, COUNT(*) AS count
        FROM archaea.target_proteins
        GROUP BY source
        ORDER BY count DESC
      `),

      // Domain judge breakdown
      query<{ judge: string; count: string }>(`
        SELECT judge, COUNT(*) AS count
        FROM archaea.domains
        GROUP BY judge
        ORDER BY count DESC
      `),

      // Curation progress (from view)
      query<CurationProgress>(`
        SELECT * FROM archaea.v_curation_progress
        ORDER BY novelty_category, priority_category, curation_status
      `),
    ]);

    // Build response
    const stats: ArchaeaStats = {
      total_proteins: parseInt(proteinCounts.rows[0]?.total || '0'),
      with_structure: parseInt(proteinCounts.rows[0]?.with_structure || '0'),
      with_quality_metrics: parseInt(proteinCounts.rows[0]?.with_quality || '0'),
      total_domains: parseInt(domainCounts.rows[0]?.total_domains || '0'),
      proteins_with_domains: parseInt(domainCounts.rows[0]?.proteins_with_domains || '0'),
      total_clusters: parseInt(clusterCount.rows[0]?.count || '0'),
      curation_candidates: parseInt(candidateCount.rows[0]?.count || '0'),
      novel_fold_clusters: parseInt(novelFoldCounts.rows[0]?.clusters || '0'),
      novel_fold_proteins: parseInt(novelFoldCounts.rows[0]?.proteins || '0'),
      novel_domain_clusters: parseInt(novelDomainCounts.rows[0]?.clusters || '0'),
      novel_domain_count: parseInt(novelDomainCounts.rows[0]?.domains || '0'),
      status_breakdown: {
        pending: 0,
        in_review: 0,
        classified: 0,
        deferred: 0,
        rejected: 0,
        needs_reanalysis: 0,
      },
      novelty_breakdown: {
        dark: 0,
        'sequence-orphan': 0,
        divergent: 0,
        known: 0,
      },
      source_breakdown: {},
      domain_judge_breakdown: {},
    };

    for (const row of statusBreakdown.rows) {
      const status = row.status as keyof typeof stats.status_breakdown;
      if (status in stats.status_breakdown) {
        stats.status_breakdown[status] = parseInt(row.count);
      }
    }

    for (const row of noveltyBreakdown.rows) {
      const novelty = row.novelty as keyof typeof stats.novelty_breakdown;
      if (novelty in stats.novelty_breakdown) {
        stats.novelty_breakdown[novelty] = parseInt(row.count);
      }
    }

    for (const row of sourceBreakdown.rows) {
      stats.source_breakdown[row.source] = parseInt(row.count);
    }

    for (const row of judgeBreakdown.rows) {
      stats.domain_judge_breakdown[row.judge || 'NULL'] = parseInt(row.count);
    }

    return NextResponse.json({
      stats,
      progress: progressResult.rows,
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch statistics',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
