/**
 * GET /api/clusters
 *
 * Returns paginated list of structural clusters from v_cluster_summary.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePagination, parseSort } from '@/lib/utils';

const VALID_SORT_COLUMNS = [
  'cluster_size',
  'member_count',
  'avg_plddt',
  'avg_quality_score',
  'dark_count',
  'pending_count',
  'cluster_rep_id',
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
    const hasDark = searchParams.get('has_dark');
    const hasPending = searchParams.get('has_pending');
    const search = searchParams.get('search');

    let sql = `
      SELECT * FROM archaea.v_cluster_summary
      WHERE cluster_size >= $1
    `;
    const params: (number | string)[] = [minSize];
    let paramIdx = 2;

    if (hasDark === 'true') {
      sql += ` AND dark_count > 0`;
    }

    if (hasPending === 'true') {
      sql += ` AND pending_count > 0`;
    }

    if (search) {
      sql += ` AND cluster_rep_id ILIKE $${paramIdx++}`;
      params.push(`%${search}%`);
    }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) AS total');
    const countResult = await query<{ total: string }>(countSql, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    sql += ` ORDER BY ${sortColumn} ${sortOrder} NULLS LAST`;
    sql += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    return NextResponse.json({
      items: result.rows,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Clusters API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch clusters',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
