import { z } from "zod";
export const uuid = z.uuid();
const text = (max: number, min = 1) => z.string().trim().min(min).max(max);
export const password = z
  .string()
  .min(10)
  .refine(
    (v) => new TextEncoder().encode(v).length <= 72,
    "Password must be at most 72 bytes.",
  );
export const email = z
  .email()
  .max(200)
  .transform((v) => v.trim().toLowerCase());
export const registration = z
  .string()
  .transform((v) => v.toUpperCase().replace(/\s/g, ""))
  .pipe(
    z
      .string()
      .regex(/^[A-Z0-9-]{4,20}$/, "Use 4–20 letters, numbers, or hyphens."),
  );
export const vehicleSchema = z
  .object({
    registration,
    make: text(60),
    model: text(60),
    modelYear: z.number().int().min(1900).max(2100),
    currentKm: z.number().int().min(0).max(2147483647),
  })
  .strict();
export const centreSchema = z
  .object({
    name: text(120, 2),
    address: text(300, 3),
    city: text(100, 2),
    phone: text(30, 6),
    active: z.boolean().optional(),
  })
  .strict();
export const itemSchema = z
  .object({
    serviceTypeId: uuid,
    description: text(500),
    quantity: z.number().int().min(1).max(100),
    unitPrice: z
      .string()
      .regex(/^\d{1,7}(\.\d{1,2})?$/)
      .refine((v) => Number(v) <= 1000000),
    faultCode: z.string().max(40).nullable().optional(),
  })
  .strict();
export const inspectionSchema = z
  .object({
    revision: z.number().int().min(0),
    diagnosticNotes: z.string().max(5000),
    items: z
      .array(
        z
          .object({
            component: text(100),
            result: z.enum(["PASS", "ATTENTION", "FAIL"]),
            comment: z.string().max(1000),
            measurements: z
              .array(
                z
                  .object({
                    name: text(100),
                    value: z.number().finite(),
                    unit: text(30),
                  })
                  .strict(),
              )
              .max(20),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();
export const ruleSchema = z
  .object({
    serviceTypeId: uuid,
    intervalMonths: z.number().int().min(1).max(120).nullable(),
    intervalKm: z.number().int().min(1).max(1000000).nullable(),
    baselineDate: z.iso.date().nullable(),
    baselineKm: z.number().int().min(0).max(2147483647).nullable(),
  })
  .strict()
  .refine(
    (v) => v.intervalMonths !== null || v.intervalKm !== null,
    "Enter a time or mileage interval.",
  );
