/**
 * GET /api/clusters/:id
 *
 * Returns cluster details and member list.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clusterId = parseInt(id);

    if (isNaN(clusterId)) {
      return NextResponse.json(
        { error: 'Invalid cluster ID' },
        { status: 400 }
      );
    }

    const [clusterResult, membersResult] = await Promise.all([
      query(`
        SELECT * FROM archaea.v_cluster_summary
        WHERE cluster_id = $1
      `, [clusterId]),

      query(`
        SELECT
          scm.protein_id,
          tp.uniprot_acc,
          tp.sequence_length,
          tp.source,
          tp.cif_file,
          scm.is_representative,
          sqm.mean_plddt,
          sqm.quality_score,
          sqm.af3_quality_category,
          cc.novelty_category,
          cc.curation_status,
          tc.phylum
        FROM archaea.structural_cluster_members scm
        JOIN archaea.target_proteins tp ON scm.protein_id = tp.protein_id
        LEFT JOIN archaea.target_classes tc ON tp.target_class_id = tc.id
        LEFT JOIN archaea.structure_quality_metrics sqm ON scm.protein_id = sqm.protein_id
        LEFT JOIN archaea.curation_candidates cc ON scm.protein_id = cc.protein_id
        WHERE scm.cluster_id = $1
        ORDER BY scm.is_representative DESC, sqm.quality_score DESC NULLS LAST
      `, [clusterId]),
    ]);

    if (clusterResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Cluster not found', cluster_id: clusterId },
        { status: 404 }
      );
    }

    return NextResponse.json({
      cluster: clusterResult.rows[0],
      members: membersResult.rows,
    });
  } catch (error) {
    console.error('Cluster detail API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch cluster',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
