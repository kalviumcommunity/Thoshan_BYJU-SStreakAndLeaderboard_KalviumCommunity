import React, { useState } from 'react';
import SubmitButton from './components/SubmitButton';

export const FormComponent = () => {
  const [formData, setFormData] = useState({ username: '' });

  const handleApiSubmit = async () => {
    // Existing API call function remains untouched
    await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
  };

  return (
    <form className="p-4 space-y-4">
      <input
        type="text"
        value={formData.username}
        onChange={(e) => setFormData({ username: e.target.value })}
        placeholder="Enter username"
        className="border p-2 rounded"
      />
      
      <SubmitButton
        onSubmitHandler={handleApiSubmit}
        isValid={formData.username.trim().length > 0}
        buttonText="Submit Data"
        loadingText="Saving..."
      />
    </form>
  );
};