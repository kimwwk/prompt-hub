"use client";
import { useEffect, useState } from "react";
import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import VersionHistoryList from "../../components/VersionHistoryList";
import PromptEditor from "../../components/PromptEditor";
import { useParams, useRouter } from 'next/navigation';
import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";

// Define types for our data
interface PromptVersion {
  id: string;
  version_number: number;
  prompt_text: string;
  variables: any | null;
  model_settings: any | null;
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
  is_public: boolean;
  user_id: string;
}

export default function RepositoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params; // Repository ID from URL

  const [repository, setRepository] = useState<PromptRepositoryDetails | null>(null);
  const [latestVersion, setLatestVersion] = useState<PromptVersion | null>(null);
  const [activeVersion, setActiveVersion] = useState<PromptVersion | null>(null);
  const [versionHistory, setVersionHistory] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [versionListKey, setVersionListKey] = useState(0); // Used to force refresh VersionHistoryList
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  
  const { session } = useSession();

  function createClerkSupabaseClient() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_KEY!,
      {
        async accessToken() {
          // Use the default Clerk session token, Supabase will validate it via native integration
          const supabaseAccessToken = await session?.getToken();
          return supabaseAccessToken ?? null;
        },
      }
    );
  }

  const client = createClerkSupabaseClient();

  // Load repository details
  useEffect(() => {
    if (!id) return;

    async function loadRepositoryDetails() {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch repository details
        const { data: repoData, error: repoError } = await client
          .from("prompt_repositories")
          .select("*")
          .eq("id", id as string)
          .single();

        if (repoError) {
          console.error("Error fetching repository details:", repoError);
          setError("Repository not found or access denied.");
          setRepository(null);
          setLoading(false);
          return;
        }

        if (repoData) {
          setRepository(repoData as PromptRepositoryDetails);
          
          // Check if current user is the owner
          setIsOwner(!!session?.user?.id && session.user.id === repoData.user_id);

          // Fetch the versions
          const { data: versionsData, error: versionsError } = await client
            .from("prompt_versions")
            .select("*")
            .eq("repository_id", id as string)
            .order("version_number", { ascending: false });

          if (versionsError) {
            console.error("Error fetching versions:", versionsError);
          } else if (versionsData && versionsData.length > 0) {
            setVersionHistory(versionsData);
            setLatestVersion(versionsData[0] as PromptVersion);
            setActiveVersion(versionsData[0] as PromptVersion);
          }
        }
      } catch (err) {
        console.error("Error in loadRepositoryDetails:", err);
        setError("An error occurred while loading repository details.");
      } finally {
        setLoading(false);
      }
    }

    loadRepositoryDetails();
  }, [id, session, client]);

  // Function to handle version selection change
  const handleVersionChange = (version: PromptVersion) => {
    setActiveVersion(version);
    // If we're editing, cancel the edit when switching versions
    if (isEditing) {
      setIsEditing(false);
    }
  };

  // Function to create a new version
  const handleSaveVersion = async (promptText: string, notes: string) => {
    if (!promptText.trim()) {
      throw new Error("Prompt text cannot be empty.");
    }

    try {
      const response = await fetch(`/api/repositories/${id}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt_text: promptText,
          notes: notes || 'New version',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create version: ${response.statusText}`);
      }

      const newVersion = await response.json();
      
      // Update the UI with the new version
      setLatestVersion(newVersion);
      setActiveVersion(newVersion);
      setIsEditing(false);
      
      // Refresh the version history
      const versionsResponse = await fetch(`/api/repositories/${id}/versions`);
      if (versionsResponse.ok) {
        let data = await versionsResponse.json();
        data.sort((a: PromptVersion, b: PromptVersion) => b.version_number - a.version_number);
        setVersionHistory(data);
      }
      
      // Force refresh of version history list
      setVersionListKey(prevKey => prevKey + 1);
      
    } catch (err) {
      console.error("Error creating new version:", err);
      throw err;
    }
  };

  // Function to copy prompt to clipboard
  const copyPromptToClipboard = () => {
    if (activeVersion?.prompt_text) {
      navigator.clipboard.writeText(activeVersion.prompt_text)
        .then(() => {
          setShowCopySuccess(true);
          setTimeout(() => setShowCopySuccess(false), 2000);
        })
        .catch(err => {
          console.error("Failed to copy text: ", err);
        });
    }
  };

  // Function to download prompt as text file
  const downloadPromptAsText = () => {
    if (activeVersion?.prompt_text && repository?.name) {
      const element = document.createElement("a");
      const file = new Blob([activeVersion.prompt_text], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = `${repository.name.replace(/\s+/g, '_')}_v${activeVersion.version_number}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 flex justify-center items-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          <p className="font-medium">Error</p>
          <p>{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 bg-red-100 hover:bg-red-200 text-red-800 font-medium py-2 px-4 rounded transition-colors"
          >
            &larr; Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!repository) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded relative">
          <p className="font-medium">Repository Not Found</p>
          <p>The repository you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.</p>
          <button
            onClick={() => router.back()}
            className="mt-4 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-medium py-2 px-4 rounded transition-colors"
          >
            &larr; Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Navigation and Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <button
          onClick={() => router.back()}
          className="mb-4 md:mb-0 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded inline-flex items-center transition-colors"
        >
          &larr; Back to list
        </button>

        <div className="flex space-x-2">
          {isOwner && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded inline-flex items-center transition-colors"
            >
              Create New Version
            </button>
          )}
          <SignedOut>
            <Link 
              href={`/sign-in?redirect_url=/repo/${id}`}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded inline-flex items-center transition-colors"
            >
              Sign in to create versions
            </Link>
          </SignedOut>
        </div>
      </div>

      {/* Repository Header */}
      <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
        <h1 className="text-3xl font-bold mb-2">{repository.name}</h1>
        {repository.description && <p className="text-gray-700 mb-4">{repository.description}</p>}
        
        <div className="flex flex-col md:flex-row md:items-center text-sm text-gray-500 mb-4 space-y-2 md:space-y-0 md:space-x-4">
          <div>
            Created: {new Date(repository.created_at).toLocaleDateString()}
          </div>
          <div className="flex items-center">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              repository.is_public ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {repository.is_public ? 'Public' : 'Private'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {repository.tags && repository.tags.length > 0 && repository.tags.map(tag => (
            <span key={tag} className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
          
          {repository.model_compatibility && repository.model_compatibility.length > 0 && repository.model_compatibility.map(model => (
            <span key={model} className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
              {model}
            </span>
          ))}
        </div>
      </div>

      {/* New Version Editor */}
      {isEditing && (
        <div className="mb-6">
          <PromptEditor
            initialText={activeVersion?.prompt_text || ""}
            initialNotes=""
            onSave={handleSaveVersion}
            onCancel={() => setIsEditing(false)}
            isNew={true}
          />
        </div>
      )}

      {/* Prompt Display */}
      {!isEditing && activeVersion && (
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Prompt (Version {activeVersion.version_number})
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={copyPromptToClipboard}
                className="text-purple-600 hover:text-purple-800 font-medium text-sm flex items-center transition-colors"
              >
                {showCopySuccess ? "✓ Copied!" : "Copy to Clipboard"}
              </button>
              <button
                onClick={downloadPromptAsText}
                className="text-purple-600 hover:text-purple-800 font-medium text-sm flex items-center transition-colors"
              >
                Download as .txt
              </button>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap overflow-auto">
            {activeVersion.prompt_text}
          </div>
          
          {activeVersion.notes && (
            <div className="mt-4">
              <h3 className="font-medium text-gray-700 mb-2">Version Notes:</h3>
              <p className="text-gray-600 text-sm">{activeVersion.notes}</p>
            </div>
          )}
          
          {activeVersion.created_at && (
            <div className="mt-4 text-xs text-gray-500">
              Created on {new Date(activeVersion.created_at).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* No versions message */}
      {!isEditing && !activeVersion && (
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6 text-center">
          <div className="py-6">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="text-xl font-medium text-gray-700 mb-2">No Versions Yet</h3>
            <p className="text-gray-500 mb-6">This repository doesn&apos;t have any prompt versions yet.</p>
            
            <SignedIn>
              {isOwner && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded transition-colors"
                >
                  Create First Version
                </button>
              )}
            </SignedIn>
            
            <SignedOut>
              <Link 
                href={`/sign-in?redirect_url=/repo/${id}`}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded inline-flex items-center transition-colors"
              >
                Sign in to create versions
              </Link>
            </SignedOut>
          </div>
        </div>
      )}

      {/* Version History */}
      {id && typeof id === 'string' && (
        <div key={versionListKey}>
          <VersionHistoryList 
            repositoryId={id} 
            onVersionSelect={handleVersionChange}
            selectedVersionId={activeVersion?.id}
          />
        </div>
      )}
    </div>
  );
}