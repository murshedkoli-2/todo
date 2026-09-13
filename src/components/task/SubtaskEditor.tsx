"use client";

import {
  SubtaskStatus, TaskService, TaskSubtask,
  SERVICE_FIELDS, SERVICE_LABELS, SERVICE_DESCRIPTIONS,
  SERVICE_COLORS, SERVICE_TEXT_COLORS, SERVICE_ON_COLORS,
  TASK_SERVICES, missingFieldCount,
} from "@/lib/types";
import SubtaskFieldInput from "@/components/task/SubtaskFieldInput";
import SubtaskStatusControl from "@/components/task/SubtaskStatusControl";
import { CheckIcon } from "@/components/ui/icons";
import ServiceIcon from "@/components/ui/ServiceIcon";

interface SubtaskEditorProps {
  /** One row per ticked service, already in catalogue order. */
  subtasks: TaskSubtask[];
  onToggleService: (service: TaskService) => void;
  onFieldChange: (service: TaskService, key: string, value: string) => void;
  onStatusChange: (service: TaskService, status: SubtaskStatus) => void;
}

/**
 * The wizard's Services step: tick a job, then answer what that job asks for.
 *
 * Ticking and answering are one screen rather than two because they are one
 * decision — the questions only exist because of the tick, and a separate step
 * for them would be blank for anyone who ticked nothing, which is a real
 * fraction of tasks. Keeping them together also means the answer fields appear
 * the moment the box is checked, which is the whole affordance: it is visibly a
 * sub-task being opened, not a form growing for no reason.
 *
 * The picker stays a grid at the top and the sub-tasks stack underneath rather
 * than each tile expanding in place, because an expanding cell in a two-column
 * grid shoves its neighbour down and the row just clicked jumps away from the
 * cursor.
 */
export default function SubtaskEditor({
  subtasks, onToggleService, onFieldChange, onStatusChange,
}: SubtaskEditorProps) {
  const selected = new Set(subtasks.map((subtask) => subtask.service));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="field-label">
          Services <span className="font-normal text-ink-muted">(optional)</span>
        </span>
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-2"
          role="group"
          aria-label="Services"
        >
          {TASK_SERVICES.map((service) => {
            const active = selected.has(service);
            const color = SERVICE_COLORS[service];
            return (
              <button
                key={service}
                type="button"
                role="checkbox"
                aria-checked={active}
                /* Named by the label alone and described by the line under it.
                   Letting the button's own text supply the name would run the
                   two together into one long announcement. */
                aria-labelledby={`service-${service}-label`}
                aria-describedby={`service-${service}-desc`}
                onClick={() => onToggleService(service)}
                className="option-tile !flex-row !items-start !justify-start !text-left !py-3 !px-3.5 gap-3"
                data-selected={active}
                style={
                  active
                    ? {
                        background: `color-mix(in srgb, ${color} 12%, transparent)`,
                        borderColor: color,
                        color: "var(--text-primary)",
                      }
                    : undefined
                }
              >
                {/*
                  A real box rather than a tick that only appears when selected:
                  an empty square reads as "choosable", which is what makes the
                  row a multi-select at a glance instead of a radio.
                */}
                <span
                  className="w-4 h-4 mt-0.5 rounded-[5px] flex-shrink-0 flex items-center justify-center transition-colors duration-fast"
                  style={{
                    background: active ? color : "transparent",
                    border: `1.5px solid ${active ? color : "var(--border-hover)"}`,
                    color: SERVICE_ON_COLORS[service],
                  }}
                >
                  {active && <CheckIcon className="w-2.5 h-2.5" />}
                </span>

                {/* Service Icon tile */}
                <span
                  className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center transition-colors"
                  style={{
                    background: `color-mix(in srgb, ${color} ${active ? "20%" : "10%"}, transparent)`,
                    color: active ? SERVICE_TEXT_COLORS[service] : "var(--text-secondary)",
                  }}
                  aria-hidden="true"
                >
                  <ServiceIcon service={service} className="w-3.5 h-3.5" />
                </span>

                <span className="min-w-0">
                  <span
                    id={`service-${service}-label`}
                    className="block text-[13px] font-bold leading-tight"
                    style={{ color: active ? SERVICE_TEXT_COLORS[service] : "var(--text-primary)" }}
                  >
                    {SERVICE_LABELS[service]}
                  </span>
                  <span
                    id={`service-${service}-desc`}
                    className="block text-[11px] leading-snug mt-0.5 text-ink-muted"
                  >
                    {SERVICE_DESCRIPTIONS[service]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <span className="field-hint">
          {subtasks.length === 0
            ? "Pick every job this task covers — a customer often brings more than one. Each becomes a sub-task below."
            : `${subtasks.length} selected · each one is a sub-task below.`}
        </span>
      </div>

      {subtasks.length > 0 && (
        <div className="flex flex-col gap-3" data-testid="subtask-editor-list">
          <span className="field-label">Sub-tasks ({subtasks.length})</span>
          {subtasks.map((subtask, index) => (
            <SubtaskCard
              key={subtask.service}
              subtask={subtask}
              index={index}
              onFieldChange={onFieldChange}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SubtaskCardProps {
  subtask: TaskSubtask;
  index: number;
  onFieldChange: (service: TaskService, key: string, value: string) => void;
  onStatusChange: (service: TaskService, status: SubtaskStatus) => void;
}

function SubtaskCard({ subtask, index, onFieldChange, onStatusChange }: SubtaskCardProps) {
  const { service } = subtask;
  const color = SERVICE_COLORS[service];
  const definitions = SERVICE_FIELDS[service];
  const missing = missingFieldCount(subtask);

  return (
    <section
      className="well p-4 flex flex-col gap-3.5"
      aria-labelledby={`subtask-${service}-heading`}
      data-subtask={service}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex-shrink-0 flex items-center justify-center border shadow-xs mt-0.5"
            style={{
              background: `color-mix(in srgb, ${color} 14%, transparent)`,
              borderColor: `color-mix(in srgb, ${color} 28%, transparent)`,
              color: SERVICE_TEXT_COLORS[service],
            }}
            aria-hidden="true"
          >
            <ServiceIcon service={service} className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h3
              id={`subtask-${service}-heading`}
              className="text-[13px] font-bold leading-tight"
              style={{ color: SERVICE_TEXT_COLORS[service] }}
            >
              <span className="text-ink-muted font-normal">{index + 1}. </span>
              {SERVICE_LABELS[service]}
            </h3>
            <p className="text-[11px] mt-0.5 text-ink-muted">
              {missing === 0
                ? "Everything asked for has been filled in."
                : `${missing} of ${definitions.length} still blank — you can save and come back.`}
            </p>
          </div>
        </div>

        {/* Where this leg stands, settable while the task is still being
            written down: a fair number of these are recorded after the fact —
            two jobs already lodged, one still to start — and a form that could
            only say "done" or "not done" forced that in as a wrong answer. */}
        <SubtaskStatusControl
          value={subtask.status}
          onChange={(next) => onStatusChange(service, next)}
          name={SERVICE_LABELS[service]}
        />
      </div>

      {definitions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {definitions.map((definition) => (
            <SubtaskFieldInput
              key={definition.key}
              service={service}
              definition={definition}
              value={subtask.fields[definition.key] ?? ""}
              onChange={onFieldChange}
              idPrefix="subtask"
            />
          ))}
        </div>
      )}
    </section>
  );
}
