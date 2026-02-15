/**
 * GET /api/novel-folds/:id
 *
 * Returns full detail for a novel fold cluster: summary, members,
 * foldseek edges, Pfam annotations, and phylum distribution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clusterId } = await params;

    if (!clusterId || !/^NC_\d+$/.test(clusterId)) {
      return NextResponse.json(
        { error: 'Invalid cluster ID format. Expected NC_XXX.' },
        { status: 400 }
      );
    }

    // Fetch cluster summary and members in parallel
    const [clusterResult, membersResult, edgesResult, pfamResult, phylumResult, pfamSummaryResult] =
      await Promise.all([
        // Cluster summary
        query(`
          SELECT * FROM archaea.v_novel_fold_cluster_summary
          WHERE cluster_id = $1
        `, [clusterId]),

        // Members
        query(`
          SELECT
            c.protein_id,
            c.db_protein_id,
            c.mean_plddt,
            c.seq_length,
            c.phylum,
            c.major_group,
            c.organism,
            c.genome_accession,
            c.quality_tier,
            c.batch_num
          FROM archaea.novel_fold_clusters c
          WHERE c.cluster_id = $1
          ORDER BY c.mean_plddt DESC
        `, [clusterId]),

        // Foldseek edges within cluster
        query(`
          SELECT
            e.query_protein_id AS query,
            e.target_protein_id AS target,
            e.fident,
            e.alnlen,
            e.evalue,
            e.bits,
            e.lddt,
            e.prob
          FROM archaea.novel_fold_edges e
          WHERE e.query_protein_id IN (
            SELECT protein_id FROM archaea.novel_fold_clusters WHERE cluster_id = $1
          )
          AND e.target_protein_id IN (
            SELECT protein_id FROM archaea.novel_fold_clusters WHERE cluster_id = $1
          )
          ORDER BY e.evalue ASC
        `, [clusterId]),

        // Pfam hits for all members
        query(`
          SELECT
            p.db_protein_id,
            p.pfam_name,
            p.pfam_acc,
            p.pfam_description,
            p.evalue,
            p.score,
            p.ali_from,
            p.ali_to
          FROM archaea.novel_fold_pfam p
          WHERE p.db_protein_id IN (
            SELECT db_protein_id FROM archaea.novel_fold_clusters WHERE cluster_id = $1
          )
          ORDER BY p.db_protein_id, p.ali_from
        `, [clusterId]),

        // Phylum distribution
        query<{ phylum: string; count: string }>(`
          SELECT phylum, COUNT(*) AS count
          FROM archaea.novel_fold_clusters
          WHERE cluster_id = $1
          GROUP BY phylum
          ORDER BY count DESC
        `, [clusterId]),

        // Pfam family summary
        query(`
          SELECT DISTINCT p.pfam_name, p.pfam_acc, p.pfam_description,
            COUNT(*) AS hit_count,
            (p.pfam_name LIKE 'DUF%' OR p.pfam_name LIKE 'UPF%') AS is_duf
          FROM archaea.novel_fold_pfam p
          WHERE p.db_protein_id IN (
            SELECT db_protein_id FROM archaea.novel_fold_clusters WHERE cluster_id = $1
          )
          GROUP BY p.pfam_name, p.pfam_acc, p.pfam_description
          ORDER BY hit_count DESC
        `, [clusterId]),
      ]);

    if (clusterResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Cluster not found' },
        { status: 404 }
      );
    }

    const cluster = clusterResult.rows[0];

    // Group Pfam hits by protein
    const pfamByProtein: Record<string, typeof pfamResult.rows> = {};
    for (const hit of pfamResult.rows) {
      const pid = hit.db_protein_id;
      if (!pfamByProtein[pid]) pfamByProtein[pid] = [];
      pfamByProtein[pid].push(hit);
    }

    return NextResponse.json({
      cluster: {
        ...cluster,
        avg_plddt: cluster.avg_plddt ? parseFloat(String(cluster.avg_plddt)) : null,
        min_plddt: cluster.min_plddt ? parseFloat(String(cluster.min_plddt)) : null,
        max_plddt: cluster.max_plddt ? parseFloat(String(cluster.max_plddt)) : null,
      },
      members: membersResult.rows.map(m => ({
        ...m,
        mean_plddt: m.mean_plddt ? parseFloat(String(m.mean_plddt)) : null,
        pfam_hits: pfamByProtein[m.db_protein_id] || [],
      })),
      edges: edgesResult.rows.map(e => ({
        ...e,
        fident: e.fident ? parseFloat(String(e.fident)) : null,
        evalue: e.evalue ? parseFloat(String(e.evalue)) : null,
        lddt: e.lddt ? parseFloat(String(e.lddt)) : null,
        prob: e.prob ? parseFloat(String(e.prob)) : null,
      })),
      phylum_distribution: phylumResult.rows.map(r => ({
        phylum: r.phylum,
        count: parseInt(r.count),
      })),
      pfam_summary: pfamSummaryResult.rows.map(r => ({
        pfam_name: r.pfam_name,
        pfam_acc: r.pfam_acc,
        description: r.pfam_description,
        hit_count: parseInt(r.hit_count),
        is_duf: r.is_duf,
      })),
    });
  } catch (error) {
    console.error('Novel fold detail API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch cluster details',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
