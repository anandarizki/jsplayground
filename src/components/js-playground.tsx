import { useState, useEffect, useCallback } from "react";
import JsEditor from "./js-editor";
import { debounce, loadFromStorage, saveToStorage } from "./helper";
import { atomWithStorage } from "jotai/utils";
import { useAtom } from "jotai";
import { Checkbox } from "./ui/checkbox";

const autoRunToggleAtom = atomWithStorage("jsPlaygroundAutoRun", true);

export function JsPlayground() {
  const [code, setCode] = useState('');
  const [output, setOutput] = useState("");
  const [autoRun, setAutoRun] = useAtom(autoRunToggleAtom);

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
      saveToStorage(code);
    } catch (error) {
      console.log('Error:')
      console.log(error);
    }

    console.log = oldLog;
  }, [code]);

  useEffect(() => {
    if (!autoRun) return;
    const debouncedRunCode = debounce(runCode, 1000);
    debouncedRunCode();
    return () => debouncedRunCode.cancel();
  }, [runCode, autoRun]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        if (!autoRun) {
          runCode();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [runCode, autoRun]);

  useEffect(() => {
    setCode(loadFromStorage());
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-300">
      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 h-full overflow-auto">
          <div className="h-full overflow-auto">
            <JsEditor code={code} setCode={setCode} />
          </div>
        </div>
        <div className="w-1/2 h-full overflow-auto bg-white border-l border-gray-300">
          <pre className="h-full font-mono text-sm text-gray-800 whitespace-pre-wrap p-4">
            {output}
          </pre>
        </div>
      </div>
      <footer className="p-2 bg-gray-800 text-xs text-gray-500 flex text-right">
        <div className="w-1/2 flex justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="auto-run"
              checked={autoRun}
              onClick={() => setAutoRun(!autoRun)}
            />
            <label
              htmlFor="auto-run"
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              <span className={autoRun ? undefined : "line-through"}>
                Auto Run
              </span>{" "}
              {autoRun ? "" : "(ctrl + s to execute, on mac use cmd + s)"}
            </label>
          </div>
        </div>
        <div className="w-1/2">
          © 2024 JSPlayground by{" "}
          <a href="https://rizki.id" target="_blank" className="underline">
            Ananda Rizki
          </a>{" "}
          |{" "}
          <a
            href="https://github.com/anandarizki/jsplayground"
            target="_blank"
            className="underline"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
