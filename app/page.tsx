"use client";
import { useEffect, useState } from "react";
import { useSession } from "@clerk/nextjs"; // useUser not strictly needed for public browsing
import { createClient } from "@supabase/supabase-js";

// Define a type for our prompt repository data
interface PromptRepository {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  model_compatibility: string[] | null;
  // Add other fields you want to display
}

export default function Home() {
  const [repositories, setRepositories] = useState<PromptRepository[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  // const [allTags, setAllTags] = useState<string[]>([]); // Removed for now
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { session } = useSession(); // Still useful for creating the Supabase client

  // Debounce effect for search term
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms delay

    return () => {
      clearTimeout(timerId);
    };
  }, [searchTerm]);

  // Create a custom supabase client that injects the Clerk Supabase token if available
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
    async function loadPublicRepositories(currentSearchTerm: string, currentSelectedTags: string[]) {
      setLoading(true);
      let query = client
        .from("prompt_repositories")
        .select("id, name, description, tags, model_compatibility")
        .eq("is_public", true);

      if (currentSearchTerm) {
        query = query.or(`name.ilike.%${currentSearchTerm}%,description.ilike.%${currentSearchTerm}%`);
      }

      if (currentSelectedTags.length > 0) {
        // Use 'contains' (for @> operator) for array column 'tags'
        // This means the repository's tags array must contain ALL selected tags
        query = query.contains("tags", currentSelectedTags);
      }
      
      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching repositories:", error);
        setRepositories([]); // Set to empty array on error
      } else if (data) {
        setRepositories(data);
      }
      setLoading(false);
    }

    loadPublicRepositories(debouncedSearchTerm, selectedTags);
  }, [session, debouncedSearchTerm, selectedTags, client]);

  const handleTagClick = (tag: string) => {
    setSelectedTags(prevTags =>
      prevTags.includes(tag)
        ? prevTags.filter(t => t !== tag) // Deselect if already selected
        : [...prevTags, tag] // Select if not selected
    );
  };

  // Derive unique tags from fetched repositories for the filter UI
  const uniqueTags = Array.from(
    new Set(repositories.flatMap(repo => repo.tags || []))
  ).sort();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Public Prompt Repositories</h1>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search repositories by name or description..."
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {uniqueTags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2 items-center">
          <span className="font-semibold text-sm mr-2">Filter by Tags:</span>
          {uniqueTags.map(tag => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className={`px-3 py-1 text-xs font-medium rounded-full border
                ${selectedTags.includes(tag)
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-center">Loading repositories...</p>}

      {!loading && repositories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {repositories.map((repo) => (
            <div key={repo.id} className="border p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold mb-2">{repo.name}</h2>
              {repo.description && <p className="text-gray-700 mb-3 text-sm">{repo.description}</p>}
              {repo.tags && repo.tags.length > 0 && (
                <div className="mb-2">
                  <span className="font-semibold text-xs">Tags: </span>
                  {repo.tags.map(tag => (
                    <span key={tag} className="bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {repo.model_compatibility && repo.model_compatibility.length > 0 && (
                <div>
                  <span className="font-semibold text-xs">Models: </span>
                  {repo.model_compatibility.map(model => (
                    <span key={model} className="bg-green-100 text-green-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
                      {model}
                    </span>
                  ))}
                </div>
              )}
              <a href={`/repo/${repo.id}`} className="text-blue-600 hover:text-blue-800 hover:underline mt-3 inline-block text-sm font-medium">
                View Details &rarr;
              </a>
            </div>
          ))}
        </div>
      )}

      {!loading && repositories.length === 0 && (
        <p className="text-center text-gray-500">No public repositories found.</p>
      )}
    </div>
  );
}
