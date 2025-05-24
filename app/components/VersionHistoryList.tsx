'use client';

import { useEffect, useState } from 'react';
import VersionComparisonModal from './VersionComparisonModal'; // Added import

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
}

const VersionHistoryList: React.FC<VersionHistoryListProps> = ({ repositoryId }) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedForCompare, setSelectedForCompare] = useState<Version[]>([]);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);

  useEffect(() => {
    if (!repositoryId) return;

    const fetchVersions = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/repositories/${repositoryId}/versions`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch versions: ${response.statusText}`);
        }
        const data = await response.json();
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
                <tr key={version.id} className={`${selectedForCompare.find(v => v.id === version.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="form-checkbox h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
                      checked={!!selectedForCompare.find(v => v.id === version.id)}
                      onChange={() => handleSelectForCompare(version)}
                      disabled={selectedForCompare.length >= 2 && !selectedForCompare.find(v => v.id === version.id)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{version.version_number}</td>
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
                    {/* Placeholder for future actions */}
                    <button disabled className="text-indigo-600 hover:text-indigo-900 mr-2 opacity-50 cursor-not-allowed">View</button>
                    <button
                      onClick={() => setShowCompareModal(true)}
                      disabled={selectedForCompare.length !== 2}
                      className={`text-yellow-600 hover:text-yellow-900 mr-2 ${selectedForCompare.length !== 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Compare
                    </button>
                    <button disabled className="text-red-600 hover:text-red-900 opacity-50 cursor-not-allowed">Rollback</button>
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