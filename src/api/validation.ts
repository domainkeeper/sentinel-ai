import { z } from "zod";

/** Schema for POST /api/agent/init request body. */
export const initAgentSchema = z.object({
  persona: z
    .object({
      name: z.string().trim().min(1, "persona.name is required"),
      domain: z.string().trim().min(1, "persona.domain is required"),
    })
    .strict(),
});

export type InitAgentBody = z.infer<typeof initAgentSchema>;