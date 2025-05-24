"use client";
import { useEffect, useState } from "react";
import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import VersionHistoryList from "../../components/VersionHistoryList"; // Import the new component
import { useParams, useRouter } from 'next/navigation'; // Import useRouter for back navigation

// Define types for our data
interface PromptVersion {
  id: string;
  version_number: number;
  prompt_text: string;
  variables: any | null; // Or a more specific type
  model_settings: any | null; // Or a more specific type
  notes: string | null;
  created_at: string;
}

interface PromptRepositoryDetails {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  model_compatibility: string[] | null;
  created_at: string;
  // prompt_versions: PromptVersion[]; // Will be handled by VersionHistoryList
}

export default function RepositoryDetailPage() {
  const params = useParams();
  const router = useRouter(); // For back button
  const { id } = params; // Repository ID from URL

  const [repository, setRepository] = useState<PromptRepositoryDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const { session } = useSession();

  function createClerkSupabaseClient() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_KEY!,
      {
        async accessToken() {
          const supabaseAccessToken = await session?.getToken({ template: 'supabase' });
          return supabaseAccessToken ?? null;
        },
      }
    );
  }

  const client = createClerkSupabaseClient();

  useEffect(() => {
    if (!id) return;

    async function loadRepositoryDetails() {
      setLoading(true);
      // Fetch repository details
      const { data: repoData, error: repoError } = await client // Remove prompt_versions from select
        .from("prompt_repositories")
        .select("*")
        .eq("id", id as string)
        .eq("is_public", true) // Ensure it's public or user has access (RLS handles this)
        .single(); // Expecting a single repository

      if (repoError) {
        console.error("Error fetching repository details:", repoError);
        setRepository(null);
      } else if (repoData) {
        setRepository(repoData as PromptRepositoryDetails);
      }
      setLoading(false);
    }

    loadRepositoryDetails();
  }, [id, session]); // Re-run if id or session changes

  if (loading) {
    return <p className="text-center p-10">Loading repository details...</p>;
  }

  if (!repository) {
    return <p className="text-center p-10 text-red-500">Repository not found or access denied.</p>;
  }

  return (
    <div className="container mx-auto p-4">
      <button
        onClick={() => router.back()}
        className="mb-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded inline-flex items-center"
      >
        &larr; Back to list
      </button>

      <h1 className="text-3xl font-bold mb-2">{repository.name}</h1>
      {repository.description && <p className="text-gray-700 mb-4">{repository.description}</p>}
      
      <div className="mb-4 text-sm text-gray-500">
        Created on: {new Date(repository.created_at).toLocaleDateString()}
      </div>

      {repository.tags && repository.tags.length > 0 && (
        <div className="mb-2">
          <span className="font-semibold">Tags: </span>
          {repository.tags.map(tag => (
            <span key={tag} className="bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}
      {repository.model_compatibility && repository.model_compatibility.length > 0 && (
        <div className="mb-6">
          <span className="font-semibold">Models: </span>
          {repository.model_compatibility.map(model => (
            <span key={model} className="bg-green-100 text-green-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
              {model}
            </span>
          ))}
        </div>
      )}

      {/* Render the VersionHistoryList component */}
      {id && typeof id === 'string' && <VersionHistoryList repositoryId={id} />}
    </div>
  );
}