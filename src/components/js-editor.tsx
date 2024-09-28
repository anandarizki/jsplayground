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
    <Editor
      value={code}
      onValueChange={setCode}
      highlight={(code) =>
        highlight(code || " ", languages.javascript, "javascript")
      }
      padding={10}
      style={{
        fontFamily: '"Fira code", "Fira Mono", monospace',
        fontSize: 14,
        backgroundColor: "transparent",
        height: "100%",
      }}
      textareaClassName="focus:outline-none"
      className="h-full"
    />
  );
}
