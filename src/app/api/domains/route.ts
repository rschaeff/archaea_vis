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
      totalDomains,
    ] = await Promise.all([
      // T-group distribution (top 30) with 3-way Pfam classification
      query<{ t_group: string; t_group_name: string | null; count: string; ecod_pfam: string; novel_pfam: string; no_pfam: string }>(`
        WITH ecod_pfams AS (
          SELECT DISTINCT trim(unnest(string_to_array(pfam_acc, ','))) AS pfam_acc
          FROM public.f_id_pfam_acc
          WHERE pfam_acc IS NOT NULL
        ),
        domain_class AS (
          SELECT
            d.id, d.t_group,
            CASE
              WHEN bool_or(ep.pfam_acc IS NOT NULL) THEN 'ecod'
              WHEN bool_or(dph.id IS NOT NULL) THEN 'novel'
              ELSE 'none'
            END AS pfam_class
          FROM archaea.domains d
          LEFT JOIN archaea.domain_pfam_hits dph ON d.id = dph.domain_id
          LEFT JOIN ecod_pfams ep ON dph.pfam_acc = ep.pfam_acc
          WHERE d.t_group IS NOT NULL
          GROUP BY d.id, d.t_group
        )
        SELECT
          dc.t_group,
          c.name AS t_group_name,
          COUNT(*) AS count,
          COUNT(*) FILTER (WHERE dc.pfam_class = 'ecod') AS ecod_pfam,
          COUNT(*) FILTER (WHERE dc.pfam_class = 'novel') AS novel_pfam,
          COUNT(*) FILTER (WHERE dc.pfam_class = 'none') AS no_pfam
        FROM domain_class dc
        LEFT JOIN ecod_rep.cluster c ON dc.t_group = c.id AND c.type = 'T'
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

      // Pfam coverage — 3-way: ECOD-known, novel, none
      query<{ ecod_pfam: string; novel_pfam: string; no_pfam: string }>(`
        WITH ecod_pfams AS (
          SELECT DISTINCT trim(unnest(string_to_array(pfam_acc, ','))) AS pfam_acc
          FROM public.f_id_pfam_acc
          WHERE pfam_acc IS NOT NULL
        ),
        domain_class AS (
          SELECT
            d.id,
            CASE
              WHEN bool_or(ep.pfam_acc IS NOT NULL) THEN 'ecod'
              WHEN bool_or(dph.id IS NOT NULL) THEN 'novel'
              ELSE 'none'
            END AS pfam_class
          FROM archaea.domains d
          LEFT JOIN archaea.domain_pfam_hits dph ON d.id = dph.domain_id
          LEFT JOIN ecod_pfams ep ON dph.pfam_acc = ep.pfam_acc
          GROUP BY d.id
        )
        SELECT
          COUNT(*) FILTER (WHERE pfam_class = 'ecod') AS ecod_pfam,
          COUNT(*) FILTER (WHERE pfam_class = 'novel') AS novel_pfam,
          COUNT(*) FILTER (WHERE pfam_class = 'none') AS no_pfam
        FROM domain_class
      `),

      // Total domains + unique T-groups + multi-domain proteins + novel Pfam families
      query<{ total: string; proteins: string; unique_tgroups: string; multi_domain_proteins: string; novel_pfam_families: string }>(`
        SELECT
          COUNT(*) AS total,
          COUNT(DISTINCT protein_id) AS proteins,
          COUNT(DISTINCT t_group) AS unique_tgroups,
          (SELECT COUNT(*) FROM (
            SELECT protein_id FROM archaea.domains GROUP BY protein_id HAVING COUNT(*) > 1
          ) sub) AS multi_domain_proteins,
          (SELECT COUNT(*) FROM (
            SELECT DISTINCT dph.pfam_acc
            FROM archaea.domain_pfam_hits dph
            WHERE NOT EXISTS (
              SELECT 1 FROM public.f_id_pfam_acc f
              WHERE f.pfam_acc IS NOT NULL
                AND dph.pfam_acc = ANY(string_to_array(f.pfam_acc, ','))
            )
          ) sub2) AS novel_pfam_families
        FROM archaea.domains
      `),
    ]);

    return NextResponse.json({
      total_domains: parseInt(totalDomains.rows[0]?.total || '0'),
      proteins_with_domains: parseInt(totalDomains.rows[0]?.proteins || '0'),
      unique_tgroups: parseInt(totalDomains.rows[0]?.unique_tgroups || '0'),
      multi_domain_proteins: parseInt(totalDomains.rows[0]?.multi_domain_proteins || '0'),
      novel_pfam_families: parseInt(totalDomains.rows[0]?.novel_pfam_families || '0'),
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
