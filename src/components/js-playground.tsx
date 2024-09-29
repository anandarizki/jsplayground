import { atomWithStorage } from "jotai/utils";
import { Checkbox } from "./ui/checkbox";
import { debounce, loadFromStorage, saveToStorage } from "./helper";
import { useAtom } from "jotai";
import { useState, useEffect, useCallback, useMemo } from "react";
import JsEditor from "./js-editor";
import OutputPanel from "./output-panel";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./ui/resizable";
import { LayoutIcon } from "lucide-react";

const autoRunToggleAtom = atomWithStorage("jsPlaygroundAutoRun", true);
const layoutAtom = atomWithStorage<number>("jsPlaygroundLayout", 0);

const layout: {
  vertical: boolean;
  invertPosition: boolean;
}[] = [
  { vertical: false, invertPosition: false },
  { vertical: true, invertPosition: false },
  { vertical: false, invertPosition: true },
  { vertical: true, invertPosition: true },
];

export function JsPlayground() {
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [autoRun, setAutoRun] = useAtom(autoRunToggleAtom);
  const [duration, setDuration] = useState("");
  const [layoutMode, setLayoutMode] = useAtom(layoutAtom);

  const activeLayout = useMemo(() => {
    return layout[layoutMode];
  }, [layoutMode]);

  const runCode = useCallback(() => {
    let logMessages = "";
    const startTime = performance.now();
    // Override console.log to capture output
    const originalLog = console.log;
    console.log = (...args: any[]) => {
      logMessages += args.join(" ") + "\n";
      setOutput(logMessages); // Update the output state
    };

    const timeoutDuration = 100; // Set timeout duration in milliseconds (1 second)// Set timeout duration in milliseconds (1 second)
    const executionTimeout = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Execution timed out")),
        timeoutDuration
      )
    );

    const codeExecution = new Promise<void>((resolve) => {
      try {
        // Use eval to run the user-provided code
        eval(code);
        saveToStorage(code);
        resolve();
      } catch (error) {
        setOutput(`Error: ${(error as Error).message}`);
        resolve();
      }
    });

    Promise.race([executionTimeout, codeExecution])
      .then(() => {
        const endTime = performance.now(); // End time for measuring execution duration
        const duration = (endTime - startTime).toFixed(2); // Calculate duration in milliseconds
        setDuration(`${duration}ms`); // Display duration
      })
      .catch((error) => {
        setOutput(`Error: ${(error as Error).message}`);
      })
      .finally(() => {
        // Restore original console.log
        console.log = originalLog;
      });
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
      <ResizablePanelGroup
        direction={activeLayout.vertical ? "vertical" : "horizontal"}
        autoSaveId="panel"
      >
        <ResizablePanel>
          {activeLayout.invertPosition ? (
            <OutputPanel output={output} duration={duration} />
          ) : (
            <JsEditor code={code} setCode={setCode} />
          )}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel>
          {!activeLayout.invertPosition ? (
            <OutputPanel output={output} duration={duration} />
          ) : (
            <JsEditor code={code} setCode={setCode} />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
      <footer className="p-2 bg-gray-800 text-xs text-gray-500 flex text-right">
        <div className="flex-1 flex justify-between">
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
        <button
          onClick={() => {
            setLayoutMode((prev) => (prev + 1 < layout.length ? prev + 1 : 0));
          }}
        >
          <LayoutIcon size={20} />
        </button>
        <div className="flex-1">
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
