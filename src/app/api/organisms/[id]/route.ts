/**
 * GET /api/organisms/:id
 *
 * Returns detailed information for a single target organism (target_class),
 * including protein breakdown by source, domain stats, quality distribution,
 * pipeline coverage gaps, novel fold proteins, and top proteins.
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
      sourceBreakdown,
      judgeBreakdown,
      qualityDist,
      topProteins,
      novelT1Proteins,
      novelT2Domains,
    ] = await Promise.all([
      // Basic class info + pipeline gap stats
      query(`
        SELECT tc.*,
          COUNT(tp.id) AS actual_protein_count,
          COUNT(tp.id) FILTER (WHERE tp.has_structure = true) AS proteins_with_structures,
          COUNT(tp.id) FILTER (WHERE tp.has_structure = false) AS missing_structures,
          COUNT(tp.id) FILTER (WHERE tp.has_pae = true) AS proteins_with_pae,
          (SELECT COUNT(DISTINCT d.protein_id)
           FROM archaea.domains d
           JOIN archaea.target_proteins tp2 ON d.protein_id = tp2.protein_id
           WHERE tp2.target_class_id = tc.id) AS proteins_with_domains,
          (SELECT COUNT(*)
           FROM archaea.domains d
           JOIN archaea.target_proteins tp2 ON d.protein_id = tp2.protein_id
           WHERE tp2.target_class_id = tc.id) AS domain_count
        FROM archaea.target_classes tc
        LEFT JOIN archaea.target_proteins tp ON tp.target_class_id = tc.id
        WHERE tc.id = $1
        GROUP BY tc.id
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

      // Top proteins by quality (no stale curation joins)
      query(`
        SELECT tp.protein_id, tp.source, tp.sequence_length, tp.has_structure,
               sqm.mean_plddt, sqm.quality_score, sqm.af3_quality_category,
               (SELECT COUNT(*) FROM archaea.domains d WHERE d.protein_id = tp.protein_id) AS domain_count
        FROM archaea.target_proteins tp
        LEFT JOIN archaea.structure_quality_metrics sqm ON sqm.protein_id = tp.protein_id
        WHERE tp.target_class_id = $1
        ORDER BY sqm.quality_score DESC NULLS LAST
        LIMIT 20
      `, [classId]),

      // Tier 1 novel fold proteins (join on db_protein_id)
      query(`
        SELECT nfc.db_protein_id AS protein_id, nfc.cluster_id, nfc.cluster_size,
               nfc.mean_plddt, nfc.phylum,
               (SELECT COUNT(DISTINCT n2.phylum) FROM archaea.novel_fold_clusters n2
                WHERE n2.cluster_id = nfc.cluster_id) AS num_phyla
        FROM archaea.novel_fold_clusters nfc
        JOIN archaea.target_proteins tp ON nfc.db_protein_id = tp.protein_id
        WHERE tp.target_class_id = $1
        ORDER BY nfc.cluster_size DESC
      `, [classId]),

      // Tier 2 novel orphan domains
      query(`
        SELECT ndc.protein_id, ndc.domain_num, ndc.domain_range,
               ndc.cluster_id, ndc.cluster_size,
               ndc.mean_plddt, ndc.dpam_prob, ndc.dali_zscore, ndc.phylum
        FROM archaea.novel_domain_clusters ndc
        JOIN archaea.target_proteins tp ON ndc.protein_id = tp.protein_id
        WHERE tp.target_class_id = $1
        ORDER BY ndc.cluster_size DESC
        LIMIT 50
      `, [classId]),
    ]);

    if (classResult.rows.length === 0) {
      return NextResponse.json({ error: 'Organism not found' }, { status: 404 });
    }

    const org = classResult.rows[0];
    const structures = parseInt(org.proteins_with_structures);
    const proteinsWithDomains = parseInt(org.proteins_with_domains);

    return NextResponse.json({
      organism: {
        ...org,
        unclassified: structures - proteinsWithDomains,
      },
      source_breakdown: sourceBreakdown.rows.map(r => ({
        source: r.source, count: parseInt(r.count),
      })),
      judge_breakdown: judgeBreakdown.rows.map(r => ({
        judge: r.judge, count: parseInt(r.count),
      })),
      quality_distribution: qualityDist.rows.map(r => ({
        bucket: r.bucket, count: parseInt(r.count),
      })),
      top_proteins: topProteins.rows,
      novel_t1_proteins: novelT1Proteins.rows,
      novel_t2_domains: novelT2Domains.rows,
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
