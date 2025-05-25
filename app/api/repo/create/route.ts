import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerSupabaseClient } from '../../../ssr/client';

interface RequestBody {
  repoName?: string;
  description?: string;
  tags?: string[] | null;
  model_compatibility?: string[] | null;
  is_public?: boolean;
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: RequestBody = await request.json();
    const { repoName, description, tags, model_compatibility, is_public } = body;

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
    
    // Validate tags and model_compatibility if provided
    if (tags && !Array.isArray(tags)) {
      return NextResponse.json({ error: 'Tags must be an array.' }, { status: 400 });
    }
    if (model_compatibility && !Array.isArray(model_compatibility)) {
      return NextResponse.json({ error: 'Model compatibility must be an array.' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    
    const dataToInsert = {
      user_id: userId,
      name: repoName!.trim(),
      description: description?.trim() || null,
      is_public: typeof is_public === 'boolean' ? is_public : true, // Default to public if not specified
      tags: tags || null,
      model_compatibility: model_compatibility || null,
    };

    const { data: newRepo, error: dbError } = await supabase
      .from('prompt_repositories')
      .insert(dataToInsert)
      .select()
      .single();

    if (dbError) {
      console.error('Supabase DB Error in /api/repo/create:', dbError);
      return NextResponse.json({ error: 'Failed to create repository in database.', details: dbError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: 'Repository created successfully.',
        data: newRepo
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Error in /api/repo/create:', error.message, error.stack);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}