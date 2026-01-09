"use client";

import { useEffect, useState } from "react";

export default function FormValidatorPage() {
  const [formInput, setFormInput] = useState(
    JSON.stringify(
      {
        fields: [
          { name: "email", type: "email", required: true },
          { name: "password", type: "password", required: true },
        ],
      },
      null,
      2
    )
  );

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [isValidJson, setIsValidJson] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({});
  const [formatLang, setFormatLang] = useState<string>("json");

  // validate JSON as user types
  useEffect(() => {
    if (!formInput.trim()) {
      setIsValidJson(false);
      setJsonError("Empty input");
      return;
    }
    try {
      JSON.parse(formInput);
      setIsValidJson(true);
      setJsonError("");
    } catch (e: any) {
      setIsValidJson(false);
      setJsonError(e.message ?? "Invalid JSON");
    }
  }, [formInput]);

  const handleSubmit = async () => {
    if (!isValidJson) {
      setJsonError("Fix JSON before submitting");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/form-validator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: formInput }),
      });
      const data = await res.json();

      if (data.error) {
        setError(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      } else {
        setResult(data);
        // open all sections by default and reset copy status
        const sections = {
          "Validation Rules": !!data.validationRules?.length,
          Accessibility: !!data.accessibility?.length,
          "UX Suggestions": !!data.uxSuggestions?.length,
          "Edge Cases": !!data.edgeCases?.length,
        } as Record<string, boolean>;
        setOpenSections(sections);
        setCopyStatus({});
      }
    } catch (err) {
      setError("Server error");
    } finally {
      setLoading(false);
    }
  };

  const samples = [
    {
      label: "Simple auth form",
      value: JSON.stringify(
        {
          fields: [
            { name: "email", type: "email", required: true },
            { name: "password", type: "password", required: true },
          ],
        },
        null,
        2
      ),
    },
    {
      label: "Profile form",
      value: JSON.stringify(
        {
          fields: [
            { name: "firstName", type: "text", required: true },
            { name: "lastName", type: "text" },
            { name: "phone", type: "tel" },
          ],
        },
        null,
        2
      ),
    },
  ];

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
  };

  const copySection = async (title: string, data: string[]) => {
    if (!data || data.length === 0) return;
    await navigator.clipboard.writeText(data.join("\n"));
    setCopyStatus((s) => ({ ...s, [title]: true }));
    setTimeout(() => setCopyStatus((s) => ({ ...s, [title]: false })), 1500);
  };

  const expandAll = () => setOpenSections((s) => Object.fromEntries(Object.keys(s).map((k) => [k, true])));
  const collapseAll = () => setOpenSections({});

  const formatCode = () => {
    if (formatLang === "json") {
      try {
        const parsed = JSON.parse(formInput);
        setFormInput(JSON.stringify(parsed, null, 2));
        setJsonError("");
      } catch (e: any) {
        setJsonError(e.message ?? "Invalid JSON");
      }
      return;
    }
    const fence = "```" + (formatLang === "text" ? "" : formatLang) + "\n";
    const trimmed = formInput.trim();
    const fenceStart = trimmed.startsWith("```");
    if (fenceStart) {
      const inner = trimmed.replace(/^```[\s\S]*?\n/, "").replace(/\n```$/, "");
      setFormInput(fence + inner.trim() + "\n```\n");
    } else {
      setFormInput(fence + trimmed + "\n```\n");
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">AI Form Validator</h1>

      <div className="flex gap-2 items-start mb-2">
        <select className="border p-2 rounded" onChange={(e) => setFormInput(e.target.value)} defaultValue="">
          <option value="">Load sample...</option>
          {samples.map((s, idx) => (
            <option value={s.value} key={idx}>
              {s.label}
            </option>
          ))}
        </select>

        <button className="ml-auto text-sm text-gray-600 underline" onClick={() => setFormInput("")}>
          Clear
        </button>
      </div>

      <textarea rows={10} className="w-full p-2 border rounded mb-2 font-mono" value={formInput} onChange={(e) => setFormInput(e.target.value)} />

      <div className="flex items-center gap-3 mb-4">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
          onClick={handleSubmit}
          disabled={loading || !isValidJson}
          aria-disabled={loading || !isValidJson}
        >
          {loading ? "Validating..." : "Validate Form"}
        </button>

        <select className="border p-2 rounded text-sm" value={formatLang} onChange={(e) => setFormatLang(e.target.value)}>
          <option value="json">JSON</option>
          <option value="javascript">JavaScript</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="text">Plain text</option>
        </select>

        <button className="border px-3 py-2 rounded text-sm" onClick={formatCode}>
          Format Code
        </button>

        <button className="border px-3 py-2 rounded text-sm" onClick={() => {
          try {
            const parsed = JSON.parse(formInput);
            setFormInput(JSON.stringify(parsed, null, 2));
            setJsonError("");
          } catch (e: any) {
            setJsonError(e.message ?? "Invalid JSON");
          }
        }}>
          Prettify JSON
        </button>
      </div>

      {jsonError && <p className="text-red-500">JSON error: {jsonError}</p>}
      {error && <p className="text-red-500">{error}</p>}

      {result && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Result</h2>
            <div className="flex gap-2">
              <button className="border px-2 py-1 rounded text-sm" onClick={copyResult}>
                Copy JSON
              </button>
              <button className="border px-2 py-1 rounded text-sm" onClick={expandAll}>
                Expand All
              </button>
              <button className="border px-2 py-1 rounded text-sm" onClick={collapseAll}>
                Collapse All
              </button>
            </div>
          </div>

          <ResultSectionCollapsible
            title="Validation Rules"
            data={result.validationRules}
            open={!!openSections["Validation Rules"]}
            onToggle={() => setOpenSections((s) => ({ ...s, ["Validation Rules"]: !s["Validation Rules"] }))}
            onCopy={() => copySection("Validation Rules", result.validationRules)}
            copied={!!copyStatus["Validation Rules"]}
          />

          <ResultSectionCollapsible
            title="Accessibility"
            data={result.accessibility}
            open={!!openSections["Accessibility"]}
            onToggle={() => setOpenSections((s) => ({ ...s, Accessibility: !s["Accessibility"] }))}
            onCopy={() => copySection("Accessibility", result.accessibility)}
            copied={!!copyStatus["Accessibility"]}
          />

          <ResultSectionCollapsible
            title="UX Suggestions"
            data={result.uxSuggestions}
            open={!!openSections["UX Suggestions"]}
            onToggle={() => setOpenSections((s) => ({ ...s, ["UX Suggestions"]: !s["UX Suggestions"] }))}
            onCopy={() => copySection("UX Suggestions", result.uxSuggestions)}
            copied={!!copyStatus["UX Suggestions"]}
          />

          <ResultSectionCollapsible
            title="Edge Cases"
            data={result.edgeCases}
            open={!!openSections["Edge Cases"]}
            onToggle={() => setOpenSections((s) => ({ ...s, ["Edge Cases"]: !s["Edge Cases"] }))}
            onCopy={() => copySection("Edge Cases", result.edgeCases)}
            copied={!!copyStatus["Edge Cases"]}
          />
        </div>
      )}
    </div>
  );
}

function ResultSectionCollapsible({
  title,
  data,
  open,
  onToggle,
  onCopy,
  copied,
}: {
  title: string;
  data: string[];
  open: boolean;
  onToggle: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  if (!data || data.length === 0) return null;
  return (
    <div className="border rounded p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="text-left font-medium" onClick={onToggle} aria-expanded={open}>
            {title}
          </button>
          <span className="text-sm bg-gray-100 px-2 py-1 rounded">{data.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-sm" onClick={onCopy} aria-label={`Copy ${title}`}>
            Copy
          </button>
          {copied && <span className="text-sm text-green-600">Copied!</span>}
          <button className="text-sm text-gray-600" onClick={onToggle}>
            {open ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
      {open && (
        <ul className="list-disc list-inside mt-2">
          {data.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

