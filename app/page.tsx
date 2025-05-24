"use client";
import { useEffect, useState, useMemo } from "react"; // Import useMemo
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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const { session } = useSession(); // Still useful for creating the Supabase client

  const ITEMS_PER_PAGE = 9; // Display 9 items per page (3x3 grid)

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

  const client = useMemo(() => createClerkSupabaseClient(), [session]); // Memoize the client

  useEffect(() => {
    async function loadPublicRepositories(pageToLoad: number, currentSearchTerm: string, currentSelectedTags: string[]) {
      if (pageToLoad === 0) setLoading(true); // Full loading state only for initial load or filter change

      const from = pageToLoad * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = client
        .from("prompt_repositories")
        .select("id, name, description, tags, model_compatibility", { count: 'exact' }) // Request count for pagination
        .eq("is_public", true)
        .range(from, to);

      // if (currentSearchTerm) {
      //   query = query.or(`name.ilike.%${currentSearchTerm}%,description.ilike.%${currentSearchTerm}%`);
      // }

      // if (currentSelectedTags.length > 0) {
      //   query = query.contains("tags", currentSelectedTags);
      // }
      
      query = query.order("created_at", { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        console.error("Error fetching repositories:", error);
        if (pageToLoad === 0) setRepositories([]);
        setHasMoreItems(false);
      } else if (data) {
        setRepositories(prevRepos => pageToLoad === 0 ? data : [...prevRepos, ...data]);
        setHasMoreItems(data.length === ITEMS_PER_PAGE && (count ? (from + data.length) < count : true));
      } else {
        if (pageToLoad === 0) setRepositories([]);
        setHasMoreItems(false);
      }
      if (pageToLoad === 0) setLoading(false);
    }

    loadPublicRepositories(currentPage, debouncedSearchTerm, selectedTags);
  }, [session, debouncedSearchTerm, selectedTags, client, currentPage]);


  // Reset page to 0 when search term or tags change
  useEffect(() => {
    setCurrentPage(0);
    setRepositories([]); // Clear existing repositories before new filter applies
    setHasMoreItems(true); // Assume there might be more items with new filter
  }, [debouncedSearchTerm, selectedTags]);


  const handleTagClick = (tag: string) => {
    setSelectedTags(prevTags =>
      prevTags.includes(tag)
        ? prevTags.filter(t => t !== tag)
        : [...prevTags, tag]
    );
  };

  const loadMoreItems = () => {
    setCurrentPage(prevPage => prevPage + 1);
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

      {loading && currentPage === 0 && <p className="text-center">Loading repositories...</p>}

      {!loading && repositories.length === 0 && currentPage === 0 && (
         <p className="text-center text-gray-500">No public repositories found matching your criteria.</p>
      )}

      {repositories.length > 0 && (
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
      
      {!loading && hasMoreItems && repositories.length > 0 && (
        <div className="text-center mt-8">
          <button
            onClick={loadMoreItems}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Load More
          </button>
        </div>
      )}

      {!loading && !hasMoreItems && repositories.length > 0 && currentPage > 0 && (
         <p className="text-center text-gray-500 mt-8">No more repositories to load.</p>
      )}
    </div>
  );
}
