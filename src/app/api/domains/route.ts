/**
 * GET /api/domains
 *
 * Returns domain landscape statistics: T-group distribution,
 * judge breakdown, and Pfam coverage summary (ECOD-known vs novel).
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const [
      tgroupDist,
      judgeDist,
      pfamCoverage,
      domainCounts,
      novelPfamFamilies,
    ] = await Promise.all([
      // T-group distribution (top 30) with 3-way Pfam classification
      query<{ t_group: string; t_group_name: string | null; count: string; ecod_pfam: string; novel_pfam: string; no_pfam: string }>(`
        SELECT
          dc.t_group,
          c.name AS t_group_name,
          COUNT(*) AS count,
          COUNT(*) FILTER (WHERE dc.pfam_class = 'ecod') AS ecod_pfam,
          COUNT(*) FILTER (WHERE dc.pfam_class = 'novel') AS novel_pfam,
          COUNT(*) FILTER (WHERE dc.pfam_class = 'none') AS no_pfam
        FROM archaea.mv_domain_pfam_class dc
        LEFT JOIN ecod_rep.cluster c ON dc.t_group = c.id AND c.type = 'T'
        WHERE dc.t_group IS NOT NULL
        GROUP BY dc.t_group, c.name
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

      // Pfam coverage — 3-way: ECOD-known, novel, none (matview scan ~70ms)
      query<{ ecod_pfam: string; novel_pfam: string; no_pfam: string }>(`
        SELECT
          COUNT(*) FILTER (WHERE pfam_class = 'ecod') AS ecod_pfam,
          COUNT(*) FILTER (WHERE pfam_class = 'novel') AS novel_pfam,
          COUNT(*) FILTER (WHERE pfam_class = 'none') AS no_pfam
        FROM archaea.mv_domain_pfam_class
      `),

      // Domain/protein/tgroup counts (base table, faster for COUNT DISTINCT ~200ms)
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

      // Novel Pfam families (separate to run in parallel)
      query<{ count: string }>(`
        SELECT COUNT(DISTINCT dph.pfam_acc) AS count
        FROM archaea.domain_pfam_hits dph
        JOIN archaea.mv_domain_pfam_class dc ON dph.domain_id = dc.domain_id
        WHERE dc.pfam_class = 'novel'
      `),
    ]);

    const dc = domainCounts.rows[0];
    return NextResponse.json({
      total_domains: parseInt(dc?.total || '0'),
      proteins_with_domains: parseInt(dc?.proteins || '0'),
      unique_tgroups: parseInt(dc?.unique_tgroups || '0'),
      multi_domain_proteins: parseInt(dc?.multi_domain_proteins || '0'),
      novel_pfam_families: parseInt(novelPfamFamilies.rows[0]?.count || '0'),
      tgroup_distribution: tgroupDist.rows.map(r => ({
        t_group: r.t_group,
        t_group_name: r.t_group_name,
        count: parseInt(r.count),
        ecod_pfam: parseInt(r.ecod_pfam),
        novel_pfam: parseInt(r.novel_pfam),
        no_pfam: parseInt(r.no_pfam),
      })),
      judge_breakdown: judgeDist.rows.map(r => ({
        judge: r.judge,
        count: parseInt(r.count),
      })),
      pfam_coverage: {
        ecod_pfam: parseInt(pfamCoverage.rows[0]?.ecod_pfam || '0'),
        novel_pfam: parseInt(pfamCoverage.rows[0]?.novel_pfam || '0'),
        no_pfam: parseInt(pfamCoverage.rows[0]?.no_pfam || '0'),
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
