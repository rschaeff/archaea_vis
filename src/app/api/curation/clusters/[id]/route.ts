/**
 * GET /api/curation/clusters/[id]
 *
 * DXC cluster detail: metadata, X-group composition, members, Pfam evidence,
 * taxonomy, LDDT distribution, and X-group suggestions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { DxcPfamEvidence } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!/^DXC_\d+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid cluster ID format' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const memberLimit = Math.min(Math.max(1, parseInt(searchParams.get('member_limit') || '50')), 500);
    const memberOffset = Math.max(0, parseInt(searchParams.get('member_offset') || '0'));

    const [metaRes, xgroupRes, membersRes, memberCountRes, pfamRawRes, taxonRes, lddtDistRes, xgroupSugRes] = await Promise.all([
      // A. Cluster metadata
      query(
        "SELECT * FROM archaea.struct_cluster_diversity WHERE level='domain' AND struct_cluster_id=$1",
        [id]
      ),
      // B. X-group composition (all annotated domains, best Pfam hit per domain)
      query(
        `WITH best_pfam AS (
           SELECT DISTINCT ON (domain_id) domain_id, pfam_acc
           FROM archaea.domain_pfam_hits
           ORDER BY domain_id, domain_ievalue ASC
         )
         SELECT SPLIT_PART(d.t_group,'.',1) AS xgroup,
                COUNT(DISTINCT d.t_group) AS n_tgroups,
                COUNT(DISTINCT d.id) AS n_domains,
                COUNT(DISTINCT d.id) FILTER (WHERE d.judge='good_domain') AS n_good,
                COUNT(DISTINCT d.id) FILTER (WHERE d.judge='low_confidence') AS n_low_conf,
                COUNT(DISTINCT bp.pfam_acc) AS n_pfam
         FROM archaea.domain_struct_clusters dsc
         JOIN archaea.domains d ON d.id = dsc.domain_id
         LEFT JOIN best_pfam bp ON bp.domain_id = d.id
         WHERE dsc.cluster_id=$1 AND d.t_group IS NOT NULL
         GROUP BY SPLIT_PART(d.t_group,'.',1) ORDER BY COUNT(DISTINCT d.id) DESC`,
        [id]
      ),
      // C. Members (paginated, best Pfam hit per domain, with LDDT data)
      query(
        `WITH best_pfam AS (
           SELECT DISTINCT ON (domain_id) domain_id, pfam_acc
           FROM archaea.domain_pfam_hits
           ORDER BY domain_id, domain_ievalue ASC
         )
         SELECT d.id AS domain_id, d.protein_id, d.domain_num, d.range, d.judge, d.t_group, d.dpam_prob,
                bp.pfam_acc AS pfam_hits, tc.class_name, tc.phylum,
                deh.best_lddt, deh.ecod_xgroup AS lddt_xgroup, deh.lddt_class
         FROM archaea.domain_struct_clusters dsc
         JOIN archaea.domains d ON d.id = dsc.domain_id
         LEFT JOIN archaea.target_proteins tp ON tp.protein_id = d.protein_id
         LEFT JOIN archaea.target_classes tc ON tc.id = tp.target_class_id
         LEFT JOIN best_pfam bp ON bp.domain_id = d.id
         LEFT JOIN archaea.domain_ecod_hits deh ON deh.domain_id = d.id
         WHERE dsc.cluster_id=$1
         ORDER BY d.judge DESC, d.dpam_prob DESC NULLS LAST
         LIMIT $2 OFFSET $3`,
        [id, memberLimit, memberOffset]
      ),
      // C. Member count
      query<{ count: string }>(
        'SELECT COUNT(*) AS count FROM archaea.domain_struct_clusters WHERE cluster_id=$1',
        [id]
      ),
      // D. Pfam evidence (best hit per domain, pivoted by xgroup)
      query(
        `WITH best_pfam AS (
           SELECT DISTINCT ON (domain_id) domain_id, pfam_acc
           FROM archaea.domain_pfam_hits
           ORDER BY domain_id, domain_ievalue ASC
         )
         SELECT bp.pfam_acc, NULL AS pfam_name, COUNT(DISTINCT d.id) AS total_domains,
                SPLIT_PART(d.t_group,'.',1) AS xgroup
         FROM archaea.domain_struct_clusters dsc
         JOIN archaea.domains d ON d.id=dsc.domain_id
         JOIN best_pfam bp ON bp.domain_id=d.id
         WHERE dsc.cluster_id=$1 AND d.t_group IS NOT NULL
         GROUP BY bp.pfam_acc, SPLIT_PART(d.t_group,'.',1)
         ORDER BY bp.pfam_acc`,
        [id]
      ),
      // E. Taxonomy
      query(
        `SELECT tc.class_name, tc.phylum, COUNT(*) AS count
         FROM archaea.domain_struct_clusters dsc
         JOIN archaea.domains d ON d.id=dsc.domain_id
         JOIN archaea.target_proteins tp ON tp.protein_id=d.protein_id
         JOIN archaea.target_classes tc ON tc.id=tp.target_class_id
         WHERE dsc.cluster_id=$1 GROUP BY tc.class_name, tc.phylum ORDER BY count DESC`,
        [id]
      ),
      // F. LDDT distribution
      query(
        `SELECT
           CASE
             WHEN deh.best_lddt IS NULL THEN 'no_hit'
             WHEN deh.best_lddt < 0.3 THEN '0.0-0.3'
             WHEN deh.best_lddt < 0.5 THEN '0.3-0.5'
             WHEN deh.best_lddt < 0.7 THEN '0.5-0.7'
             ELSE '0.7+'
           END AS bucket,
           COUNT(*) AS count
         FROM archaea.domain_struct_clusters dsc
         LEFT JOIN archaea.domain_ecod_hits deh ON deh.domain_id = dsc.domain_id
         WHERE dsc.cluster_id = $1
         GROUP BY bucket`,
        [id]
      ),
      // G. X-group suggestions (unclassified members only)
      query(
        `SELECT deh.ecod_xgroup AS xgroup,
                COUNT(*) AS n_hits,
                AVG(deh.best_lddt) AS avg_lddt,
                MAX(deh.best_lddt) AS max_lddt
         FROM archaea.domain_struct_clusters dsc
         JOIN archaea.domains d ON d.id = dsc.domain_id
         JOIN archaea.domain_ecod_hits deh ON deh.domain_id = d.id
         WHERE dsc.cluster_id = $1
           AND (d.judge != 'good_domain' OR d.t_group IS NULL)
           AND deh.ecod_xgroup IS NOT NULL
         GROUP BY deh.ecod_xgroup
         ORDER BY n_hits DESC, avg_lddt DESC`,
        [id]
      ),
    ]);

    if (metaRes.rows.length === 0) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
    }

    // Parse metadata numerics
    const meta = metaRes.rows[0];
    const cluster = {
      struct_cluster_id: meta.struct_cluster_id,
      cluster_size: parseInt(meta.cluster_size),
      n_seq_clusters: parseInt(meta.n_seq_clusters),
      n_classes: parseInt(meta.n_classes),
      taxonomic_entropy: meta.taxonomic_entropy != null ? parseFloat(meta.taxonomic_entropy) : null,
      n_xgroups: parseInt(meta.n_xgroups),
      n_tgroups: parseInt(meta.n_tgroups),
      dominant_tgroup: meta.dominant_tgroup,
      dominant_tgroup_frac: meta.dominant_tgroup_frac != null ? parseFloat(meta.dominant_tgroup_frac) : null,
      n_good_domain: parseInt(meta.n_good_domain),
      n_pfam_families: parseInt(meta.n_pfam_families),
      deep_homology_score: meta.deep_homology_score != null ? parseFloat(meta.deep_homology_score) : null,
      seq_entropy: meta.seq_entropy != null ? parseFloat(meta.seq_entropy) : null,
      n_seq_singletons: parseInt(meta.n_seq_singletons || '0'),
      n_unannotated: parseInt(meta.n_unannotated || '0'),
      n_low_confidence: parseInt(meta.n_low_confidence || '0'),
      n_with_pfam: parseInt(meta.n_with_pfam || '0'),
      annotation_transfer_potential: meta.annotation_transfer_potential != null ? parseFloat(meta.annotation_transfer_potential) : null,
      avg_best_lddt: meta.avg_best_lddt != null ? parseFloat(meta.avg_best_lddt) : null,
      lddt_classification: meta.lddt_classification || null,
    };

    // Pivot Pfam evidence rows into DxcPfamEvidence[]
    const pfamMap = new Map<string, DxcPfamEvidence>();
    for (const row of pfamRawRes.rows) {
      const existing = pfamMap.get(row.pfam_acc);
      if (existing) {
        existing.xgroup_counts[row.xgroup] = parseInt(row.total_domains);
        existing.total_domains += parseInt(row.total_domains);
      } else {
        pfamMap.set(row.pfam_acc, {
          pfam_acc: row.pfam_acc,
          pfam_name: row.pfam_name,
          total_domains: parseInt(row.total_domains),
          xgroup_counts: { [row.xgroup]: parseInt(row.total_domains) },
        });
      }
    }

    return NextResponse.json({
      cluster,
      xgroup_composition: xgroupRes.rows.map(r => ({
        xgroup: r.xgroup,
        n_tgroups: parseInt(r.n_tgroups),
        n_domains: parseInt(r.n_domains),
        n_good: parseInt(r.n_good),
        n_low_conf: parseInt(r.n_low_conf),
        n_pfam: parseInt(r.n_pfam),
      })),
      members: membersRes.rows.map(r => ({
        ...r,
        domain_id: parseInt(r.domain_id),
        dpam_prob: r.dpam_prob != null ? parseFloat(r.dpam_prob) : null,
        best_lddt: r.best_lddt != null ? parseFloat(r.best_lddt) : null,
        lddt_xgroup: r.lddt_xgroup || null,
        lddt_class: r.lddt_class || null,
      })),
      members_total: parseInt(memberCountRes.rows[0]?.count || '0'),
      pfam_evidence: Array.from(pfamMap.values()),
      taxonomy: taxonRes.rows.map(r => ({
        class_name: r.class_name,
        phylum: r.phylum,
        count: parseInt(r.count),
      })),
      lddt_distribution: lddtDistRes.rows.map(r => ({
        bucket: r.bucket,
        count: parseInt(r.count),
      })),
      xgroup_suggestions: xgroupSugRes.rows.map(r => ({
        xgroup: r.xgroup,
        n_hits: parseInt(r.n_hits),
        avg_lddt: parseFloat(r.avg_lddt),
        max_lddt: parseFloat(r.max_lddt),
      })),
    });
  } catch (error) {
    console.error('DXC cluster detail API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cluster detail', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
