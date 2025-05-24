import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerSupabaseClient } from '../../../ssr/client';

interface RequestBody {
  repoName?: string;
  description?: string;
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: RequestBody = await request.json();
    const { repoName, description } = body;

    // Server-side validation
    if (!repoName || typeof repoName !== 'string' || repoName.trim().length === 0) {
      return NextResponse.json({ error: 'Repository name is required.' }, { status: 400 });
    }
    if (repoName.trim().length > 100) {
      return NextResponse.json({ error: 'Repository name cannot exceed 100 characters.' }, { status: 400 });
    }
    if (description && (typeof description !== 'string' || description.length > 500)) {
      return NextResponse.json({ error: 'Description cannot exceed 500 characters.' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    
    const dataToInsert = {
      user_id: userId, // Clerk userId is TEXT, matches prompt_repositories.user_id
      name: repoName!.trim(), // repoName is validated to be non-empty string
      description: description?.trim() || null, // description is optional
      is_public: false, // Default to private for now
      // tags and model_compatibility can be omitted or set to null if not provided
    };

    const { data: newRepo, error: dbError } = await supabase
      .from('prompt_repositories')
      .insert(dataToInsert)
      .select()
      .single(); // Assuming we want to return the single created record

    if (dbError) {
      console.error('Supabase DB Error in /api/repo/create:', dbError);
      // Check for specific errors, e.g., unique constraint violation if one were active
      // if (dbError.code === '23505') { // Unique violation
      //   return NextResponse.json({ error: 'A repository with this name already exists for your account.' }, { status: 409 });
      // }
      return NextResponse.json({ error: 'Failed to create repository in database.', details: dbError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: 'Repository created successfully.',
        data: newRepo
      },
      { status: 201 } // 201 Created
    );

  } catch (error: any) { // Added type annotation for error
    console.error('Error in /api/repo/create:', error.message, error.stack);
    if (error instanceof SyntaxError) { // Handle JSON parsing errors
        return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}