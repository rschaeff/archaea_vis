/**
 * GET /api/proteins/:id
 *
 * Returns full protein detail from v_protein_detail,
 * plus domains with Pfam hits and cluster members.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { ArchaeaProteinDetail, ClusterMember, Domain, DomainPfamHit, DomainWithPfam } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proteinId } = await params;

    if (!proteinId) {
      return NextResponse.json(
        { error: 'Protein ID is required' },
        { status: 400 }
      );
    }

    // Fetch protein detail, domains, and Pfam hits in parallel
    const [proteinResult, domainsResult, pfamResult] = await Promise.all([
      query<ArchaeaProteinDetail>(`
        SELECT * FROM archaea.v_protein_detail
        WHERE protein_id = $1
      `, [proteinId]),

      query<Domain>(`
        SELECT
          id, protein_id, domain_num, range,
          t_group, judge,
          dpam_prob, hh_prob
        FROM archaea.domains
        WHERE protein_id = $1
        ORDER BY domain_num
      `, [proteinId]),

      query<DomainPfamHit & { domain_id: number }>(`
        SELECT
          dph.domain_id,
          dph.pfam_acc,
          dph.sequence_evalue AS e_value,
          dph.sequence_score AS bit_score,
          dph.ali_from AS query_start,
          dph.ali_to AS query_end
        FROM archaea.domain_pfam_hits dph
        JOIN archaea.domains d ON dph.domain_id = d.id
        WHERE d.protein_id = $1
        ORDER BY d.domain_num, dph.sequence_evalue
      `, [proteinId]),
    ]);

    if (proteinResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Protein not found', protein_id: proteinId },
        { status: 404 }
      );
    }

    const protein = proteinResult.rows[0];

    // Group Pfam hits by domain_id
    const pfamByDomain = new Map<number, DomainPfamHit[]>();
    for (const hit of pfamResult.rows) {
      const existing = pfamByDomain.get(hit.domain_id) || [];
      existing.push({
        domain_id: hit.domain_id,
        pfam_acc: hit.pfam_acc,
        pfam_name: hit.pfam_name,
        e_value: hit.e_value,
        bit_score: hit.bit_score,
        query_start: hit.query_start,
        query_end: hit.query_end,
      });
      pfamByDomain.set(hit.domain_id, existing);
    }

    // Combine domains with their Pfam hits
    const domains: DomainWithPfam[] = domainsResult.rows.map(d => ({
      ...d,
      pfam_hits: pfamByDomain.get(d.id) || [],
    }));

    // Get cluster members if protein is in a cluster
    let clusterMembers: ClusterMember[] = [];
    if (protein.structural_cluster_id) {
      const membersResult = await query<ClusterMember>(`
        SELECT
          scm.protein_id,
          tp.uniprot_acc,
          tp.sequence_length,
          scm.is_representative,
          sqm.mean_plddt,
          sqm.quality_score,
          cc.novelty_category,
          cc.curation_status
        FROM archaea.structural_cluster_members scm
        JOIN archaea.target_proteins tp ON scm.protein_id = tp.protein_id
        LEFT JOIN archaea.structure_quality_metrics sqm ON scm.protein_id = sqm.protein_id
        LEFT JOIN archaea.curation_candidates cc ON scm.protein_id = cc.protein_id
        WHERE scm.cluster_id = $1
        ORDER BY scm.is_representative DESC, sqm.quality_score DESC NULLS LAST
        LIMIT 100
      `, [protein.structural_cluster_id]);

      clusterMembers = membersResult.rows;
    }

    return NextResponse.json({
      protein,
      domains,
      cluster_members: clusterMembers,
    });
  } catch (error) {
    console.error('Protein detail API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch protein detail',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
