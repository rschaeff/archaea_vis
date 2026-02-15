/**
 * GET /api/proteins
 *
 * Paginated protein browser with filters for source, structure status,
 * domain status, and text search.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePagination, parseSort } from '@/lib/utils';

const VALID_SORT_COLUMNS = [
  'protein_id',
  'sequence_length',
  'source',
  'mean_plddt',
  'quality_score',
  'domain_count',
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const { limit, offset } = parsePagination(searchParams);
    const { sortColumn, sortOrder } = parseSort(
      searchParams,
      VALID_SORT_COLUMNS,
      'protein_id',
      'ASC'
    );

    // Filters
    const source = searchParams.get('source');
    const hasStructure = searchParams.get('has_structure');
    const hasDomains = searchParams.get('has_domains');
    const search = searchParams.get('search');
    const phylum = searchParams.get('phylum');
    const minLength = searchParams.get('min_length');
    const maxLength = searchParams.get('max_length');

    // Build query
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (source) {
      conditions.push(`tp.source = $${paramIdx++}`);
      params.push(source);
    }

    if (hasStructure === 'true') {
      conditions.push('tp.has_structure = TRUE');
    } else if (hasStructure === 'false') {
      conditions.push('tp.has_structure = FALSE');
    }

    if (hasDomains === 'true') {
      conditions.push('d.domain_count > 0');
    } else if (hasDomains === 'false') {
      conditions.push('(d.domain_count IS NULL OR d.domain_count = 0)');
    }

    if (search) {
      conditions.push(`(tp.protein_id ILIKE $${paramIdx} OR tp.uniprot_acc ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (phylum) {
      conditions.push(`tc.phylum = $${paramIdx++}`);
      params.push(phylum);
    }

    if (minLength) {
      conditions.push(`tp.sequence_length >= $${paramIdx++}`);
      params.push(parseInt(minLength));
    }

    if (maxLength) {
      conditions.push(`tp.sequence_length <= $${paramIdx++}`);
      params.push(parseInt(maxLength));
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    // Map sort column for the joined query
    const sortMap: Record<string, string> = {
      protein_id: 'tp.protein_id',
      sequence_length: 'tp.sequence_length',
      source: 'tp.source',
      mean_plddt: 'sqm.mean_plddt',
      quality_score: 'sqm.quality_score',
      domain_count: 'd.domain_count',
    };
    const sqlSort = sortMap[sortColumn] || 'tp.protein_id';
    const nullsClause = ['mean_plddt', 'quality_score', 'domain_count'].includes(sortColumn)
      ? ' NULLS LAST'
      : '';

    // Count query
    const countSql = `
      SELECT COUNT(*) AS total
      FROM archaea.target_proteins tp
      LEFT JOIN archaea.target_classes tc ON tp.target_class_id = tc.id
      LEFT JOIN (
        SELECT protein_id, COUNT(*) AS domain_count
        FROM archaea.domains
        GROUP BY protein_id
      ) d ON tp.protein_id = d.protein_id
      ${whereClause}
    `;
    const countResult = await query<{ total: string }>(countSql, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Data query
    const dataSql = `
      SELECT
        tp.protein_id,
        tp.uniprot_acc,
        tp.sequence_length,
        tp.source,
        tp.has_structure,
        tp.cif_file,
        tc.class_name,
        tc.phylum,
        sqm.mean_plddt,
        sqm.quality_score,
        sqm.af3_quality_category,
        sqm.ss_category,
        COALESCE(d.domain_count, 0)::int AS domain_count
      FROM archaea.target_proteins tp
      LEFT JOIN archaea.target_classes tc ON tp.target_class_id = tc.id
      LEFT JOIN archaea.structure_quality_metrics sqm ON tp.protein_id = sqm.protein_id
      LEFT JOIN (
        SELECT protein_id, COUNT(*) AS domain_count
        FROM archaea.domains
        GROUP BY protein_id
      ) d ON tp.protein_id = d.protein_id
      ${whereClause}
      ORDER BY ${sqlSort} ${sortOrder}${nullsClause}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
    params.push(limit, offset);

    const result = await query(dataSql, params);

    return NextResponse.json({
      items: result.rows,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Proteins API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch proteins',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
