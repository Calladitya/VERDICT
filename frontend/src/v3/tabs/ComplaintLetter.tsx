
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, download } from "../api";
import {
  Btn,
  CasePicker,
  DISCLAIMER,
  ErrorBox,
  Field,
  inputCls,
  Panel,
  SpeakButton,
  Spinner,
} from "../ui";

type FieldDef = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
};

type DraftType = {
  key: string;
  label: string;
  fields: FieldDef[];
};

type NavigationState = {
  draftType?: string;
};

export default function ComplaintLetter({
  language,
}: {
  language: string;
}) {
  const location = useLocation();

  const [types, setTypes] = useState<DraftType[]>([]);
  const [sel, setSel] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [caseId, setCaseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const navigationState = location.state as NavigationState | null;
  const requestedType = navigationState?.draftType;

  useEffect(() => {
    let cancelled = false;

    async function loadTypes() {
      try {
        const response = await api<{ types: DraftType[] }>(
          "/api/v3/draft/types",
        );

        if (cancelled) return;

        setTypes(response.types);

        const requested = requestedType?.trim().toLowerCase();

        const matchedType = requested
          ? response.types.find(
              (type) =>
                type.key.toLowerCase() === requested ||
                type.label.toLowerCase() === requested ||
                type.label.toLowerCase().includes(requested),
            )
          : undefined;

        setSel(matchedType?.key || response.types[0]?.key || "");
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load draft types.",
          );
        }
      }
    }

    void loadTypes();

    return () => {
      cancelled = true;
    };
  }, [requestedType]);

  const spec = types.find((type) => type.key === sel);

  const generate = async () => {
    setError(null);
    setNote(null);
    setBusy(true);

    try {
      const response = await api<{ title: string; text: string }>(
        "/api/v3/draft/generate",
        {
          json: {
            doc_type: sel,
            fields: vals,
            language,
          },
        },
      );

      setText(response.text);
      setTitle(response.title);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create the draft.",
      );
    } finally {
      setBusy(false);
    }
  };

  const exportAs = async (format: "docx" | "pdf") => {
    setError(null);

    try {
      await download(
        "/api/v3/export",
        `${title || "letter"}.${format}`,
        {
          title: title || "Letter",
          text,
          format,
        },
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not export the draft.",
      );
    }
  };

  const saveToCase = async () => {
    if (!caseId) return;

    setError(null);

    try {
      await api(`/api/v3/cases/${caseId}/documents/text`, {
        json: {
          filename: `${title || "Draft"}.txt`,
          text,
          kind: "draft",
        },
      });

      setNote("Saved to the case documents.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save the draft.",
      );
    }
  };

  return (
    <div className="space-y-4">
      <Panel title="Draft a letter or application">
        <div className="space-y-3">
          <Field label="What do you need?">
            <select
              value={sel}
              onChange={(event) => {
                setSel(event.target.value);
                setVals({});
                setText("");
                setTitle("");
              }}
              className={inputCls}
            >
              {types.map((type) => (
                <option key={type.key} value={type.key}>
                  {type.label}
                </option>
              ))}
            </select>
          </Field>

          {spec?.fields.map((field) => (
            <Field
              key={field.key}
              label={field.label + (field.required ? " *" : "")}
            >
              {field.type === "textarea" ? (
                <textarea
                  rows={3}
                  className={inputCls}
                  value={vals[field.key] || ""}
                  placeholder={field.placeholder}
                  onChange={(event) =>
                    setVals((previous) => ({
                      ...previous,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              ) : (
                <input
                  type={
                    field.type === "date"
                      ? "date"
                      : field.type === "number"
                        ? "number"
                        : "text"
                  }
                  className={inputCls}
                  value={vals[field.key] || ""}
                  placeholder={field.placeholder}
                  onChange={(event) =>
                    setVals((previous) => ({
                      ...previous,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              )}
            </Field>
          ))}

          <div className="flex items-center gap-3">
            <Btn onClick={generate} disabled={busy || !sel}>
              Create draft
            </Btn>
            {busy && <Spinner label="Drafting..." />}
          </div>

          <ErrorBox message={error} />
        </div>
      </Panel>

      {text && (
        <Panel
          title={`${title} (edit before using)`}
          right={<SpeakButton text={text} language={language} />}
        >
          <textarea
            rows={18}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className={inputCls + " font-serif leading-relaxed"}
          />

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Btn onClick={() => exportAs("docx")}>Download Word</Btn>

            <Btn variant="ghost" onClick={() => exportAs("pdf")}>
              Download PDF
            </Btn>

            <div className="ml-auto flex items-end gap-2">
              <div className="w-56">
                <CasePicker
                  value={caseId}
                  onChange={setCaseId}
                  label="Save copy to case"
                />
              </div>

              <Btn
                variant="ghost"
                onClick={saveToCase}
                disabled={!caseId}
              >
                Save
              </Btn>
            </div>
          </div>

          {note && <p className="mt-2 text-sm text-green-700">{note}</p>}

          <p className="mt-2 text-xs text-slate-500">
            Replace every [PLACEHOLDER], check names, dates and amounts. For
            Hindi or other Indian languages, prefer the Word download (PDF may
            not show all characters correctly). {DISCLAIMER}
          </p>
        </Panel>
      )}
    </div>
  );
}
