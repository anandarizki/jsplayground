export default function OutputPanel({
  output,
  duration,
}: {
  output: string;
  duration: string;
}) {
  return (
    <div className="h-full relative  bg-white border-l border-gray-300">
      <pre className="h-full font-mono overflow-auto text-sm text-gray-800 whitespace-pre-wrap p-4">
        {output}
      </pre>
      {duration && (
        <span className="absolute font-mono text-xs right-2 bottom-2 text-gray-500">
          {duration}
        </span>
      )}
    </div>
  );
}
