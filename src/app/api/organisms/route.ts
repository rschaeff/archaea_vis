/**
 * GET /api/organisms
 *
 * Returns all 65 target organisms with aggregated protein, domain,
 * structure, novel fold, and pipeline gap statistics.
 *
 * Uses pre-aggregated subqueries joined once (not LATERAL) for performance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phylum = searchParams.get('phylum');
    const majorGroup = searchParams.get('major_group');
    const sortBy = searchParams.get('sort') || 'protein_count';
    const sortOrder = searchParams.get('order')?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const VALID_SORTS = [
      'organism_name', 'protein_count', 'proteins_with_structures',
      'proteins_with_domains', 'domain_count', 'novel_fold_count',
      'avg_plddt', 'missing_structures', 'unclassified',
    ];
    const validatedSort = VALID_SORTS.includes(sortBy) ? sortBy : 'protein_count';

    let filterSql = '';
    const params: string[] = [];
    let paramIdx = 1;

    if (phylum) {
      filterSql += ` AND tc.phylum = $${paramIdx++}`;
      params.push(phylum);
    }
    if (majorGroup) {
      filterSql += ` AND tc.major_group = $${paramIdx++}`;
      params.push(majorGroup);
    }

    // Run the main query and filter queries in parallel
    const [result, phylumOptions, groupOptions] = await Promise.all([
      query(`
        WITH protein_stats AS (
          SELECT
            tp.target_class_id,
            COUNT(*) AS actual_protein_count,
            COUNT(*) FILTER (WHERE tp.has_structure = true) AS proteins_with_structures,
            COUNT(*) FILTER (WHERE tp.has_structure = false) AS missing_structures,
            COUNT(*) FILTER (WHERE tp.has_pae = true) AS proteins_with_pae
          FROM archaea.target_proteins tp
          GROUP BY tp.target_class_id
        ),
        quality_stats AS (
          SELECT
            tp.target_class_id,
            ROUND(AVG(sqm.mean_plddt)::numeric, 1) AS avg_plddt,
            ROUND(AVG(sqm.quality_score)::numeric, 2) AS avg_quality_score
          FROM archaea.target_proteins tp
          JOIN archaea.structure_quality_metrics sqm ON sqm.protein_id = tp.protein_id
          GROUP BY tp.target_class_id
        ),
        domain_stats AS (
          SELECT
            tp.target_class_id,
            COUNT(*) AS domain_count,
            COUNT(DISTINCT d.protein_id) AS proteins_with_domains,
            COUNT(*) FILTER (WHERE d.judge = 'good_domain') AS good_domains
          FROM archaea.domains d
          JOIN archaea.target_proteins tp ON d.protein_id = tp.protein_id
          GROUP BY tp.target_class_id
        ),
        novel_stats AS (
          SELECT
            target_class_id,
            SUM(t1_clusters) AS novel_t1_clusters,
            SUM(t1_proteins) AS novel_t1_proteins,
            SUM(t2_clusters) AS novel_t2_clusters,
            SUM(t2_domains) AS novel_t2_domains
          FROM (
            -- Tier 1: dark proteins (join on db_protein_id for pipe-format match)
            SELECT tp.target_class_id,
              COUNT(DISTINCT nfc.cluster_id) AS t1_clusters,
              COUNT(DISTINCT nfc.db_protein_id) AS t1_proteins,
              0::bigint AS t2_clusters,
              0::bigint AS t2_domains
            FROM archaea.novel_fold_clusters nfc
            JOIN archaea.target_proteins tp ON nfc.db_protein_id = tp.protein_id
            GROUP BY tp.target_class_id
            UNION ALL
            -- Tier 2: orphan domains
            SELECT tp.target_class_id,
              0::bigint, 0::bigint,
              COUNT(DISTINCT ndc.cluster_id),
              COUNT(*)
            FROM archaea.novel_domain_clusters ndc
            JOIN archaea.target_proteins tp ON ndc.protein_id = tp.protein_id
            GROUP BY tp.target_class_id
          ) combined
          GROUP BY target_class_id
        )
        SELECT
          tc.id,
          tc.class_name,
          tc.organism_name,
          tc.phylum,
          tc.major_group,
          tc.genome_accession,
          tc.tax_id,
          tc.source_category,
          tc.protein_count,
          COALESCE(ps.actual_protein_count, 0) AS actual_protein_count,
          COALESCE(ps.proteins_with_structures, 0) AS proteins_with_structures,
          COALESCE(ps.missing_structures, 0) AS missing_structures,
          COALESCE(ps.proteins_with_pae, 0) AS proteins_with_pae,
          COALESCE(ds.domain_count, 0) AS domain_count,
          COALESCE(ds.proteins_with_domains, 0) AS proteins_with_domains,
          COALESCE(ds.good_domains, 0) AS good_domains,
          -- Unclassified: have structure but no DPAM domains
          COALESCE(ps.proteins_with_structures, 0) - COALESCE(ds.proteins_with_domains, 0) AS unclassified,
          COALESCE(ns.novel_t1_clusters, 0) AS novel_t1_clusters,
          COALESCE(ns.novel_t1_proteins, 0) AS novel_t1_proteins,
          COALESCE(ns.novel_t2_clusters, 0) AS novel_t2_clusters,
          COALESCE(ns.novel_t2_domains, 0) AS novel_t2_domains,
          COALESCE(ns.novel_t1_clusters, 0) + COALESCE(ns.novel_t2_clusters, 0) AS novel_fold_count,
          qs.avg_plddt,
          qs.avg_quality_score
        FROM archaea.target_classes tc
        LEFT JOIN protein_stats ps ON ps.target_class_id = tc.id
        LEFT JOIN quality_stats qs ON qs.target_class_id = tc.id
        LEFT JOIN domain_stats ds ON ds.target_class_id = tc.id
        LEFT JOIN novel_stats ns ON ns.target_class_id = tc.id
        WHERE 1=1 ${filterSql}
        ORDER BY ${validatedSort} ${sortOrder} NULLS LAST
      `, params),

      query<{ phylum: string; count: string }>(`
        SELECT phylum, COUNT(*) AS count
        FROM archaea.target_classes
        GROUP BY phylum ORDER BY count DESC
      `),

      query<{ major_group: string; count: string }>(`
        SELECT major_group, COUNT(*) AS count
        FROM archaea.target_classes
        WHERE major_group IS NOT NULL
        GROUP BY major_group ORDER BY count DESC
      `),
    ]);

    return NextResponse.json({
      organisms: result.rows,
      total: result.rows.length,
      filters: {
        phyla: phylumOptions.rows.map(r => ({ value: r.phylum, count: parseInt(r.count) })),
        major_groups: groupOptions.rows.map(r => ({ value: r.major_group, count: parseInt(r.count) })),
      },
    });
  } catch (error) {
    console.error('Organisms API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch organisms',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
