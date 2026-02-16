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
    ] = await Promise.all([
      // T-group distribution (top 30) with names and Pfam counts
      query<{ t_group: string; t_group_name: string | null; count: string; with_pfam: string; without_pfam: string }>(`
        SELECT
          d.t_group,
          c.name AS t_group_name,
          COUNT(*) AS count,
          COUNT(DISTINCT d.id) FILTER (WHERE dph.id IS NOT NULL) AS with_pfam,
          COUNT(DISTINCT d.id) FILTER (WHERE dph.id IS NULL) AS without_pfam
        FROM archaea.domains d
        LEFT JOIN ecod_rep.cluster c ON d.t_group = c.id AND c.type = 'T'
        LEFT JOIN archaea.domain_pfam_hits dph ON d.id = dph.domain_id
        WHERE d.t_group IS NOT NULL
        GROUP BY d.t_group, c.name
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

      // Total domains + unique T-groups + multi-domain proteins
      query<{ total: string; proteins: string; unique_tgroups: string; multi_domain_proteins: string }>(`
        SELECT
          COUNT(*) AS total,
          COUNT(DISTINCT protein_id) AS proteins,
          COUNT(DISTINCT t_group) AS unique_tgroups,
          (SELECT COUNT(*) FROM (
            SELECT protein_id FROM archaea.domains GROUP BY protein_id HAVING COUNT(*) > 1
          ) sub) AS multi_domain_proteins
        FROM archaea.domains
      `),
    ]);

    return NextResponse.json({
      total_domains: parseInt(totalDomains.rows[0]?.total || '0'),
      proteins_with_domains: parseInt(totalDomains.rows[0]?.proteins || '0'),
      unique_tgroups: parseInt(totalDomains.rows[0]?.unique_tgroups || '0'),
      multi_domain_proteins: parseInt(totalDomains.rows[0]?.multi_domain_proteins || '0'),
      tgroup_distribution: tgroupDist.rows.map(r => ({
        t_group: r.t_group,
        t_group_name: r.t_group_name,
        count: parseInt(r.count),
        with_pfam: parseInt(r.with_pfam),
        without_pfam: parseInt(r.without_pfam),
      })),
      judge_breakdown: judgeDist.rows.map(r => ({
        judge: r.judge,
        count: parseInt(r.count),
      })),
      pfam_coverage: {
        with_pfam: parseInt(pfamCoverage.rows[0]?.with_pfam || '0'),
        without_pfam: parseInt(pfamCoverage.rows[0]?.without_pfam || '0'),
      },
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
