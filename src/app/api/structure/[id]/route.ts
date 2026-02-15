/**
 * GET /api/structure/:id
 *
 * Serves CIF structure files from disk.
 * Path resolved from target_proteins.cif_file column.
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { query } from '@/lib/db';

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

    const result = await query<{ cif_file: string; has_structure: boolean }>(`
      SELECT cif_file, has_structure
      FROM archaea.target_proteins
      WHERE protein_id = $1
    `, [proteinId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Protein not found', protein_id: proteinId },
        { status: 404 }
      );
    }

    const { cif_file, has_structure } = result.rows[0];

    if (!has_structure || !cif_file) {
      return NextResponse.json(
        {
          error: 'No structure available',
          protein_id: proteinId,
          has_structure,
        },
        { status: 404 }
      );
    }

    try {
      await fs.access(cif_file);
    } catch {
      return NextResponse.json(
        {
          error: 'Structure file not found on disk',
          protein_id: proteinId,
          expected_path: cif_file,
        },
        { status: 404 }
      );
    }

    const stats = await fs.stat(cif_file);
    if (stats.size === 0) {
      return NextResponse.json(
        { error: 'Structure file is empty', protein_id: proteinId },
        { status: 500 }
      );
    }

    const structureContent = await fs.readFile(cif_file, 'utf-8');

    return new NextResponse(structureContent, {
      status: 200,
      headers: {
        'Content-Type': 'chemical/x-cif',
        'Cache-Control': 'public, max-age=86400',
        'X-Protein-ID': proteinId,
      },
    });
  } catch (error) {
    console.error('Structure API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch structure',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
