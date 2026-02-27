/**
 * GET /api/novel-folds
 *
 * Returns paginated list of novel fold/domain clusters with two-tier support.
 * ?tier=1 — Tier 1: Dark Proteins (from v_novel_fold_cluster_summary)
 * ?tier=2 — Tier 2: Orphan Domains (inline aggregation from novel_domain_clusters)
 * Always returns overview stats for both tiers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePagination, parseSort } from '@/lib/utils';

const TIER1_SORT_COLUMNS = [
  'cluster_size',
  'avg_plddt',
  'phylum_count',
  'cluster_id',
  'genome_count',
  'dark_matter_class',
];

const TIER2_SORT_COLUMNS = [
  'cluster_size',
  'avg_plddt',
  'avg_dpam_prob',
  'phylum_count',
  'cluster_id',
  'genome_count',
  'protein_count',
  'avg_best_lddt',
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tier = parseInt(searchParams.get('tier') || '1');

    if (tier !== 1 && tier !== 2) {
      return NextResponse.json(
        { error: 'Invalid tier. Must be 1 or 2.' },
        { status: 400 }
      );
    }

    const { limit, offset } = parsePagination(searchParams, { limit: 50, maxLimit: 200 });

    const validSortColumns = tier === 1 ? TIER1_SORT_COLUMNS : TIER2_SORT_COLUMNS;
    const { sortColumn, sortOrder } = parseSort(
      searchParams,
      validSortColumns,
      'cluster_size',
      'DESC'
    );

    const minSize = parseInt(searchParams.get('min_size') || '1');
    const crossPhylum = searchParams.get('cross_phylum');
    const phylum = searchParams.get('phylum');
    const lddtClass = searchParams.get('lddt_class');
    const darkMatterClass = searchParams.get('dark_matter_class');
    const excludeHelix = searchParams.get('exclude_helix');

    // Overview stats — always fetched for both tiers
    const [tier1Summary, tier2Summary, crossTierCount, tier2CrossPhylum5Plus, tier2LddtCounts, tier1DarkMatterCounts] = await Promise.all([
      query<{
        clusters: string;
        proteins: string;
        multi_member: string;
        cross_phylum: string;
      }>(`
        SELECT
          COUNT(DISTINCT cluster_id) AS clusters,
          COUNT(*) AS proteins,
          COUNT(DISTINCT cluster_id) FILTER (WHERE cluster_size > 1) AS multi_member,
          COUNT(DISTINCT cluster_id) FILTER (WHERE cross_phylum) AS cross_phylum
        FROM archaea.novel_fold_clusters
      `),

      query<{
        clusters: string;
        domains: string;
        proteins: string;
        multi_member: string;
      }>(`
        SELECT
          COUNT(DISTINCT cluster_id) AS clusters,
          COUNT(*) AS domains,
          COUNT(DISTINCT protein_id) AS proteins,
          COUNT(DISTINCT cluster_id) FILTER (WHERE cluster_size > 1) AS multi_member
        FROM archaea.novel_domain_clusters
      `),

      query<{ count: string }>(`
        SELECT COUNT(*) AS count FROM archaea.novel_cross_tier_hits
      `),

      query<{ count: string }>(`
        SELECT COUNT(*) AS count FROM (
          SELECT cluster_id
          FROM archaea.novel_domain_clusters
          GROUP BY cluster_id
          HAVING COUNT(DISTINCT phylum) >= 5
        ) sub
      `),

      // LDDT tier counts for Tier 2 clusters (aggregate per cluster → classify)
      query<{ lddt_class: string; count: string }>(`
        SELECT lddt_class, COUNT(*) AS count FROM (
          SELECT
            ndc.cluster_id,
            CASE
              WHEN AVG(deh.best_lddt) IS NULL OR AVG(deh.best_lddt) < 0.3 THEN 'NOVEL'
              WHEN AVG(deh.best_lddt) < 0.5 THEN 'WEAK_SIMILARITY'
              WHEN AVG(deh.best_lddt) < 0.7 THEN 'MODERATE_SIMILARITY'
              ELSE 'ECOD_ASSIGNABLE'
            END AS lddt_class
          FROM archaea.novel_domain_clusters ndc
          LEFT JOIN archaea.domain_ecod_hits deh ON deh.domain_id = ndc.domain_id
          GROUP BY ndc.cluster_id
        ) sub
        GROUP BY lddt_class
        ORDER BY lddt_class
      `),

      // Dark matter class counts for Tier 1 clusters (T1 → member → PXC → dark_matter_class)
      // For each T1 cluster, pick the "most novel" class among its members' PXC clusters
      // Priority: GENUINE_DARK(1) > TOO_SHORT(2) > LOW_CONFIDENCE_STRUCTURE(3) > SUB_THRESHOLD(4) > RESCUE(5) > CLASSIFIED(6)
      query<{ dark_matter_class: string; count: string }>(`
        WITH t1_dm AS (
          SELECT
            nfc.cluster_id AS t1_cluster_id,
            MIN(CASE dm.dark_matter_class
              WHEN 'GENUINE_DARK' THEN 1
              WHEN 'TOO_SHORT' THEN 2
              WHEN 'LOW_CONFIDENCE_STRUCTURE' THEN 3
              WHEN 'SUB_THRESHOLD' THEN 4
              WHEN 'RESCUE' THEN 5
              WHEN 'CLASSIFIED' THEN 6
              ELSE 1
            END) AS class_rank
          FROM (SELECT DISTINCT cluster_id, protein_id FROM archaea.novel_fold_clusters) nfc
          LEFT JOIN archaea.protein_struct_clusters psc ON psc.protein_id = nfc.protein_id
          LEFT JOIN archaea.v_pxc_dark_matter_class dm ON dm.cluster_id = psc.cluster_id
          GROUP BY nfc.cluster_id
        )
        SELECT
          CASE class_rank
            WHEN 1 THEN 'GENUINE_DARK'
            WHEN 2 THEN 'TOO_SHORT'
            WHEN 3 THEN 'LOW_CONFIDENCE_STRUCTURE'
            WHEN 4 THEN 'SUB_THRESHOLD'
            WHEN 5 THEN 'RESCUE'
            WHEN 6 THEN 'CLASSIFIED'
          END AS dark_matter_class,
          COUNT(*) AS count
        FROM t1_dm
        GROUP BY class_rank
        ORDER BY class_rank
      `),
    ]);

    const lddtTierCounts: Record<string, number> = {};
    for (const r of tier2LddtCounts.rows) {
      lddtTierCounts[r.lddt_class] = parseInt(r.count);
    }

    const darkMatterCounts: Record<string, number> = {};
    for (const r of tier1DarkMatterCounts.rows) {
      darkMatterCounts[r.dark_matter_class] = parseInt(r.count);
    }

    const overview = {
      tier1: {
        clusters: parseInt(tier1Summary.rows[0]?.clusters || '0'),
        proteins: parseInt(tier1Summary.rows[0]?.proteins || '0'),
        multi_member: parseInt(tier1Summary.rows[0]?.multi_member || '0'),
        cross_phylum: parseInt(tier1Summary.rows[0]?.cross_phylum || '0'),
        dark_matter_counts: darkMatterCounts,
      },
      tier2: {
        clusters: parseInt(tier2Summary.rows[0]?.clusters || '0'),
        domains: parseInt(tier2Summary.rows[0]?.domains || '0'),
        proteins: parseInt(tier2Summary.rows[0]?.proteins || '0'),
        multi_member: parseInt(tier2Summary.rows[0]?.multi_member || '0'),
        cross_phylum_5plus: parseInt(tier2CrossPhylum5Plus.rows[0]?.count || '0'),
        lddt_tier_counts: lddtTierCounts,
      },
      cross_tier_hits: parseInt(crossTierCount.rows[0]?.count || '0'),
    };

    // Tier-specific queries
    if (tier === 1) {
      // Tier 1: Use v_novel_fold_cluster_summary + dark matter class from PXC mapping
      // CTE maps each T1 cluster to its most-novel dark_matter_class
      const t1DmCte = `
        t1_dark_matter AS (
          SELECT
            nfc.cluster_id AS t1_cluster_id,
            CASE MIN(CASE dm.dark_matter_class
              WHEN 'GENUINE_DARK' THEN 1
              WHEN 'TOO_SHORT' THEN 2
              WHEN 'LOW_CONFIDENCE_STRUCTURE' THEN 3
              WHEN 'SUB_THRESHOLD' THEN 4
              WHEN 'RESCUE' THEN 5
              WHEN 'CLASSIFIED' THEN 6
              ELSE 1
            END)
              WHEN 1 THEN 'GENUINE_DARK'
              WHEN 2 THEN 'TOO_SHORT'
              WHEN 3 THEN 'LOW_CONFIDENCE_STRUCTURE'
              WHEN 4 THEN 'SUB_THRESHOLD'
              WHEN 5 THEN 'RESCUE'
              WHEN 6 THEN 'CLASSIFIED'
            END AS dark_matter_class
          FROM (SELECT DISTINCT cluster_id, protein_id FROM archaea.novel_fold_clusters) nfc
          LEFT JOIN archaea.protein_struct_clusters psc ON psc.protein_id = nfc.protein_id
          LEFT JOIN archaea.v_pxc_dark_matter_class dm ON dm.cluster_id = psc.cluster_id
          GROUP BY nfc.cluster_id
        ),
        t1_secondary_structure AS (
          SELECT
            nfc.cluster_id AS t1_cluster_id,
            BOOL_AND(sqm.ss_category = 'all_helix') AS all_helix,
            MAX(sqm.helix_fraction) AS max_helix_fraction
          FROM archaea.novel_fold_clusters nfc
          JOIN archaea.structure_quality_metrics sqm ON sqm.protein_id = nfc.db_protein_id
          GROUP BY nfc.cluster_id
        )
      `;

      const conditions: string[] = [];
      const params: (string | number)[] = [];
      let paramIdx = 1;

      if (minSize > 1) {
        conditions.push(`s.cluster_size >= $${paramIdx++}`);
        params.push(minSize);
      }
      if (crossPhylum === 'true') {
        conditions.push(`s.cross_phylum = true`);
      } else if (crossPhylum === 'false') {
        conditions.push(`s.cross_phylum = false`);
      }
      if (phylum) {
        conditions.push(`s.phyla ILIKE $${paramIdx++}`);
        params.push(`%${phylum}%`);
      }
      if (darkMatterClass && darkMatterClass !== 'all') {
        conditions.push(`tdm.dark_matter_class = $${paramIdx++}`);
        params.push(darkMatterClass);
      }
      if (excludeHelix === 'true') {
        conditions.push(`COALESCE(tss.all_helix, false) = false`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const baseSelect = `
        WITH ${t1DmCte}
        SELECT s.*, tdm.dark_matter_class, COALESCE(tss.all_helix, false) AS all_helix, tss.max_helix_fraction
        FROM archaea.v_novel_fold_cluster_summary s
        LEFT JOIN t1_dark_matter tdm ON tdm.t1_cluster_id = s.cluster_id
        LEFT JOIN t1_secondary_structure tss ON tss.t1_cluster_id = s.cluster_id
        ${whereClause}
      `;

      const countSelect = `
        WITH ${t1DmCte}
        SELECT COUNT(*) AS total
        FROM archaea.v_novel_fold_cluster_summary s
        LEFT JOIN t1_dark_matter tdm ON tdm.t1_cluster_id = s.cluster_id
        LEFT JOIN t1_secondary_structure tss ON tss.t1_cluster_id = s.cluster_id
        ${whereClause}
      `;

      // Map sort column to qualified name for the joined query
      const qualifiedSort = sortColumn === 'dark_matter_class' ? 'tdm.dark_matter_class' : `s.${sortColumn}`;

      const [countResult, dataResult] = await Promise.all([
        query<{ total: string }>(countSelect, params),
        query(
          `${baseSelect}
           ORDER BY ${qualifiedSort} ${sortOrder} NULLS LAST
           LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
          [...params, limit, offset]
        ),
      ]);

      return NextResponse.json({
        overview,
        tier: 1,
        items: dataResult.rows.map(c => ({
          ...c,
          avg_plddt: c.avg_plddt ? parseFloat(String(c.avg_plddt)) : null,
          min_plddt: c.min_plddt ? parseFloat(String(c.min_plddt)) : null,
          max_plddt: c.max_plddt ? parseFloat(String(c.max_plddt)) : null,
        })),
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit,
        offset,
      });
    } else {
      // Tier 2: Inline aggregation from novel_domain_clusters with LDDT data
      const conditions: string[] = [];
      const params: (string | number)[] = [];
      let paramIdx = 1;

      if (minSize > 1) {
        conditions.push(`ndc.cluster_size >= $${paramIdx++}`);
        params.push(minSize);
      }
      if (phylum) {
        conditions.push(`ndc.cluster_id IN (
          SELECT cluster_id FROM archaea.novel_domain_clusters
          WHERE phylum ILIKE $${paramIdx++}
        )`);
        params.push(`%${phylum}%`);
      }

      const havingConditions: string[] = [];
      if (crossPhylum === 'true') {
        havingConditions.push(`COUNT(DISTINCT ndc.phylum) > 1`);
      } else if (crossPhylum === 'false') {
        havingConditions.push(`COUNT(DISTINCT ndc.phylum) = 1`);
      }
      if (lddtClass && lddtClass !== 'all') {
        // Filter by LDDT tier using HAVING on the aggregate
        const lddtCondition = lddtClass === 'NOVEL'
          ? `(AVG(deh.best_lddt) IS NULL OR AVG(deh.best_lddt) < 0.3)`
          : lddtClass === 'WEAK_SIMILARITY'
          ? `(AVG(deh.best_lddt) >= 0.3 AND AVG(deh.best_lddt) < 0.5)`
          : lddtClass === 'MODERATE_SIMILARITY'
          ? `(AVG(deh.best_lddt) >= 0.5 AND AVG(deh.best_lddt) < 0.7)`
          : `(AVG(deh.best_lddt) >= 0.7)`;
        havingConditions.push(lddtCondition);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const havingClause = havingConditions.length > 0 ? `HAVING ${havingConditions.join(' AND ')}` : '';

      // Wrap the aggregation in a CTE for count and pagination
      const baseQuery = `
        SELECT
          ndc.cluster_id,
          ndc.cluster_size,
          COUNT(DISTINCT ndc.phylum) > 1 AS cross_phylum,
          MIN(ndc.mean_plddt) AS min_plddt,
          MAX(ndc.mean_plddt) AS max_plddt,
          AVG(ndc.mean_plddt) AS avg_plddt,
          AVG(ndc.dpam_prob) AS avg_dpam_prob,
          COUNT(DISTINCT ndc.phylum) AS phylum_count,
          STRING_AGG(DISTINCT ndc.phylum, ', ' ORDER BY ndc.phylum) AS phyla,
          COUNT(DISTINCT ndc.genome_accession) AS genome_count,
          COUNT(DISTINCT ndc.protein_id) AS protein_count,
          AVG(deh.best_lddt) AS avg_best_lddt,
          MAX(deh.best_lddt) AS max_best_lddt,
          CASE
            WHEN AVG(deh.best_lddt) IS NULL OR AVG(deh.best_lddt) < 0.3 THEN 'NOVEL'
            WHEN AVG(deh.best_lddt) < 0.5 THEN 'WEAK_SIMILARITY'
            WHEN AVG(deh.best_lddt) < 0.7 THEN 'MODERATE_SIMILARITY'
            ELSE 'ECOD_ASSIGNABLE'
          END AS lddt_classification
        FROM archaea.novel_domain_clusters ndc
        LEFT JOIN archaea.domain_ecod_hits deh ON deh.domain_id = ndc.domain_id
        ${whereClause}
        GROUP BY ndc.cluster_id, ndc.cluster_size
        ${havingClause}
      `;

      const [countResult, dataResult] = await Promise.all([
        query<{ total: string }>(
          `SELECT COUNT(*) AS total FROM (${baseQuery}) sub`,
          params
        ),
        query(
          `SELECT * FROM (${baseQuery}) sub
           ORDER BY ${sortColumn} ${sortOrder} NULLS LAST
           LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
          [...params, limit, offset]
        ),
      ]);

      return NextResponse.json({
        overview,
        tier: 2,
        items: dataResult.rows.map(c => ({
          ...c,
          avg_plddt: c.avg_plddt ? parseFloat(String(c.avg_plddt)) : null,
          min_plddt: c.min_plddt ? parseFloat(String(c.min_plddt)) : null,
          max_plddt: c.max_plddt ? parseFloat(String(c.max_plddt)) : null,
          avg_dpam_prob: c.avg_dpam_prob ? parseFloat(String(c.avg_dpam_prob)) : null,
          avg_best_lddt: c.avg_best_lddt ? parseFloat(String(c.avg_best_lddt)) : null,
          max_best_lddt: c.max_best_lddt ? parseFloat(String(c.max_best_lddt)) : null,
        })),
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit,
        offset,
      });
    }
  } catch (error) {
    console.error('Novel folds API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch novel fold clusters',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
