/**
 * GET /api/novel-folds
 *
 * Returns paginated list of novel fold clusters from v_novel_fold_cluster_summary.
 * Includes summary stats for the header cards.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePagination, parseSort } from '@/lib/utils';

const VALID_SORT_COLUMNS = [
  'cluster_size',
  'avg_plddt',
  'phylum_count',
  'cluster_id',
  'avg_length',
  'pfam_family_count',
  'genome_count',
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const { limit, offset } = parsePagination(searchParams, { limit: 50, maxLimit: 200 });
    const { sortColumn, sortOrder } = parseSort(
      searchParams,
      VALID_SORT_COLUMNS,
      'cluster_size',
      'DESC'
    );

    const minSize = parseInt(searchParams.get('min_size') || '1');
    const crossPhylum = searchParams.get('cross_phylum');
    const phylum = searchParams.get('phylum');

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

    // Run count, data, and summary in parallel
    const [countResult, dataResult, summaryResult] = await Promise.all([
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

      query<{
        total_clusters: string;
        multi_member: string;
        singletons: string;
        cross_phylum_count: string;
        total_proteins: string;
      }>(`
        SELECT
          COUNT(*) AS total_clusters,
          COUNT(*) FILTER (WHERE cluster_size > 1) AS multi_member,
          COUNT(*) FILTER (WHERE cluster_size = 1) AS singletons,
          COUNT(*) FILTER (WHERE cross_phylum = true) AS cross_phylum_count,
          SUM(cluster_size) AS total_proteins
        FROM archaea.v_novel_fold_cluster_summary
      `),
    ]);

    const total = parseInt(countResult.rows[0]?.total || '0');
    const summary = summaryResult.rows[0];

    return NextResponse.json({
      items: dataResult.rows.map(c => ({
        ...c,
        avg_plddt: c.avg_plddt ? parseFloat(String(c.avg_plddt)) : null,
        min_plddt: c.min_plddt ? parseFloat(String(c.min_plddt)) : null,
        max_plddt: c.max_plddt ? parseFloat(String(c.max_plddt)) : null,
      })),
      total,
      limit,
      offset,
      summary: {
        total_clusters: parseInt(summary.total_clusters),
        multi_member: parseInt(summary.multi_member),
        singletons: parseInt(summary.singletons),
        cross_phylum: parseInt(summary.cross_phylum_count),
        total_proteins: parseInt(summary.total_proteins),
      },
    });
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
