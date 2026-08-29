import React, { useState } from 'react';

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onSubmitHandler: () => Promise<void>;
  buttonText?: string;
  loadingText?: string;
  isValid?: boolean;
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({
  onSubmitHandler,
  buttonText = 'Submit',
  loadingText = 'Submitting...',
  isValid = true,
  className = '',
  disabled,
  ...props
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isSubmitting || !isValid || disabled) return;

    setIsSubmitting(true);
    try {
      // Executes existing async frontend logic without altering backend API requests
      await onSubmitHandler();
    } catch (error) {
      console.error('Submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isButtonDisabled = disabled || !isValid || isSubmitting;

  return (
    <button
      {...props}
      onClick={handleClick}
      disabled={isButtonDisabled}
      className={`relative inline-flex items-center justify-center px-5 py-2.5 rounded-lg font-medium text-white transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
        isButtonDisabled
          ? 'bg-gray-400 cursor-not-allowed opacity-70 shadow-none'
          : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-md hover:shadow-lg'
      } ${className}`}
    >
      {isSubmitting ? (
        <span className="flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span>{loadingText}</span>
        </span>
      ) : (
        <span>{buttonText}</span>
      )}
    </button>
  );
};

export default SubmitButton;