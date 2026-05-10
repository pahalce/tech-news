import type { FlueContext } from "@flue/sdk/client";
import * as v from "valibot";

export const triggers = {};

const PayloadSchema = v.object({});

export default async function ({ payload }: FlueContext) {
  v.parse(PayloadSchema, payload);

  return {
    command: "suggest-feature-vocabulary",
    status: "placeholder",
  };
}
