/**
 * GET /api/domains
 *
 * Returns domain landscape statistics: T-group distribution,
 * judge breakdown, and Pfam coverage summary.
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const [
      tgroupDist,
      judgeDist,
      pfamCoverage,
      totalDomains,
      topTgroups,
    ] = await Promise.all([
      // T-group distribution (top 30)
      query<{ t_group: string; count: string; judge_good: string; judge_ambig: string }>(`
        SELECT
          t_group,
          COUNT(*) AS count,
          COUNT(*) FILTER (WHERE judge = 'good_domain') AS judge_good,
          COUNT(*) FILTER (WHERE judge IN ('low_confidence', 'partial_domain')) AS judge_ambig
        FROM archaea.domains
        WHERE t_group IS NOT NULL
        GROUP BY t_group
        ORDER BY count DESC
        LIMIT 30
      `),

      // Judge breakdown
      query<{ judge: string; count: string }>(`
        SELECT judge, COUNT(*) AS count
        FROM archaea.domains
        GROUP BY judge
        ORDER BY count DESC
      `),

      // Pfam coverage
      query<{ with_pfam: string; without_pfam: string }>(`
        SELECT
          COUNT(DISTINCT d.id) FILTER (WHERE dph.id IS NOT NULL) AS with_pfam,
          COUNT(DISTINCT d.id) FILTER (WHERE dph.id IS NULL) AS without_pfam
        FROM archaea.domains d
        LEFT JOIN archaea.domain_pfam_hits dph ON d.id = dph.domain_id
      `),

      // Total domains
      query<{ total: string; proteins: string }>(`
        SELECT COUNT(*) AS total, COUNT(DISTINCT protein_id) AS proteins
        FROM archaea.domains
      `),

      // Top T-groups with names (from the domains themselves)
      query<{ t_group: string; count: string; sources: string }>(`
        SELECT
          d.t_group,
          COUNT(*) AS count,
          string_agg(DISTINCT tp.source, ', ') AS sources
        FROM archaea.domains d
        JOIN archaea.target_proteins tp ON d.protein_id = tp.protein_id
        WHERE d.t_group IS NOT NULL
        GROUP BY d.t_group
        ORDER BY count DESC
        LIMIT 50
      `),
    ]);

    return NextResponse.json({
      total_domains: parseInt(totalDomains.rows[0]?.total || '0'),
      proteins_with_domains: parseInt(totalDomains.rows[0]?.proteins || '0'),
      tgroup_distribution: tgroupDist.rows.map(r => ({
        t_group: r.t_group,
        count: parseInt(r.count),
        judge_good: parseInt(r.judge_good),
        judge_ambiguous: parseInt(r.judge_ambig),
      })),
      judge_breakdown: judgeDist.rows.map(r => ({
        judge: r.judge,
        count: parseInt(r.count),
      })),
      pfam_coverage: {
        with_pfam: parseInt(pfamCoverage.rows[0]?.with_pfam || '0'),
        without_pfam: parseInt(pfamCoverage.rows[0]?.without_pfam || '0'),
      },
      top_tgroups: topTgroups.rows.map(r => ({
        t_group: r.t_group,
        count: parseInt(r.count),
        sources: r.sources,
      })),
    });
  } catch (error) {
    console.error('Domains API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch domain landscape',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
