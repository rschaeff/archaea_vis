/**
 * GET /api/dali/structure/:code
 *
 * Serves PDB structure files for DALI hit structures.
 * Supports both PDB chain codes (e.g., 4av3A) and ECOD domain IDs (e.g., e4a01A1).
 * Reads from the PDB mirror at /usr2/pdb/data/structures/divided/pdb/.
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { createGunzip } from 'zlib';
import { Readable } from 'stream';

const PDB_BASE = '/usr2/pdb/data/structures/divided/pdb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code || code.length < 5) {
      return NextResponse.json(
        { error: 'Invalid code. Expected PDB chain (e.g., 4av3A) or ECOD domain (e.g., e4a01A1).' },
        { status: 400 }
      );
    }

    // Extract PDB 4-letter code
    let pdbCode: string;
    if (code.startsWith('e')) {
      // ECOD domain: e{pdb}{chain}{domain}
      pdbCode = code.substring(1, 5).toLowerCase();
    } else {
      // PDB chain: {pdb}{chain}
      pdbCode = code.substring(0, 4).toLowerCase();
    }

    // Build path: /usr2/pdb/data/structures/divided/pdb/{mid}/pdb{code}.ent.gz
    const mid = pdbCode.substring(1, 3);
    const pdbPath = `${PDB_BASE}/${mid}/pdb${pdbCode}.ent.gz`;

    try {
      await fs.access(pdbPath);
    } catch {
      return NextResponse.json(
        { error: 'PDB structure file not found', code, expected_path: pdbPath },
        { status: 404 }
      );
    }

    // Read and decompress the gzipped PDB file
    const gzBuffer = await fs.readFile(pdbPath);
    const pdbContent = await decompress(gzBuffer);

    return new NextResponse(pdbContent, {
      status: 200,
      headers: {
        'Content-Type': 'chemical/x-pdb',
        'Cache-Control': 'public, max-age=604800', // 1 week - PDB files don't change
        'X-PDB-Code': pdbCode,
      },
    });
  } catch (error) {
    console.error('DALI structure API error:', error);
    return NextResponse.json(
      { error: 'Failed to serve structure', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

function decompress(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const gunzip = createGunzip();
    const stream = Readable.from(buffer);
    stream.pipe(gunzip);
    gunzip.on('data', (chunk: Buffer) => chunks.push(chunk));
    gunzip.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    gunzip.on('error', reject);
  });
}
