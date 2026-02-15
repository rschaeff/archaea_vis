/**
 * GET /api/organisms/:id
 *
 * Returns detailed information for a single target organism (target_class),
 * including protein breakdown by novelty/source, domain stats, quality
 * distribution, and top proteins.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const classId = parseInt(id);
    if (isNaN(classId)) {
      return NextResponse.json({ error: 'Invalid organism ID' }, { status: 400 });
    }

    const [
      classResult,
      noveltyBreakdown,
      sourceBreakdown,
      judgeBreakdown,
      qualityDist,
      curationBreakdown,
      topProteins,
      novelFoldProteins,
    ] = await Promise.all([
      // Basic class info
      query(`
        SELECT tc.*,
          COUNT(tp.id) AS actual_protein_count,
          COUNT(tp.id) FILTER (WHERE tp.has_structure = true) AS proteins_with_structures,
          COUNT(tp.id) FILTER (WHERE tp.has_pae = true) AS proteins_with_pae
        FROM archaea.target_classes tc
        LEFT JOIN archaea.target_proteins tp ON tp.target_class_id = tc.id
        WHERE tc.id = $1
        GROUP BY tc.id
      `, [classId]),

      // Novelty breakdown
      query<{ novelty_category: string; count: string }>(`
        SELECT
          COALESCE(cc.novelty_category, 'uncategorized') AS novelty_category,
          COUNT(*) AS count
        FROM archaea.target_proteins tp
        LEFT JOIN archaea.curation_candidates cc ON cc.protein_id = tp.protein_id
        WHERE tp.target_class_id = $1
        GROUP BY novelty_category
        ORDER BY count DESC
      `, [classId]),

      // Source breakdown
      query<{ source: string; count: string }>(`
        SELECT source, COUNT(*) AS count
        FROM archaea.target_proteins
        WHERE target_class_id = $1
        GROUP BY source ORDER BY count DESC
      `, [classId]),

      // Domain judge breakdown
      query<{ judge: string; count: string }>(`
        SELECT d.judge, COUNT(*) AS count
        FROM archaea.domains d
        JOIN archaea.target_proteins tp ON d.protein_id = tp.protein_id
        WHERE tp.target_class_id = $1
        GROUP BY d.judge ORDER BY count DESC
      `, [classId]),

      // Quality distribution buckets
      query<{ bucket: string; count: string }>(`
        SELECT
          CASE
            WHEN sqm.mean_plddt >= 90 THEN 'very_high'
            WHEN sqm.mean_plddt >= 70 THEN 'confident'
            WHEN sqm.mean_plddt >= 50 THEN 'low'
            ELSE 'very_low'
          END AS bucket,
          COUNT(*) AS count
        FROM archaea.structure_quality_metrics sqm
        JOIN archaea.target_proteins tp ON sqm.protein_id = tp.protein_id
        WHERE tp.target_class_id = $1
        GROUP BY bucket ORDER BY bucket
      `, [classId]),

      // Curation status breakdown
      query<{ curation_status: string; count: string }>(`
        SELECT curation_status, COUNT(*) AS count
        FROM archaea.curation_candidates cc
        JOIN archaea.target_proteins tp ON cc.protein_id = tp.protein_id
        WHERE tp.target_class_id = $1
        GROUP BY curation_status ORDER BY count DESC
      `, [classId]),

      // Top proteins by quality
      query(`
        SELECT tp.protein_id, tp.source, tp.sequence_length, tp.has_structure,
               sqm.mean_plddt, sqm.quality_score, sqm.af3_quality_category,
               cc.novelty_category, cc.curation_status, cc.is_novel_fold
        FROM archaea.target_proteins tp
        LEFT JOIN archaea.structure_quality_metrics sqm ON sqm.protein_id = tp.protein_id
        LEFT JOIN archaea.curation_candidates cc ON cc.protein_id = tp.protein_id
        WHERE tp.target_class_id = $1
        ORDER BY sqm.quality_score DESC NULLS LAST
        LIMIT 20
      `, [classId]),

      // Novel fold proteins from this organism
      query(`
        SELECT nfc.protein_id, nfc.cluster_id, nfc.cluster_size,
               nfc.mean_plddt, nfc.phylum,
               (SELECT COUNT(DISTINCT n2.phylum) FROM archaea.novel_fold_clusters n2 WHERE n2.cluster_id = nfc.cluster_id) AS num_phyla
        FROM archaea.novel_fold_clusters nfc
        JOIN archaea.target_proteins tp ON nfc.protein_id = tp.protein_id
        WHERE tp.target_class_id = $1
        ORDER BY nfc.cluster_size DESC
      `, [classId]),
    ]);

    if (classResult.rows.length === 0) {
      return NextResponse.json({ error: 'Organism not found' }, { status: 404 });
    }

    return NextResponse.json({
      organism: classResult.rows[0],
      novelty_breakdown: noveltyBreakdown.rows.map(r => ({
        category: r.novelty_category, count: parseInt(r.count),
      })),
      source_breakdown: sourceBreakdown.rows.map(r => ({
        source: r.source, count: parseInt(r.count),
      })),
      judge_breakdown: judgeBreakdown.rows.map(r => ({
        judge: r.judge, count: parseInt(r.count),
      })),
      quality_distribution: qualityDist.rows.map(r => ({
        bucket: r.bucket, count: parseInt(r.count),
      })),
      curation_breakdown: curationBreakdown.rows.map(r => ({
        status: r.curation_status, count: parseInt(r.count),
      })),
      top_proteins: topProteins.rows,
      novel_fold_proteins: novelFoldProteins.rows,
    });
  } catch (error) {
    console.error('Organism detail API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch organism detail',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
