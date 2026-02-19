/**
 * GET /api/curation/bridges
 *
 * Reciprocal X-group bridge summary — clusters containing good_domain
 * members from 2+ X-groups that also bridge back.
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { BridgePair } from '@/lib/types';

export async function GET() {
  try {
    // Find cluster-level X-group pairs (expensive ~2-5s)
    const bridgeRes = await query<{
      xg1: string; xg2: string; n_clusters: string; total_domains: string; cluster_ids: string;
    }>(`
      WITH cluster_xgroups AS (
        SELECT dsc.cluster_id,
               SPLIT_PART(d.t_group,'.',1) AS xgroup,
               COUNT(*) AS n_domains
        FROM archaea.domain_struct_clusters dsc
        JOIN archaea.domains d ON d.id = dsc.domain_id
        WHERE d.judge = 'good_domain' AND d.t_group IS NOT NULL
        GROUP BY dsc.cluster_id, SPLIT_PART(d.t_group,'.',1)
      ),
      cluster_pairs AS (
        SELECT a.cluster_id,
               LEAST(a.xgroup, b.xgroup) AS xg1,
               GREATEST(a.xgroup, b.xgroup) AS xg2,
               a.n_domains + b.n_domains AS pair_domains
        FROM cluster_xgroups a
        JOIN cluster_xgroups b ON a.cluster_id = b.cluster_id AND a.xgroup < b.xgroup
      ),
      reciprocal AS (
        SELECT xg1, xg2,
               COUNT(DISTINCT cluster_id) AS n_clusters,
               SUM(pair_domains) AS total_domains,
               ARRAY_AGG(DISTINCT cluster_id) AS cluster_ids
        FROM cluster_pairs
        GROUP BY xg1, xg2
        HAVING COUNT(DISTINCT cluster_id) >= 2
      )
      SELECT xg1, xg2, n_clusters, total_domains, ARRAY_TO_STRING(cluster_ids, ',') AS cluster_ids
      FROM reciprocal
      ORDER BY n_clusters DESC, total_domains DESC
    `);

    // For each bridge, find shared Pfam in parallel
    const bridges: BridgePair[] = await Promise.all(
      bridgeRes.rows.map(async (row) => {
        const clusterIds = row.cluster_ids.split(',');
        const sharedPfamRes = await query<{ pfam_acc: string }>(
          `WITH best_pfam AS (
             SELECT DISTINCT ON (domain_id) domain_id, pfam_acc
             FROM archaea.domain_pfam_hits
             ORDER BY domain_id, domain_ievalue ASC
           )
           SELECT bp.pfam_acc
           FROM archaea.domain_struct_clusters dsc
           JOIN archaea.domains d ON d.id=dsc.domain_id
           JOIN best_pfam bp ON bp.domain_id=d.id
           WHERE dsc.cluster_id = ANY($1) AND d.judge='good_domain' AND d.t_group IS NOT NULL
             AND SPLIT_PART(d.t_group,'.',1) IN ($2,$3)
           GROUP BY bp.pfam_acc HAVING COUNT(DISTINCT SPLIT_PART(d.t_group,'.',1)) >= 2`,
          [clusterIds, row.xg1, row.xg2]
        );

        return {
          xg1: row.xg1,
          xg2: row.xg2,
          n_clusters: parseInt(row.n_clusters),
          total_domains: parseInt(row.total_domains),
          cluster_ids: clusterIds,
          shared_pfam: sharedPfamRes.rows.map(r => r.pfam_acc),
        };
      })
    );

    return NextResponse.json({ bridges });
  } catch (error) {
    console.error('Bridges API error:', error);
    return NextResponse.json(
      { error: 'Failed to compute bridges', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
