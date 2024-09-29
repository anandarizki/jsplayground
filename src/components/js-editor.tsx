import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/themes/prism-tomorrow.css";

export default function JsEditor({
  code,
  setCode,
}: {
  code: string;
  setCode: (code: string) => void;
}) {
  return (
    <div className="h-full overflow-auto flex flex-row">
      <Editor
        value={code}
        onValueChange={setCode}
        highlight={(code) =>
          highlight(code || " ", languages.javascript, "javascript")
        }
        padding={20}
        style={{
          fontFamily: '"Fira code", "Fira Mono", monospace',
          fontSize: 13,
          height: "100%", // Ensure it takes full height of the parent
          overflow: "auto", // Ensure overflow is set for scrolling
        }}
        textareaClassName="focus:outline-none"
        className="h-full w-full" // Ensure the editor takes full height
      />
    </div>
  );
}
