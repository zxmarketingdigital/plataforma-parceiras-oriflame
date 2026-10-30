import { json, route } from "@/core/http";
import { authed, readBody } from "@/modules/crm/api";
import { uuidParam } from "@/modules/crm/common";
import { addNote, noteSchema } from "@/modules/crm/leads";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await authed("leads.write");
  const { text } = await readBody(req, noteSchema);
  const note = await addNote(u, uuidParam((await params).id), text);
  return json({ ...note, user_name: u.name }, 201);
});
