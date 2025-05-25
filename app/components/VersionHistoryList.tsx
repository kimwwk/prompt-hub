'use client';

import { useEffect, useState } from 'react';
import VersionComparisonModal from './VersionComparisonModal';

interface Profile {
  full_name: string | null;
  email: string | null;
}

interface Version {
  id: string;
  version_number: number;
  prompt_text: string;
  variables: Record<string, any> | null;
  model_settings: Record<string, any> | null;
  notes: string | null;
  created_at: string;
  user_id: string;
  editor: Profile | null; // Processed editor info
}

interface VersionHistoryListProps {
  repositoryId: string;
  onVersionSelect?: (version: Version) => void; // Optional callback for version selection
  selectedVersionId?: string; // Optional ID of the currently selected version
}

const VersionHistoryList: React.FC<VersionHistoryListProps> = ({ 
  repositoryId, 
  onVersionSelect,
  selectedVersionId
}) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedForCompare, setSelectedForCompare] = useState<Version[]>([]);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);
  const [rollbackLoading, setRollbackLoading] = useState<string | null>(null); // Store ID of version being rolled back
  const [rollbackError, setRollbackError] = useState<string | null>(null);

  useEffect(() => {
    if (!repositoryId) return;

    const fetchVersions = async () => {
      setLoading(true);
      setError(null);
      // Also clear rollback error on refresh
      setRollbackError(null);
      try {
        const response = await fetch(`/api/repositories/${repositoryId}/versions`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch versions: ${response.statusText}`);
        }
        let data = await response.json();
        // Ensure versions are sorted by version_number descending
        data.sort((a: Version, b: Version) => b.version_number - a.version_number);
        setVersions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        console.error("Error fetching versions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVersions();
  }, [repositoryId]);

  const handleSelectForCompare = (version: Version) => {
    setSelectedForCompare((prevSelected) => {
      if (prevSelected.find(v => v.id === version.id)) {
        return prevSelected.filter(v => v.id !== version.id);
      } else {
        if (prevSelected.length < 2) {
          return [...prevSelected, version];
        }
        // If 2 are already selected, replace the first one with the new one
        return [prevSelected[1], version];
      }
    });
  };

  const handleRollback = async (versionToRollbackTo: Version) => {
    if (!window.confirm(`Are you sure you want to roll back to version ${versionToRollbackTo.version_number}? This will create a new version based on this one.`)) {
      return;
    }
    setRollbackLoading(versionToRollbackTo.id);
    setRollbackError(null);
    try {
      const response = await fetch(`/api/repositories/${repositoryId}/versions/${versionToRollbackTo.id}/rollback`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to roll back: ${response.statusText}`);
      }
      
      const newVersion = await response.json();
      
      // Re-fetch the versions list
      const versionsResponse = await fetch(`/api/repositories/${repositoryId}/versions`);
      if (versionsResponse.ok) {
        let data = await versionsResponse.json();
        data.sort((a: Version, b: Version) => b.version_number - a.version_number);
        setVersions(data);
        
        // If onVersionSelect is provided, select the new version
        if (onVersionSelect && data.length > 0) {
          // Find the newly created version (the one with highest version number)
          const newlyCreatedVersion = data[0];
          onVersionSelect(newlyCreatedVersion);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during rollback';
      setRollbackError(errorMessage);
      console.error("Error during rollback:", err);
    } finally {
      setRollbackLoading(null);
    }
  };

  if (loading) {
    return <p className="text-center py-4">Loading version history...</p>;
  }

  if (error) {
    return <p className="text-center py-4 text-red-500">Error loading version history: {error}</p>;
  }

  if (versions.length === 0) {
    return <p className="text-center py-4">No version history found for this repository.</p>;
  }

  return (
    <>
      {rollbackError && <p className="text-center py-2 text-red-600">Rollback Error: {rollbackError}</p>}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Version History</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Editor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prompt (Snippet)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {versions.map((version) => (
                <tr 
                  key={version.id} 
                  className={`${selectedForCompare.find(v => v.id === version.id) ? 'bg-blue-50' : ''} 
                              ${selectedVersionId === version.id ? 'bg-purple-50' : ''}`}
                >
                  <td className="px-4 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="form-checkbox h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
                      checked={!!selectedForCompare.find(v => v.id === version.id)}
                      onChange={() => handleSelectForCompare(version)}
                      disabled={selectedForCompare.length >= 2 && !selectedForCompare.find(v => v.id === version.id)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {version.version_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {version.editor?.full_name || version.editor?.email || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(version.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{version.notes || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <details>
                      <summary className="cursor-pointer hover:text-blue-600">View Prompt</summary>
                      <pre className="mt-2 p-2 bg-gray-100 rounded text-xs whitespace-pre-wrap">{version.prompt_text}</pre>
                    </details>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {/* View button - select this version for viewing */}
                    <button 
                      onClick={() => onVersionSelect && onVersionSelect(version)}
                      className={`text-indigo-600 hover:text-indigo-900 mr-2 ${!onVersionSelect ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={!onVersionSelect}
                    >
                      View
                    </button>
                    
                    <button
                      onClick={() => setShowCompareModal(true)}
                      disabled={selectedForCompare.length !== 2}
                      className={`text-yellow-600 hover:text-yellow-900 mr-2 ${selectedForCompare.length !== 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Compare
                    </button>
                    
                    <button
                      onClick={() => handleRollback(version)}
                      disabled={rollbackLoading === version.id || (versions.length > 0 && version.id === versions[0].id)} // Disable for latest version
                      className={`text-red-600 hover:text-red-900 ${(rollbackLoading === version.id || (versions.length > 0 && version.id === versions[0].id)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {rollbackLoading === version.id ? 'Rolling back...' : 'Rollback'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showCompareModal && selectedForCompare.length === 2 && (
        <VersionComparisonModal
          versionA={selectedForCompare[0]}
          versionB={selectedForCompare[1]}
          onClose={() => setShowCompareModal(false)}
        />
      )}
    </>
  );
};

export default VersionHistoryList;