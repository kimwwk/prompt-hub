'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Tag {
  value: string;
  label: string;
}

interface ModelType {
  value: string;
  label: string;
}

// Common AI models as options
const MODEL_OPTIONS: ModelType[] = [
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'claude-2', label: 'Claude 2' },
  { value: 'claude-instant', label: 'Claude Instant' },
  { value: 'llama-2', label: 'Llama 2' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'other', label: 'Other' }
];

// Common tag categories
const COMMON_TAGS: Tag[] = [
  { value: 'productivity', label: 'Productivity' },
  { value: 'writing', label: 'Writing' },
  { value: 'coding', label: 'Coding' },
  { value: 'creative', label: 'Creative' },
  { value: 'education', label: 'Education' },
  { value: 'business', label: 'Business' },
  { value: 'marketing', label: 'Marketing' }
];

export default function CreateRepositoryPage() {
  const router = useRouter();
  const [repoName, setRepoName] = useState('');
  const [description, setDescription] = useState('');
  const [promptText, setPromptText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [errors, setErrors] = useState<{ 
    repoName?: string; 
    description?: string; 
    promptText?: string;
    api?: string 
  }>({});
  const [formMessage, setFormMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [includeInitialPrompt, setIncludeInitialPrompt] = useState(true);
  const [isPublic, setIsPublic] = useState(true);

  // Handle tag selection
  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag) 
        : [...prev, tag]
    );
  };

  // Handle adding custom tag
  const handleAddCustomTag = () => {
    if (customTag && !selectedTags.includes(customTag)) {
      setSelectedTags(prev => [...prev, customTag]);
      setCustomTag('');
    }
  };

  // Handle model selection
  const handleModelToggle = (model: string) => {
    setSelectedModels(prev => 
      prev.includes(model) 
        ? prev.filter(m => m !== model) 
        : [...prev, model]
    );
  };

  // Handle adding custom model
  const handleAddCustomModel = () => {
    if (customModel && !selectedModels.includes(customModel)) {
      setSelectedModels(prev => [...prev, customModel]);
      setCustomModel('');
    }
  };

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: { 
      repoName?: string; 
      description?: string; 
      promptText?: string;
    } = {};
    let isValid = true;

    if (!repoName.trim()) {
      newErrors.repoName = 'Repository name is required.';
      isValid = false;
    } else if (repoName.trim().length > 100) {
      newErrors.repoName = 'Repository name cannot exceed 100 characters.';
      isValid = false;
    }

    if (description.trim().length > 500) {
      newErrors.description = 'Description cannot exceed 500 characters.';
      isValid = false;
    }

    if (includeInitialPrompt && !promptText.trim()) {
      newErrors.promptText = 'Prompt text is required when creating an initial version.';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  // Form submission
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setFormMessage('');
    setIsSubmitting(true);

    if (validateForm()) {
      try {
        // Step 1: Create the repository
        const repoResponse = await fetch('/api/repo/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            repoName, 
            description,
            tags: selectedTags.length > 0 ? selectedTags : null,
            model_compatibility: selectedModels.length > 0 ? selectedModels : null,
            is_public: isPublic
          }),
        });

        const repoResult = await repoResponse.json();

        if (!repoResponse.ok) {
          setErrors({ api: repoResult.error || 'An unknown error occurred creating the repository.' });
          setFormMessage('Failed to create repository. Please try again.');
          setIsSubmitting(false);
          return;
        }

        const newRepoId = repoResult.data.id;

        // Step 2: If user chose to include an initial prompt version, create it
        if (includeInitialPrompt && promptText.trim()) {
          const versionResponse = await fetch(`/api/repositories/${newRepoId}/versions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt_text: promptText,
              notes: 'Initial version'
            }),
          });

          const versionResult = await versionResponse.json();

          if (!versionResponse.ok) {
            // Repository was created but version creation failed
            setFormMessage('Repository created successfully, but failed to create the initial prompt version.');
            setErrors({ api: versionResult.error || 'An unknown error occurred creating the initial version.' });
            
            // Still redirect after a delay, since the repo was created
            setTimeout(() => {
              router.push(`/repo/${newRepoId}`);
            }, 3000);
            
            return;
          }
        }

        // Success! Redirect to the new repository page
        setFormMessage('Repository created successfully!');
        setTimeout(() => {
          router.push(`/repo/${newRepoId}`);
        }, 1000);
      } catch (error) {
        console.error('Submission error:', error);
        setErrors({ api: 'An error occurred while submitting the form.' });
        setFormMessage('An unexpected error occurred. Please try again.');
      }
    } else {
      setFormMessage('Please correct the errors above.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6 text-center">Create New Prompt Repository</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6 bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        {/* Repository Name */}
        <div>
          <label htmlFor="repoName" className="block text-gray-700 text-sm font-bold mb-2">
            Repository Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="repoName"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${errors.repoName ? 'border-red-500' : ''}`}
            placeholder="e.g., JavaScript Code Helper"
            aria-describedby="repoNameError"
          />
          {errors.repoName && (
            <p id="repoNameError" className="text-red-500 text-xs italic mt-1">{errors.repoName}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-gray-700 text-sm font-bold mb-2">
            Description (Optional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${errors.description ? 'border-red-500' : ''}`}
            placeholder="A brief description of what this prompt does..."
            aria-describedby="descriptionError"
          />
          {errors.description && (
            <p id="descriptionError" className="text-red-500 text-xs italic mt-1">{errors.description}</p>
          )}
          <p className="text-gray-500 text-xs mt-1">{description.length}/500 characters</p>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Tags (Optional)
          </label>
          <div className="mb-2 flex flex-wrap gap-2">
            {COMMON_TAGS.map(tag => (
              <button
                key={tag.value}
                type="button"
                onClick={() => handleTagToggle(tag.value)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedTags.includes(tag.value)
                    ? 'bg-purple-100 text-purple-800 border border-purple-300'
                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
          <div className="flex">
            <input
              type="text"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              placeholder="Add custom tag..."
              className="shadow appearance-none border rounded-l w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
            <button
              type="button"
              onClick={handleAddCustomTag}
              disabled={!customTag.trim()}
              className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-r focus:outline-none focus:shadow-outline disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {selectedTags.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-gray-700 mb-1">Selected tags:</p>
              <div className="flex flex-wrap gap-1">
                {selectedTags.map(tag => (
                  <span key={tag} className="bg-purple-100 text-purple-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded flex items-center">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleTagToggle(tag)}
                      className="ml-1 text-purple-600 hover:text-purple-900"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Model Compatibility */}
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Model Compatibility (Optional)
          </label>
          <div className="mb-2 flex flex-wrap gap-2">
            {MODEL_OPTIONS.map(model => (
              <button
                key={model.value}
                type="button"
                onClick={() => handleModelToggle(model.value)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedModels.includes(model.value)
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                {model.label}
              </button>
            ))}
          </div>
          <div className="flex">
            <input
              type="text"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="Add custom model..."
              className="shadow appearance-none border rounded-l w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
            <button
              type="button"
              onClick={handleAddCustomModel}
              disabled={!customModel.trim()}
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-r focus:outline-none focus:shadow-outline disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {selectedModels.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-gray-700 mb-1">Selected models:</p>
              <div className="flex flex-wrap gap-1">
                {selectedModels.map(model => (
                  <span key={model} className="bg-green-100 text-green-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded flex items-center">
                    {model}
                    <button
                      type="button"
                      onClick={() => handleModelToggle(model)}
                      className="ml-1 text-green-600 hover:text-green-900"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Privacy Settings */}
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Privacy Settings
          </label>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isPublic"
              checked={isPublic}
              onChange={() => setIsPublic(!isPublic)}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-700">
              Make this repository public (visible to everyone)
            </label>
          </div>
        </div>

        {/* Initial Prompt */}
        <div>
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="includeInitialPrompt"
              checked={includeInitialPrompt}
              onChange={() => setIncludeInitialPrompt(!includeInitialPrompt)}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label htmlFor="includeInitialPrompt" className="ml-2 block text-sm font-medium text-gray-700">
              Include initial prompt version
            </label>
          </div>
          
          {includeInitialPrompt && (
            <div>
              <label htmlFor="promptText" className="block text-gray-700 text-sm font-bold mb-2">
                Prompt Text <span className="text-red-500">*</span>
              </label>
              <textarea
                id="promptText"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                rows={6}
                className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline font-mono ${errors.promptText ? 'border-red-500' : ''}`}
                placeholder="Enter your prompt text here..."
                aria-describedby="promptTextError"
              />
              {errors.promptText && (
                <p id="promptTextError" className="text-red-500 text-xs italic mt-1">{errors.promptText}</p>
              )}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-between">
          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline disabled:opacity-50 transition-colors"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Repository'}
          </button>
        </div>

        {/* Error and Form Messages */}
        {errors.api && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mt-4" role="alert">
            <span className="block sm:inline">API Error: {errors.api}</span>
          </div>
        )}
        
        {formMessage && !errors.api && (
          <div className={`px-4 py-3 rounded relative mt-4 ${Object.keys(errors).length > 0 && !errors.api ? 'bg-yellow-50 border border-yellow-200 text-yellow-700' : 'bg-green-50 border border-green-200 text-green-700'}`} role="alert">
            <span className="block sm:inline">{formMessage}</span>
          </div>
        )}
      </form>
    </div>
  );
}