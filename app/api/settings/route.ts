import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/dirac/auth-guard";
import { validateBody, SettingsPatchSchema } from "@/lib/dirac/validation";
import { getUserSettings, updateUserSettings } from "@/lib/dirac/user-db";

const DEFAULTS = {
  aiModel: process.env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-4-4",
  aboutMe: "",
};

export async function GET() {
  const guard = await requireAuth();
  if (guard.error) return guard.response;

  try {
    const settings = await getUserSettings(guard.userId!);
    return NextResponse.json({
      aiModel: settings.aiModel ?? DEFAULTS.aiModel,
      aboutMe: settings.aboutMe ?? "",
    });
  } catch {
    return NextResponse.json(DEFAULTS);
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAuth();
  if (guard.error) return guard.response;

  const parsed = await validateBody(request, SettingsPatchSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  try {
    const patch: { aiModel?: string; aboutMe?: string } = {};
    if (typeof parsed.data.aiModel === "string") patch.aiModel = parsed.data.aiModel.trim();
    if (typeof parsed.data.aboutMe === "string") patch.aboutMe = parsed.data.aboutMe.trim();
    await updateUserSettings(guard.userId!, patch);
    return NextResponse.json({ ok: true, persisted: true });
  } catch (err) {
    console.error("[settings] update failed:", err);
    return NextResponse.json({ ok: true, persisted: false });
  }
}
