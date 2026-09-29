import { useState } from "react";
import tables from "./result-tables.json";

export default function ResultTables() {
  const [index, setIndex] = useState(0);
  const table = tables[index];
  return (
    <div className="paper-results">
      <div
        className="filters result-tabs"
        role="tablist"
        aria-label="Paper results tables"
      >
        {tables.map((t, i) => (
          <button
            key={t.number}
            id={`table-tab-${t.number}`}
            role="tab"
            aria-selected={index === i}
            aria-controls="paper-table"
            tabIndex={index === i ? 0 : -1}
            onClick={() => setIndex(i)}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tables.length - 1
                    : (i +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        tables.length) %
                      tables.length;
              setIndex(next);
              document
                .getElementById(`table-tab-${tables[next].number}`)
                ?.focus();
            }}
          >
            {t.title}
          </button>
        ))}
      </div>
      <div
        id="paper-table"
        role="tabpanel"
        aria-labelledby={`table-tab-${table.number}`}
      >
        <h3>{table.title} results</h3>
        <div
          className="table-scroll"
          tabIndex={0}
          aria-label={`${table.title} results, scroll horizontally for all metrics`}
        >
          <table>
            <thead>
              <tr>
                {table.headers.map((h) => (
                  <th scope="col" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr
                  key={i}
                  className={row[0].text.includes("Astra") ? "agent-row" : ""}
                >
                  {row.map((cell, j) =>
                    j === 0 ? (
                      <th key={j} scope="row">
                        {cell.paperUrl ? (
                          <a
                            className="method-paper"
                            href={cell.paperUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open paper PDF in a new tab"
                          >
                            {cell.text}
                          </a>
                        ) : (
                          cell.text
                        )}
                      </th>
                    ) : (
                      <td key={j}>
                        {cell.bold ? <strong>{cell.text}</strong> : cell.text}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="table-note">{table.note}</p>
      </div>
    </div>
  );
}
