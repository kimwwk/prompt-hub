'use client';

import { useState } from 'react';

interface PromptEditorProps {
  initialText: string;
  initialNotes?: string;
  onSave: (promptText: string, notes: string) => Promise<void>;
  onCancel: () => void;
  isNew?: boolean;
}

const PromptEditor: React.FC<PromptEditorProps> = ({
  initialText,
  initialNotes = '',
  onSave,
  onCancel,
  isNew = true
}) => {
  const [promptText, setPromptText] = useState<string>(initialText);
  const [notes, setNotes] = useState<string>(initialNotes);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [charCount, setCharCount] = useState<number>(initialText.length);
  
  // Track character count as user types
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPromptText(text);
    setCharCount(text.length);
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!promptText.trim()) {
      setError('Prompt text cannot be empty');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      await onSave(promptText, notes);
    } catch (err) {
      console.error('Error saving prompt:', err);
      setError(err instanceof Error ? err.message : 'Failed to save prompt');
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="bg-white shadow-sm rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">
        {isNew ? 'Create New Version' : 'Edit Prompt'}
      </h2>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="promptText" className="block text-gray-700 text-sm font-bold mb-2">
            Prompt Text <span className="text-red-500">*</span>
          </label>
          <textarea
            id="promptText"
            value={promptText}
            onChange={handlePromptChange}
            rows={10}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline font-mono"
            placeholder="Enter your prompt text here..."
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{charCount} characters</span>
            {charCount === 0 && <span className="text-red-500">Prompt text is required</span>}
          </div>
        </div>
        
        <div className="mb-6">
          <label htmlFor="notes" className="block text-gray-700 text-sm font-bold mb-2">
            Version Notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Describe what changed in this version..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Adding notes helps track the evolution of your prompt over time
          </p>
        </div>
        
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        
        <div className="flex space-x-2">
          <button
            type="submit"
            disabled={isSaving || !promptText.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving...' : isNew ? 'Save New Version' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default PromptEditor;