import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// Ensure these environment variables are set in your .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!supabaseAnonKey) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface NewVersionRequestBody {
  prompt_text: string;
  variables?: Record<string, any>;
  model_settings?: Record<string, any>;
  notes?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { repositoryId: string } }
) {
  try {
    const { userId } = await auth(); // Added await here
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { repositoryId } = params;
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

    // Insert new version
    const { data: newVersion, error: insertError } = await supabase
      .from('prompt_versions')
      .insert([
        {
          repository_id: repositoryId,
          version_number: newVersionNumber,
          prompt_text: prompt_text,
          variables: variables,
          model_settings: model_settings,
          user_id: userId, // Clerk user ID
          notes: notes,
        },
      ])
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
  { params }: { params: { repositoryId: string } }
) {
  try {
    // Optional: Add auth check if only authenticated users can view versions
    // const { userId } = await auth();
    // if (!userId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const { repositoryId } = params;
    if (!repositoryId) {
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