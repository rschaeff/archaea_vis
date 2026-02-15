/**
 * GET /api/curation/queue
 *
 * Returns paginated curation queue with filters from v_curation_queue_full.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePagination } from '@/lib/utils';

const VALID_SORT_COLUMNS = [
  'priority_rank',
  'quality_score',
  'mean_plddt',
  'ptm',
  'sequence_length',
  'structural_cluster_size',
  'protein_id',
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const { limit, offset } = parsePagination(searchParams, { limit: 50, maxLimit: 200 });

    const novelty = searchParams.get('novelty') || 'all';
    const priority = searchParams.get('priority') || 'all';
    const status = searchParams.get('status') || 'pending';
    const hasStructure = searchParams.get('has_structure');
    const taxonomy = searchParams.get('taxonomy');
    const sortBy = searchParams.get('sort') || 'priority_rank';
    const sortOrder = searchParams.get('order')?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const validatedSort = VALID_SORT_COLUMNS.includes(sortBy) ? sortBy : 'priority_rank';

    let sql = `
      SELECT * FROM archaea.v_curation_queue_full
      WHERE 1=1
    `;
    const params: (string | number | boolean)[] = [];
    let paramIdx = 1;

    if (novelty !== 'all') {
      sql += ` AND novelty_category = $${paramIdx++}`;
      params.push(novelty);
    }

    if (priority !== 'all') {
      sql += ` AND priority_category = $${paramIdx++}`;
      params.push(priority);
    }

    if (status !== 'all') {
      sql += ` AND curation_status = $${paramIdx++}`;
      params.push(status);
    }

    if (hasStructure === 'true') {
      sql += ` AND has_structure = TRUE`;
    } else if (hasStructure === 'false') {
      sql += ` AND has_structure = FALSE`;
    }

    if (taxonomy) {
      sql += ` AND taxonomy_class = $${paramIdx++}`;
      params.push(taxonomy);
    }

    // Count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) AS total');
    const countResult = await query<{ total: string }>(countSql, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Sort
    if (validatedSort === 'priority_rank') {
      sql += ` ORDER BY priority_category ${sortOrder}, priority_rank ${sortOrder} NULLS LAST`;
    } else if (['quality_score', 'mean_plddt', 'ptm'].includes(validatedSort)) {
      sql += ` ORDER BY ${validatedSort} ${sortOrder} NULLS LAST, priority_category ASC, priority_rank ASC NULLS LAST`;
    } else {
      sql += ` ORDER BY ${validatedSort} ${sortOrder}`;
    }

    sql += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    return NextResponse.json({
      items: result.rows,
      total,
      limit,
      offset,
      filters: {
        novelty: novelty !== 'all' ? novelty : undefined,
        priority: priority !== 'all' ? priority : undefined,
        status: status !== 'all' ? status : undefined,
        has_structure: hasStructure === 'true' ? true : hasStructure === 'false' ? false : undefined,
      },
    });
  } catch (error) {
    console.error('Curation queue API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch curation queue',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
