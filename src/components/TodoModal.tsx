"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Todo } from "@/lib/types";
import Image from "next/image";

interface TodoModalProps {
  todo?: Todo | null;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    status: string;
    dueDate: string;
    images: string[];
    featureImage: string;
  }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const MAX_IMAGES = 8;

export default function TodoModal({ todo, onClose, onSave, onDelete }: TodoModalProps) {
  const [title, setTitle]             = useState(todo?.title ?? "");
  const [description, setDescription] = useState(todo?.description ?? "");
  const [status, setStatus]           = useState<string>(todo?.status ?? "todo");
  const [dueDate, setDueDate]         = useState(todo?.dueDate ? todo.dueDate.slice(0, 10) : "");
  const [images, setImages]           = useState<string[]>(todo?.images ?? []);
  const [featureImage, setFeatureImage] = useState<string>(todo?.featureImage ?? "");
  const [saving, setSaving]           = useState(false);
  const [isDeleting, setIsDeleting]   = useState(false);
  const [error, setError]             = useState("");
  const [uploadingCount, setUploadingCount] = useState(0);
  const [dragging, setDragging]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Upload one file → return URL string
  const uploadFile = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed.");
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Each image must be under 5 MB.");
      return null;
    }
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Upload failed");
      return null;
    }
    const data = await res.json();
    return data.url as string;
  };

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      const remaining = MAX_IMAGES - images.length;
      if (remaining <= 0) { setError(`Maximum ${MAX_IMAGES} images allowed.`); return; }
      const toUpload = arr.slice(0, remaining);
      if (arr.length > remaining) setError(`Only ${remaining} more image(s) can be added.`);
      setUploadingCount((n) => n + toUpload.length);
      setError("");
      const results = await Promise.all(toUpload.map(uploadFile));
      const urls = results.filter(Boolean) as string[];
      setImages((prev) => {
        const next = [...prev, ...urls];
        // Auto-set first uploaded as feature image
        if (!featureImage && urls[0]) setFeatureImage(urls[0]);
        return next;
      });
      setUploadingCount((n) => n - toUpload.length);
    },
    [images.length, featureImage]
  );

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) await handleFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) await handleFiles(e.dataTransfer.files);
  };

  const removeImage = (url: string) => {
    setImages((prev) => prev.filter((u) => u !== url));
    if (featureImage === url) {
      const next = images.find((u) => u !== url);
      setFeatureImage(next ?? "");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    if (uploadingCount > 0) { setError("Please wait for uploads to finish."); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({ title, description, status, dueDate, images, featureImage });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!todo || !onDelete) return;
    setIsDeleting(true);
    setError("");
    try {
      await onDelete(todo._id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setIsDeleting(false);
    }
  };

  const labelStyle: React.CSSProperties = { color: "var(--text-secondary)", fontSize: "13px", fontWeight: 500 };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="modal-box w-full max-w-2xl"
        style={{ maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-5 pb-4 sticky top-0 z-10"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}
        >
          <h2
            id="modal-title"
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {todo ? "Edit Task" : "New Task"}
          </h2>
          <button
            onClick={onClose}
            className="btn-ghost w-8 h-8 p-0 rounded-lg"
            aria-label="Close modal"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-5">
          {error && (
            <div
              className="px-4 py-3 rounded-lg text-sm animate-fade-in"
              style={{
                background: "rgba(248,81,73,0.1)",
                border: "1px solid rgba(248,81,73,0.3)",
                color: "var(--red)",
              }}
            >
              {error}
            </div>
          )}

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="todo-title" style={labelStyle}>
              Title <span style={{ color: "var(--red)" }}>*</span>
            </label>
            <input
              id="todo-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="input-dark"
              maxLength={200}
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="todo-description" style={labelStyle}>
              Description
              <span className="ml-1" style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              id="todo-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add some details…"
              className="input-dark resize-none h-20"
              maxLength={2000}
            />
          </div>

          {/* Status + Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="todo-status" style={labelStyle}>Status</label>
              <select
                id="todo-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input-dark"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="todo-due-date" style={labelStyle}>
                Due date
                <span className="ml-1" style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="todo-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input-dark"
                style={{ colorScheme: "dark" }}
              />
            </div>
          </div>

          {/* ── Images Section ─────────────────────────── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label style={labelStyle}>
                Images
                <span className="ml-1" style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                  ({images.length}/{MAX_IMAGES})
                </span>
              </label>
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-ghost text-xs gap-1.5 py-1 px-2"
                  style={{ color: "var(--accent)" }}
                  disabled={uploadingCount > 0}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add images
                </button>
              )}
            </div>

            {/* Drop zone (shown when no images yet) */}
            {images.length === 0 && (
              <div
                className="relative rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-10 gap-3 transition-colors duration-150 cursor-pointer"
                style={{
                  borderColor: dragging ? "var(--accent)" : "var(--border-hover)",
                  background: dragging ? "var(--accent-dim)" : "transparent",
                }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                aria-label="Upload images"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--bg-primary)" }}
                >
                  <svg className="w-6 h-6" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    {dragging ? "Drop images here" : "Drag & drop images"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    or click to browse · PNG, JPG, WebP, GIF · max 5 MB each
                  </p>
                </div>
              </div>
            )}

            {/* Image grid */}
            {images.length > 0 && (
              <div
                className="rounded-xl p-3"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <div className="grid grid-cols-4 gap-2">
                  {images.map((url) => {
                    const isFeatured = featureImage === url;
                    return (
                      <div key={url} className="relative group/img rounded-lg overflow-hidden aspect-square">
                        <Image
                          src={url}
                          alt="Task image"
                          fill
                          className="object-cover"
                          sizes="120px"
                        />
                        {/* Featured crown */}
                        {isFeatured && (
                          <div
                            className="absolute top-1 left-1 rounded-full px-1.5 py-0.5 flex items-center gap-1 text-xs font-semibold"
                            style={{ background: "rgba(0,0,0,0.75)", color: "#f0c040" }}
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                            Featured
                          </div>
                        )}
                        {/* Hover overlay */}
                        <div
                          className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity duration-150"
                          style={{ background: "rgba(0,0,0,0.6)" }}
                        >
                          {!isFeatured && (
                            <button
                              type="button"
                              onClick={() => setFeatureImage(url)}
                              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors duration-100"
                              style={{ background: "rgba(240,192,64,0.2)", color: "#f0c040", border: "1px solid rgba(240,192,64,0.4)" }}
                              title="Set as feature image"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                              Feature
                            </button>
                          )}
                          {isFeatured && (
                            <button
                              type="button"
                              onClick={() => setFeatureImage("")}
                              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors duration-100"
                              style={{ background: "rgba(240,192,64,0.3)", color: "#f0c040", border: "1px solid rgba(240,192,64,0.5)" }}
                              title="Unset feature image"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                              Unfeature
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImage(url)}
                            className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors duration-100"
                            style={{ background: "rgba(248,81,73,0.2)", color: "#f85149", border: "1px solid rgba(248,81,73,0.4)" }}
                            title="Remove image"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add more tile */}
                  {images.length < MAX_IMAGES && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors duration-150"
                      style={{ borderColor: "var(--border-hover)" }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-hover)")}
                      disabled={uploadingCount > 0}
                    >
                      {uploadingCount > 0 ? (
                        <svg className="w-5 h-5 animate-spin" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {uploadingCount > 0 ? "Uploading…" : "Add"}
                      </span>
                    </button>
                  )}

                  {/* Upload spinner tiles */}
                  {uploadingCount > 0 && images.length === 0 &&
                    Array.from({ length: uploadingCount }).map((_, i) => (
                      <div
                        key={`uploading-${i}`}
                        className="aspect-square rounded-lg flex items-center justify-center"
                        style={{ background: "var(--bg-card-hover)" }}
                      >
                        <svg className="w-5 h-5 animate-spin" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    ))
                  }
                </div>

                {/* Drag here hint */}
                {dragging && (
                  <div
                    className="mt-2 text-center text-xs py-2 rounded-lg"
                    style={{ color: "var(--accent)", background: "var(--accent-dim)" }}
                  >
                    Drop to add more images
                  </div>
                )}
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              multiple
              className="hidden"
              onChange={handleFileInput}
              aria-hidden="true"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <div>
              {todo && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="btn-danger"
                  disabled={saving || isDeleting}
                >
                  {isDeleting ? "Deleting…" : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="btn-secondary" disabled={saving || isDeleting}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving || isDeleting || uploadingCount > 0}>
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving…
                  </>
                ) : todo ? "Save changes" : "Create task"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
