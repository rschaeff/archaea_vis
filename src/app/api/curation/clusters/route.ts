/**
 * GET /api/curation/clusters
 *
 * Paginated DXC cluster list with overview stats from struct_cluster_diversity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePagination, parseSort } from '@/lib/utils';

const SORT_WHITELIST = [
  'deep_homology_score',
  'cluster_size',
  'n_xgroups',
  'n_seq_clusters',
  'taxonomic_entropy',
  'n_good_domain',
  'n_pfam_families',
  'n_tgroups',
  'n_classes',
  'avg_best_lddt',
  'lddt_classification',
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const { limit, offset } = parsePagination(searchParams, { limit: 50, maxLimit: 500 });
    const { sortColumn, sortOrder } = parseSort(searchParams, SORT_WHITELIST, 'deep_homology_score', 'DESC');

    const minXgroups = parseInt(searchParams.get('min_xgroups') || '0');
    const minSize = parseInt(searchParams.get('min_size') || '5');
    const minDeepHomology = parseFloat(searchParams.get('min_deep_homology') || '0');
    const minGoodDomain = parseInt(searchParams.get('min_good_domain') || '0');
    const hasPfam = searchParams.get('has_pfam') || 'all';
    const lddtClass = searchParams.get('lddt_class') || 'all';

    // Build WHERE clause
    const conditions: string[] = ["level = 'domain'"];
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (minXgroups > 0) {
      conditions.push(`n_xgroups >= $${paramIdx++}`);
      params.push(minXgroups);
    }
    if (minSize > 0) {
      conditions.push(`cluster_size >= $${paramIdx++}`);
      params.push(minSize);
    }
    if (minDeepHomology > 0) {
      conditions.push(`deep_homology_score >= $${paramIdx++}`);
      params.push(minDeepHomology);
    }
    if (minGoodDomain > 0) {
      conditions.push(`n_good_domain >= $${paramIdx++}`);
      params.push(minGoodDomain);
    }
    if (hasPfam === 'yes') {
      conditions.push('n_pfam_families > 0');
    } else if (hasPfam === 'no') {
      conditions.push('n_pfam_families = 0');
    }
    if (lddtClass !== 'all') {
      conditions.push(`lddt_classification = $${paramIdx++}`);
      params.push(lddtClass);
    }

    const whereClause = conditions.join(' AND ');

    // Run overview stats + filtered count + filtered data in parallel
    const [overviewRes, countRes, dataRes] = await Promise.all([
      // Overview stats (always unfiltered except level='domain')
      Promise.all([
        query<{ total: string }>(
          "SELECT COUNT(*) AS total FROM archaea.struct_cluster_diversity WHERE level = 'domain'"
        ),
        query<{ count: string }>(
          "SELECT COUNT(*) AS count FROM archaea.struct_cluster_diversity WHERE level = 'domain' AND n_xgroups >= 2 AND n_good_domain >= 2"
        ),
        query<{ avg: string | null }>(
          "SELECT AVG(deep_homology_score) AS avg FROM archaea.struct_cluster_diversity WHERE level = 'domain' AND n_xgroups >= 2"
        ),
        // LDDT tier counts
        query<{ lddt_classification: string | null; count: string }>(
          "SELECT lddt_classification, COUNT(*) AS count FROM archaea.struct_cluster_diversity WHERE level = 'domain' AND lddt_classification IS NOT NULL GROUP BY lddt_classification"
        ),
      ]),
      // Filtered count
      query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM archaea.struct_cluster_diversity WHERE ${whereClause}`,
        params
      ),
      // Filtered data
      query(
        `SELECT struct_cluster_id, cluster_size, n_seq_clusters, n_classes,
                taxonomic_entropy, n_xgroups, n_tgroups, dominant_tgroup,
                dominant_tgroup_frac, n_good_domain, n_pfam_families, deep_homology_score,
                avg_best_lddt, lddt_classification
         FROM archaea.struct_cluster_diversity
         WHERE ${whereClause}
         ORDER BY ${sortColumn} ${sortOrder} NULLS LAST
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset]
      ),
    ]);

    const [totalRes, multiXgRes, avgDhRes, lddtTierRes] = overviewRes;

    // Build LDDT tier counts object
    const lddt_tier_counts: Record<string, number> = {};
    for (const row of lddtTierRes.rows) {
      if (row.lddt_classification) {
        lddt_tier_counts[row.lddt_classification] = parseInt(row.count);
      }
    }

    return NextResponse.json({
      overview: {
        total_clusters: parseInt(totalRes.rows[0]?.total || '0'),
        multi_xgroup_good_domain: parseInt(multiXgRes.rows[0]?.count || '0'),
        reciprocal_bridges: 108,
        mean_deep_homology: avgDhRes.rows[0]?.avg ? parseFloat(avgDhRes.rows[0].avg) : null,
        lddt_tier_counts,
      },
      items: dataRes.rows.map(row => ({
        ...row,
        cluster_size: parseInt(row.cluster_size),
        n_seq_clusters: parseInt(row.n_seq_clusters),
        n_classes: parseInt(row.n_classes),
        taxonomic_entropy: row.taxonomic_entropy != null ? parseFloat(row.taxonomic_entropy) : null,
        n_xgroups: parseInt(row.n_xgroups),
        n_tgroups: parseInt(row.n_tgroups),
        dominant_tgroup_frac: row.dominant_tgroup_frac != null ? parseFloat(row.dominant_tgroup_frac) : null,
        n_good_domain: parseInt(row.n_good_domain),
        n_pfam_families: parseInt(row.n_pfam_families),
        deep_homology_score: row.deep_homology_score != null ? parseFloat(row.deep_homology_score) : null,
        avg_best_lddt: row.avg_best_lddt != null ? parseFloat(row.avg_best_lddt) : null,
        lddt_classification: row.lddt_classification || null,
      })),
      total: parseInt(countRes.rows[0]?.total || '0'),
      limit,
      offset,
    });
  } catch (error) {
    console.error('DXC clusters API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DXC clusters', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
