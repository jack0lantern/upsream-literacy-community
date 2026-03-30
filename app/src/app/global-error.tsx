"use client";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-6xl font-bold text-gray-200">500</h1>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            Something went wrong
          </h2>
          <p className="mt-2 text-gray-600">
            A critical error occurred. Please refresh the page.
          </p>
          <button
            onClick={() => unstable_retry()}
            className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
