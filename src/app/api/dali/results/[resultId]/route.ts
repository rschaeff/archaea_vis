/**
 * GET /api/dali/results/:resultId
 *
 * Returns full DALI result detail including blocks, rotation, translation,
 * alignments, and metadata for both query and hit structures.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface ResultRow {
  id: string;
  job_id: string;
  hit_cd2: string;
  zscore: number;
  rmsd: number | null;
  nblock: number | null;
  blocks: any;
  rotation: any;
  translation: any;
  alignments: any;
  round: number | null;
  query_protein_id: string;
  db_protein_id: string;
  library_type: string;
  ecod_h_group: string | null;
  ecod_x_group_name: string | null;
  hit_domain_range: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resultId: string }> }
) {
  try {
    const { resultId } = await params;

    if (!resultId) {
      return NextResponse.json({ error: 'Result ID is required' }, { status: 400 });
    }

    // Get full result with job context and ECOD classification
    // novel_fold_clusters maps underscore protein_id → pipe-format db_protein_id
    const result = await query<ResultRow>(`
      SELECT
        r.id,
        r.job_id,
        r.hit_cd2,
        r.zscore,
        r.rmsd,
        r.nblock,
        r.blocks,
        r.rotation,
        r.translation,
        r.alignments,
        r.round,
        djm.protein_id AS query_protein_id,
        nfc.db_protein_id,
        djm.library_type,
        ds.h_group_id AS ecod_h_group,
        c.name AS ecod_x_group_name,
        le.domain_range AS hit_domain_range
      FROM rustdali.results r
      JOIN rustdali.jobs j ON j.id = r.job_id
      JOIN archaea.dali_job_mapping djm ON djm.dali_job_id = j.id
      LEFT JOIN archaea.novel_fold_clusters nfc
        ON nfc.protein_id = djm.protein_id
      LEFT JOIN ecod_commons.domain_summary ds ON ds.domain_id = r.hit_cd2
      LEFT JOIN ecod_rep.cluster c ON c.id = SPLIT_PART(ds.h_group_id, '.', 1)
      LEFT JOIN rustdali.library_entries le ON le.code = r.hit_cd2
      WHERE r.id = $1::uuid
    `, [resultId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Result not found' }, { status: 404 });
    }

    const r = result.rows[0];

    // db_protein_id is the pipe-separated format used by /api/structure/[id]
    const dbProteinId = r.db_protein_id || r.query_protein_id;

    // Extract PDB code from hit identifier for structure serving
    const isEcod = r.hit_cd2.startsWith('e');
    let hitPdbCode: string;
    if (isEcod) {
      // ECOD domain ID format: e{pdb}{chain}{domain} e.g., e4a01A1
      hitPdbCode = r.hit_cd2.substring(1, 5);
    } else {
      // PDB chain format: {pdb}{chain} e.g., 4av3A
      hitPdbCode = r.hit_cd2.substring(0, 4);
    }

    // Get hit chain from identifier
    const hitChain = isEcod
      ? r.hit_cd2.substring(5, 6)
      : r.hit_cd2.substring(4, 5);

    return NextResponse.json({
      id: r.id,
      job_id: r.job_id,
      hit_cd2: r.hit_cd2,
      zscore: parseFloat(String(r.zscore)),
      rmsd: r.rmsd ? parseFloat(String(r.rmsd)) : null,
      nblock: r.nblock,
      blocks: r.blocks,
      rotation: r.rotation,
      translation: r.translation,
      alignments: r.alignments,
      round: r.round,
      query_protein_id: dbProteinId,
      library_type: r.library_type,
      hit_pdb_code: hitPdbCode,
      hit_chain: hitChain,
      hit_domain_range: r.hit_domain_range || null,
      ecod_h_group: r.ecod_h_group,
      ecod_x_group_name: r.ecod_x_group_name,
    });
  } catch (error) {
    console.error('DALI result detail API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch result', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
