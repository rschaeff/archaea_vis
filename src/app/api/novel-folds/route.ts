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
];

const TIER2_SORT_COLUMNS = [
  'cluster_size',
  'avg_plddt',
  'avg_dpam_prob',
  'phylum_count',
  'cluster_id',
  'genome_count',
  'protein_count',
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

    // Overview stats — always fetched for both tiers
    const [tier1Summary, tier2Summary, crossTierCount, tier2CrossPhylum5Plus] = await Promise.all([
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
    ]);

    const overview = {
      tier1: {
        clusters: parseInt(tier1Summary.rows[0]?.clusters || '0'),
        proteins: parseInt(tier1Summary.rows[0]?.proteins || '0'),
        multi_member: parseInt(tier1Summary.rows[0]?.multi_member || '0'),
        cross_phylum: parseInt(tier1Summary.rows[0]?.cross_phylum || '0'),
      },
      tier2: {
        clusters: parseInt(tier2Summary.rows[0]?.clusters || '0'),
        domains: parseInt(tier2Summary.rows[0]?.domains || '0'),
        proteins: parseInt(tier2Summary.rows[0]?.proteins || '0'),
        multi_member: parseInt(tier2Summary.rows[0]?.multi_member || '0'),
        cross_phylum_5plus: parseInt(tier2CrossPhylum5Plus.rows[0]?.count || '0'),
      },
      cross_tier_hits: parseInt(crossTierCount.rows[0]?.count || '0'),
    };

    // Tier-specific queries
    if (tier === 1) {
      // Tier 1: Use v_novel_fold_cluster_summary
      const conditions: string[] = [];
      const params: (string | number)[] = [];
      let paramIdx = 1;

      if (minSize > 1) {
        conditions.push(`cluster_size >= $${paramIdx++}`);
        params.push(minSize);
      }
      if (crossPhylum === 'true') {
        conditions.push(`cross_phylum = true`);
      } else if (crossPhylum === 'false') {
        conditions.push(`cross_phylum = false`);
      }
      if (phylum) {
        conditions.push(`phyla ILIKE $${paramIdx++}`);
        params.push(`%${phylum}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const [countResult, dataResult] = await Promise.all([
        query<{ total: string }>(
          `SELECT COUNT(*) AS total FROM archaea.v_novel_fold_cluster_summary ${whereClause}`,
          params
        ),
        query(
          `SELECT *
           FROM archaea.v_novel_fold_cluster_summary
           ${whereClause}
           ORDER BY ${sortColumn} ${sortOrder} NULLS LAST
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
      // Tier 2: Inline aggregation from novel_domain_clusters
      const conditions: string[] = [];
      const params: (string | number)[] = [];
      let paramIdx = 1;

      if (minSize > 1) {
        conditions.push(`ndc.cluster_size >= $${paramIdx++}`);
        params.push(minSize);
      }
      if (phylum) {
        // Filter on the HAVING clause won't work directly, so use a subquery approach
        // We filter clusters that have the specified phylum among their members
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
          COUNT(DISTINCT ndc.protein_id) AS protein_count
        FROM archaea.novel_domain_clusters ndc
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
