import { useState, useEffect, useCallback } from "react";
import JsEditor from "./js-editor";
import { debounce, loadFromStorage, saveToStorage } from "./helper";

const storageKey = "jsPlaygroundCode";

export function JsPlayground() {
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");

  const runCode = useCallback(() => {
    setOutput("");
    const oldLog = console.log;
    console.log = (...args) => {
      setOutput(
        (prev) =>
          prev +
          args
            .map((arg) =>
              typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg
            )
            .join(" ") +
          "\n"
      );
    };

    try {
      // eslint-disable-next-line no-eval
      eval(code);
    } catch (error) {
      console.log("Error:", error);
    }

    console.log = oldLog;
    saveToStorage(storageKey, code);
  }, [code]);

  useEffect(() => {
    const debouncedRunCode = debounce(runCode, 1000);
    debouncedRunCode();
    return () => debouncedRunCode.cancel();
  }, [runCode]);

  useEffect(() => {
    setCode(
      loadFromStorage(storageKey) ||
        "//Write you js code here\nconsole.log('Hello world!')"
    );
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-300">
      <h1 className="text-md font-bold py-2 px-3 bg-gray-800">
        JavaScript Playground
      </h1>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 h-full overflow-auto p-4">
          <JsEditor code={code} setCode={setCode} />
        </div>
        <div className="w-1/2 h-full overflow-auto bg-white border-l border-gray-300">
          <pre className="h-full font-mono text-sm text-gray-800 whitespace-pre-wrap p-4">
            {output}
          </pre>
        </div>
      </div>
      <footer className="p-2 bg-gray-800 text-center text-xs text-gray-500">
        © 2024 JavaScript Playground by{" "}
        <a href="https://rizki.id" target="_blank">
          Ananda Rizki
        </a>
      </footer>
    </div>
  );
}
