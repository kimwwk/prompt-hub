"use client";
import Image from 'next/image';
import { useEffect, useState, useMemo, useCallback } from "react";
import { useSession, SignedIn, SignedOut } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

// Define a type for our prompt repository data
interface PromptRepository {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  model_compatibility: string[] | null;
}

export default function Home() {
  const [repositories, setRepositories] = useState<PromptRepository[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const { session } = useSession();

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
  const createClerkSupabaseClient = useCallback(() => {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_KEY!,
      {
        async accessToken() {
          const clerkSessionToken = await session?.getToken();
          return clerkSessionToken ?? null;
        },
      }
    );
  }, [session]);

  const client = useMemo(() => createClerkSupabaseClient(), [createClerkSupabaseClient]);

  useEffect(() => {
    async function loadPublicRepositories(pageToLoad: number, currentSearchTerm: string, currentSelectedTags: string[]) {
      if (pageToLoad === 0) setLoading(true);

      const from = pageToLoad * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = client
        .from("prompt_repositories")
        .select("id, name, description, tags, model_compatibility", { count: 'exact' })
        .eq("is_public", true)
        .range(from, to);

      // Uncomment and implement when search and filtering are ready
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
    setRepositories([]);
    setHasMoreItems(true);
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
    <div className="bg-gray-50 min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-purple-700 to-purple-900 text-white">
        <div className="container mx-auto px-4 py-16 md:py-24 flex flex-col md:flex-row items-center">
          <div className="mb-8 md:mb-0">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              GitHub for Prompts
            </h1>
            <p className="text-lg md:text-xl mb-6 text-purple-100">
              Share, fork, and remix AI prompts in an open, community-first platform
            </p>
            <p className="mb-8 text-purple-100">
              Discover high-quality prompts for ChatGPT, Llama, Claude, and other AI models. 
              Create, version, and collaborate on prompts with the community.
            </p>
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
              <Link
                href="#explore"
                className="px-6 py-3 bg-white text-purple-800 font-medium rounded-md hover:bg-purple-50 transition-colors text-center"
              >
                Explore Prompts
              </Link>
              <SignedOut>
                <Link
                  href="/sign-in?redirect_url=/repo/create"
                  className="px-6 py-3 border border-white text-white font-medium rounded-md hover:bg-white hover:bg-opacity-10 transition-colors text-center"
                >
                  Create Prompt
                </Link>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/repo/create"
                  className="px-6 py-3 border border-white text-white font-medium rounded-md hover:bg-white hover:bg-opacity-10 transition-colors text-center"
                >
                  Create Prompt
                </Link>
              </SignedIn>
            </div>
          </div>
          {/* <div className="md:w-1/2 flex justify-center">
            <Image
              src="/hero.png"
              alt="Prompt Hub Illustration"
              width={500}
              height={500}
              className="max-w-full h-auto rounded-lg shadow-lg"
            />
          </div> */}
        </div>
      </section>

      {/* Repository Section */}
      <section id="explore" className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Explore Prompts</h2>
          <p className="text-gray-600">Discover and use prompts created by the community</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-8">
          <div className="mb-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search prompts by name or description..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {uniqueTags.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="font-medium text-sm text-gray-700 mr-2">Filter by:</span>
              {uniqueTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors
                    ${selectedTags.includes(tag)
                      ? 'bg-purple-100 text-purple-800 border border-purple-300'
                      : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                    }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Repository Grid */}
        {loading && currentPage === 0 && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
          </div>
        )}

        {!loading && repositories.length === 0 && currentPage === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-gray-500 text-lg">No prompts found matching your criteria.</p>
            <p className="text-gray-400 mt-2">Try adjusting your search or filters.</p>
          </div>
        )}

        {repositories.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {repositories.map((repo) => (
              <div 
                key={repo.id} 
                className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow border border-gray-100"
              >
                <div className="p-5">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2 line-clamp-1">{repo.name}</h3>
                  {repo.description && (
                    <p className="text-gray-600 mb-4 text-sm line-clamp-2">{repo.description}</p>
                  )}
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {repo.tags && repo.tags.length > 0 && repo.tags.map(tag => (
                      <span key={tag} className="bg-purple-50 text-purple-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                    
                    {repo.model_compatibility && repo.model_compatibility.length > 0 && repo.model_compatibility.map(model => (
                      <span key={model} className="bg-green-50 text-green-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                        {model}
                      </span>
                    ))}
                  </div>
                  
                  <Link 
                    href={`/repo/${repo.id}`} 
                    className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center"
                  >
                    View Details
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Load More Button */}
        {!loading && hasMoreItems && repositories.length > 0 && (
          <div className="text-center mt-10">
            <button
              onClick={loadMoreItems}
              className="px-6 py-2.5 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors inline-flex items-center"
            >
              Load More
              <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}

        {!loading && !hasMoreItems && repositories.length > 0 && currentPage > 0 && (
          <p className="text-center text-gray-500 mt-10">No more prompts to load.</p>
        )}
      </section>

      {/* Features Section */}
      <section className="bg-white py-12 md:py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-12">Why Prompt Hub?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-800">Public Prompt Repositories</h3>
              <p className="text-gray-600">Each repository holds one prompt with descriptions, usage notes, and version history.</p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-800">Versioning & Forking</h3>
              <p className="text-gray-600">Track the evolution of prompts with version history and fork existing prompts to create your own.</p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-800">Tags & Metadata</h3>
              <p className="text-gray-600">Find prompts by model compatibility (GPT-4, Llama) or domain (productivity, marketing).</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

