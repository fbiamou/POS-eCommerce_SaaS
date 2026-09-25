"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { feedbackFromError, type FeedbackCode } from "@/lib/feedback";

// The owner of a read-only shop goes back to the free Standard plan to sell
// again, within its limits (supabase: choose_standard_plan).
export async function chooseStandardPlan(): Promise<{ success?: true; error?: FeedbackCode }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("choose_standard_plan");
  if (error) {
    console.error("choose_standard_plan failed:", error);
    return { error: feedbackFromError(error) };
  }
  revalidatePath("/", "layout");
  return { success: true };
}
