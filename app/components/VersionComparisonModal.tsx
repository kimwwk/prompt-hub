'use client';

import React from 'react';
import * as Diff from 'diff';

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
  editor: Profile | null;
}

interface VersionComparisonModalProps {
  versionA: Version;
  versionB: Version;
  onClose: () => void;
}

const renderDiff = (textA: string, textB: string) => {
  const differences = Diff.diffChars(textA, textB);
  return differences.map((part, index) => {
    const color = part.added ? 'bg-green-100 text-green-700' :
                  part.removed ? 'bg-red-100 text-red-700 line-through' :
                  'text-gray-700';
    return <span key={index} className={`${color} px-1`}>{part.value}</span>;
  });
};

const renderJsonDiff = (objA: any, objB: any) => {
  // Basic JSON diff: stringify and then use text diff
  // For a more sophisticated JSON diff, a dedicated library might be better
  const strA = JSON.stringify(objA, null, 2) || '{}';
  const strB = JSON.stringify(objB, null, 2) || '{}';
  if (strA === strB) {
    return <pre className="text-gray-700 whitespace-pre-wrap">{strA}</pre>;
  }
  return <div className="whitespace-pre-wrap">{renderDiff(strA, strB)}</div>;
};


const VersionComparisonModal: React.FC<VersionComparisonModalProps> = ({ versionA, versionB, onClose }) => {
  if (!versionA || !versionB) return null;

  // Ensure versionA is always the older version for consistent display
  const [olderVersion, newerVersion] = versionA.version_number < versionB.version_number ? [versionA, versionB] : [versionB, versionA];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-10">
      <div className="relative mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3 text-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Comparing Version {olderVersion.version_number} with Version {newerVersion.version_number}
          </h3>
          <button
            onClick={onClose}
            className="absolute top-0 right-0 mt-4 mr-4 text-gray-400 hover:text-gray-600"
          >
            <span className="sr-only">Close</span>
            &times;
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left text-sm">
            {/* Column for Older Version */}
            <div>
              <h4 className="font-semibold text-md mb-2">Version {olderVersion.version_number}</h4>
              <p className="text-xs text-gray-500 mb-1">Editor: {olderVersion.editor?.full_name || olderVersion.editor?.email || 'N/A'}</p>
              <p className="text-xs text-gray-500 mb-3">Created: {new Date(olderVersion.created_at).toLocaleString()}</p>
              
              <div className="mb-4">
                <h5 className="font-medium mb-1">Prompt Text:</h5>
                <div className="p-2 border rounded bg-gray-50 max-h-60 overflow-y-auto whitespace-pre-wrap">
                  {renderDiff(olderVersion.prompt_text, newerVersion.prompt_text)}
                </div>
              </div>
              <div className="mb-4">
                <h5 className="font-medium mb-1">Variables:</h5>
                <div className="p-2 border rounded bg-gray-50 max-h-60 overflow-y-auto">
                  {renderJsonDiff(olderVersion.variables, newerVersion.variables)}
                </div>
              </div>
              <div className="mb-4">
                <h5 className="font-medium mb-1">Model Settings:</h5>
                <div className="p-2 border rounded bg-gray-50 max-h-60 overflow-y-auto">
                  {renderJsonDiff(olderVersion.model_settings, newerVersion.model_settings)}
                </div>
              </div>
              <div>
                <h5 className="font-medium mb-1">Notes:</h5>
                <div className="p-2 border rounded bg-gray-50 max-h-60 overflow-y-auto whitespace-pre-wrap">
                  {renderDiff(olderVersion.notes || '', newerVersion.notes || '')}
                </div>
              </div>
            </div>

            {/* Column for Newer Version (or just diff highlights) - this example shows diff inline */}
             <div>
              <h4 className="font-semibold text-md mb-2">Version {newerVersion.version_number}</h4>
              <p className="text-xs text-gray-500 mb-1">Editor: {newerVersion.editor?.full_name || newerVersion.editor?.email || 'N/A'}</p>
              <p className="text-xs text-gray-500 mb-3">Created: {new Date(newerVersion.created_at).toLocaleString()}</p>
              
              {/* Diff is already rendered in the olderVersion column with highlights */}
               <div className="mb-4">
                <h5 className="font-medium mb-1">Prompt Text (Changes Highlighted):</h5>
                <div className="p-2 border rounded bg-gray-50 max-h-60 overflow-y-auto whitespace-pre-wrap">
                  {renderDiff(olderVersion.prompt_text, newerVersion.prompt_text)}
                </div>
              </div>
              <div className="mb-4">
                <h5 className="font-medium mb-1">Variables (Changes Highlighted):</h5>
                <div className="p-2 border rounded bg-gray-50 max-h-60 overflow-y-auto">
                  {renderJsonDiff(olderVersion.variables, newerVersion.variables)}
                </div>
              </div>
              <div className="mb-4">
                <h5 className="font-medium mb-1">Model Settings (Changes Highlighted):</h5>
                <div className="p-2 border rounded bg-gray-50 max-h-60 overflow-y-auto">
                  {renderJsonDiff(olderVersion.model_settings, newerVersion.model_settings)}
                </div>
              </div>
              <div>
                <h5 className="font-medium mb-1">Notes (Changes Highlighted):</h5>
                <div className="p-2 border rounded bg-gray-50 max-h-60 overflow-y-auto whitespace-pre-wrap">
                  {renderDiff(olderVersion.notes || '', newerVersion.notes || '')}
                </div>
              </div>
            </div>
          </div>

          <div className="items-center px-4 py-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionComparisonModal;