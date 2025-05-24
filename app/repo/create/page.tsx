'use client';

import { useState, FormEvent } from 'react';

export default function CreateRepositoryPage() {
  const [repoName, setRepoName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{ repoName?: string; description?: string; api?: string }>({});
  const [formMessage, setFormMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: { repoName?: string; description?: string } = {};
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

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setFormMessage('');
    setIsSubmitting(true);

    if (validateForm()) {
      try {
        const response = await fetch('/api/repo/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ repoName, description }),
        });

        const result = await response.json();

        if (response.ok) {
          setFormMessage(result.message || 'Repository created successfully!');
          setRepoName('');
          setDescription('');
          // Optionally, redirect or perform other actions on success
        } else {
          setErrors({ api: result.error || 'An unknown error occurred.' });
          setFormMessage('Failed to create repository. Please try again.');
        }
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
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 text-center">Create New Prompt Repository</h1>
      <form onSubmit={handleSubmit} className="space-y-6 bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div>
          <label htmlFor="repoName" className="block text-gray-700 text-sm font-bold mb-2">
            Repository Name
          </label>
          <input
            type="text"
            id="repoName"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${errors.repoName ? 'border-red-500' : ''}`}
            aria-describedby="repoNameError"
          />
          {errors.repoName && (
            <p id="repoNameError" className="text-red-500 text-xs italic mt-1">{errors.repoName}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-gray-700 text-sm font-bold mb-2">
            Description (Optional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${errors.description ? 'border-red-500' : ''}`}
            aria-describedby="descriptionError"
          />
          {errors.description && (
            <p id="descriptionError" className="text-red-500 text-xs italic mt-1">{errors.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Repository'}
          </button>
        </div>

        {errors.api && (
          <p className="text-red-500 text-xs italic mt-4">API Error: {errors.api}</p>
        )}
        {formMessage && !errors.api && ( // Only show general form message if no API error
          <p className={`text-sm mt-4 ${Object.keys(errors).length > 0 && !errors.api ? 'text-red-500' : 'text-green-500'}`}>
            {formMessage}
          </p>
        )}
      </form>
    </div>
  );
}