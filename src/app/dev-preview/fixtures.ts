import type { Todo } from "@/lib/types";

const iso = (d: string) => new Date(d).toISOString();

export const TODOS = [
  {
    _id: "t1", title: "Passport correction for Rahim Uddin",
    description: "Name spelling on page 2 does not match the NID.",
    status: "in_progress", priority: "urgent", dueDate: iso("2026-09-02"),
    services: ["passport_correction", "police_clearance"],
    subtasks: [
      { service: "passport_correction", status: "in_progress", fields: { passport_number: "BM0912345" } },
      { service: "police_clearance", status: "todo", fields: {} },
    ],
    createdAt: iso("2026-08-10"), updatedAt: iso("2026-08-25"), userId: "u", ownerName: "Me",
    images: [], featureImage: null,
    paymentAmountMinor: 850000, initialPaymentMinor: 200000, paidAmountMinor: 400000, dueAmountMinor: 450000,
    installments: [
      {
        _id: "inst_1",
        amountMinor: 200000,
        date: iso("2026-08-15"),
        paymentMethod: "bkash",
        note: "2nd installment via bKash",
        createdAt: iso("2026-08-15"),
      },
    ],
    paymentCurrency: "BDT", paymentMethod: "bkash", paymentStatus: "partial",
  },
  {
    _id: "t2", title: "BMET registration — Ayesha Begum",
    description: "Manpower registration ahead of the Dubai contract.",
    status: "todo", priority: "high", dueDate: iso("2026-08-28"),
    services: ["bmet_registration"],
    subtasks: [{ service: "bmet_registration", status: "todo", fields: {} }],
    createdAt: iso("2026-08-18"), updatedAt: iso("2026-08-18"), userId: "u", ownerName: "Me",
    images: [], featureImage: null,
    paymentAmountMinor: 300000, initialPaymentMinor: 0, paidAmountMinor: 0, dueAmountMinor: 300000,
    installments: [],
    paymentCurrency: "BDT", paymentMethod: "unset", paymentStatus: "unpaid",
  },
  {
    _id: "t3", title: "Birth certificate copies", description: undefined,
    status: "completed", priority: "medium", dueDate: null,
    services: ["birth_certificate"],
    subtasks: [{ service: "birth_certificate", status: "completed", fields: { applicant_name: "Karim" } }],
    createdAt: iso("2026-08-01"), updatedAt: iso("2026-08-20"), userId: "u", ownerName: "Me",
    images: [], featureImage: null,
    paymentAmountMinor: 120000, initialPaymentMinor: 120000, paidAmountMinor: 120000, dueAmountMinor: 0,
    installments: [],
    paymentCurrency: "BDT", paymentMethod: "cash", paymentStatus: "paid",
  },
  {
    _id: "t4", title: "New NID for two brothers", description: "Both files together.",
    status: "todo", priority: "none", dueDate: iso("2026-09-15"),
    services: ["new_nid"], subtasks: [{ service: "new_nid", status: "todo", fields: {} }],
    createdAt: iso("2026-08-22"), updatedAt: iso("2026-08-22"), userId: "u", ownerName: "Me",
    images: [], featureImage: null,
    paymentAmountMinor: null, initialPaymentMinor: null, paidAmountMinor: null, dueAmountMinor: null,
    installments: [],
    paymentCurrency: "BDT", paymentMethod: "unset", paymentStatus: "unpaid",
  },
] as unknown as Todo[];

export const COUNTS = { todo: 2, in_progress: 1, completed: 1 };
