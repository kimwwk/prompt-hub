import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!supabaseAnonKey) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_KEY');
}

// Import createServerSupabaseClient from SSR client
import { createServerSupabaseClient } from '../../../../../../ssr/client';

// Use a minimal POST handler with a single parameter
export async function POST(request: Request) {
  try {
    // Get user from auth
    const { userId: currentUserId } = await auth();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract the repositoryId and versionId from the URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const repositoryId = pathParts[pathParts.indexOf('repositories') + 1];
    const targetVersionId = pathParts[pathParts.indexOf('versions') + 1];

    // Create Supabase client using the helper function
    const supabase = createServerSupabaseClient();

    if (!repositoryId || !targetVersionId) {
      return NextResponse.json({ error: 'Repository ID and Target Version ID are required' }, { status: 400 });
    }

    // 1. Fetch the target version to roll back to
    const { data: targetVersion, error: fetchError } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('id', targetVersionId)
      .eq('repository_id', repositoryId) // Ensure the version belongs to the repository
      .single();

    if (fetchError) {
      console.error('Error fetching target version for rollback:', fetchError);
      return NextResponse.json({ error: 'Target version not found or error fetching it', details: fetchError.message }, { status: 404 });
    }

    if (!targetVersion) {
        return NextResponse.json({ error: 'Target version not found' }, { status: 404 });
    }

    // 2. Determine new version number for the rollback entry
    const { data: maxVersionData, error: maxVersionError } = await supabase
      .from('prompt_versions')
      .select('version_number')
      .eq('repository_id', repositoryId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    if (maxVersionError && maxVersionError.code !== 'PGRST116') { // PGRST116: no rows found (should not happen if targetVersion exists)
      console.error('Error fetching max version number for rollback:', maxVersionError);
      return NextResponse.json({ error: 'Failed to determine new version number for rollback', details: maxVersionError.message }, { status: 500 });
    }
    
    const newVersionNumber = maxVersionData ? maxVersionData.version_number + 1 : 1; // Should always be maxVersionData + 1

    // 3. Create a new version entry by copying data from targetVersion
    const { data: rolledBackVersion, error: insertError } = await supabase
      .from('prompt_versions')
      .insert([
        {
          repository_id: repositoryId,
          version_number: newVersionNumber,
          prompt_text: targetVersion.prompt_text,
          variables: targetVersion.variables,
          model_settings: targetVersion.model_settings,
          user_id: currentUserId, // User performing the rollback
          notes: `Rolled back to version ${targetVersion.version_number} (ID: ${targetVersion.id}). Original notes: ${targetVersion.notes || ''}`,
          // created_at will be set by default
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Error creating new version for rollback:', insertError);
      return NextResponse.json({ error: 'Failed to create rollback version', details: insertError.message }, { status: 500 });
    }

    return NextResponse.json(rolledBackVersion, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/repositories/[repositoryId]/versions/[versionId]/rollback:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'An internal server error occurred during rollback', details: errorMessage }, { status: 500 });
  }
}
