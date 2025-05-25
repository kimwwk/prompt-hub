import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// Ensure these environment variables are set in your .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!supabaseAnonKey) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_KEY');
}

// const supabase = createClient(supabaseUrl, supabaseAnonKey); // We will create a request-scoped client

interface NewVersionRequestBody {
  prompt_text: string;
  variables?: Record<string, any>;
  model_settings?: Record<string, any>;
  notes?: string;
}

export async function POST(
  request: NextRequest,
  context: { params: { repositoryId: string } } // Changed to use context directly
) {
  const resolvedParams = await context.params; // Await the params
  try {
    const { userId, getToken } = await auth(); // Get getToken from auth
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseToken = await getToken(); // Get Supabase token from Clerk
    if (!supabaseToken) {
      return NextResponse.json({ error: 'Failed to get Supabase token' }, { status: 500 });
    }

    // Create a new Supabase client with the user's token for this request
    const supabase = createClient(supabaseUrl!, supabaseAnonKey!, { global: { headers: { Authorization: `Bearer ${supabaseToken}` } } });
    
    const repositoryId = resolvedParams.repositoryId; // Access repositoryId from resolvedParams
    if (!repositoryId) {
      return NextResponse.json({ error: 'Repository ID is required' }, { status: 400 });
    }

    const body = (await request.json()) as NewVersionRequestBody;
    const { prompt_text, variables, model_settings, notes } = body;

    if (!prompt_text) {
      return NextResponse.json({ error: 'Prompt text is required' }, { status: 400 });
    }

    // Determine new version number
    const { data: maxVersionData, error: maxVersionError } = await supabase
      .from('prompt_versions')
      .select('version_number')
      .eq('repository_id', repositoryId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    if (maxVersionError && maxVersionError.code !== 'PGRST116') { // PGRST116: no rows found
      console.error('Error fetching max version number:', maxVersionError);
      return NextResponse.json({ error: 'Failed to determine new version number', details: maxVersionError.message }, { status: 500 });
    }

    const newVersionNumber = maxVersionData ? maxVersionData.version_number + 1 : 1;
    console.log(`[POST /api/repositories/${repositoryId}/versions] Attempting to insert version. UserID from auth(): ${userId}, RepoID: ${repositoryId}, VersionNum: ${newVersionNumber}`); // Log user_id

    const dataToInsert = {
      repository_id: repositoryId,
      version_number: newVersionNumber,
      prompt_text: prompt_text,
      variables: variables,
      model_settings: model_settings,
      user_id: userId, // Clerk user ID
      notes: notes,
    };
    console.log('[POST /api/repositories/[repositoryId]/versions] Data to insert:', JSON.stringify(dataToInsert, null, 2));

    // Insert new version
    const { data: newVersion, error: insertError } = await supabase
      .from('prompt_versions')
      .insert([dataToInsert])
      .select()
      .single();
 
    if (insertError) {
      console.error('Error inserting new version:', insertError);
      return NextResponse.json({ error: 'Failed to create new version', details: insertError.message }, { status: 500 });
    }

    return NextResponse.json(newVersion, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/repositories/[repositoryId]/versions:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'An internal server error occurred', details: errorMessage }, { status: 500 });
  }
}
export async function GET(
  request: NextRequest,
  context: { params: { repositoryId: string } } // Changed to use context directly
) {
  // For GET requests, if RLS allows anon reads, anon client is fine.
  // If it requires auth for specific user data, you'd need the token method too.
  // Let's assume for now the GET might be public or use a simpler RLS.
  // If GET also fails due to RLS on profiles, this will need similar auth context.
  const supabase = createClient(supabaseUrl!, supabaseAnonKey!); // Standard client for potentially public GET

  const resolvedParams = await context.params; // Await the params
  try {
    // Optional: Add auth check if only authenticated users can view versions
    // const { userId, getToken } = await auth(); // If GET needs auth
    // const supabaseToken = await getToken({ template: 'supabase' });
    // const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${supabaseToken}` } } });
    // if (!userId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }
    console.log('[GET /api/repositories/[repositoryId]/versions] Resolved Params:', resolvedParams);

    const repositoryId = resolvedParams.repositoryId; // Access repositoryId from resolvedParams
    if (!repositoryId) {
      console.error('[GET /api/repositories/[repositoryId]/versions] Repository ID is missing from params');
      return NextResponse.json({ error: 'Repository ID is required' }, { status: 400 });
    }
 
    const { data: versions, error } = await supabase
      .from('prompt_versions')
      .select(`
        *,
        profiles (
          full_name,
          email
        )
      `)
      .eq('repository_id', repositoryId)
      .order('version_number', { ascending: false });

    if (error) {
      console.error('Error fetching versions:', error);
      return NextResponse.json({ error: 'Failed to fetch versions', details: error.message }, { status: 500 });
    }

    // The join with profiles might return profiles as an object if user_id is unique in profiles
    // or an array if it's not. Adjusting to ensure editor is an object.
    const formattedVersions = versions.map(v => {
      const editorProfile = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles;
      return {
        ...v,
        editor: editorProfile ? { full_name: editorProfile.full_name, email: editorProfile.email } : null,
        profiles: undefined, // remove the original profiles field
      };
    });


    return NextResponse.json(formattedVersions, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/repositories/[repositoryId]/versions:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'An internal server error occurred', details: errorMessage }, { status: 500 });
  }
}