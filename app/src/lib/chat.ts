import { logAudit } from "./audit";
import { supabase } from "./supabase";

export type ChatChannelKind = "team" | "patient" | "direct";

export type ChatStackParamList = {
  ChatList: undefined;
  ChatThread: { channelId: string };
  ChatColleaguePicker: { channelId?: string };
};

export interface ChatChannel {
  id: string;
  institution_id: string;
  kind: ChatChannelKind;
  name: string | null;
  patient_id: string | null;
  created_by: string;
  created_at: string;
}

export interface ChatProfile {
  id: string;
  institution_id: string;
  full_name: string;
  role: string;
  credential_verified: boolean;
  is_active: boolean;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  institution_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  senderName: string;
  senderRole: string;
  delivery?: "sending" | "failed";
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

async function findGeneralChannel(institutionId: string): Promise<ChatChannel | null> {
  const { data, error } = await supabase
    .from("chat_channels")
    .select("*")
    .eq("institution_id", institutionId)
    .eq("kind", "team")
    .eq("name", "General")
    .maybeSingle();

  if (error) throw new Error("Unable to load the General channel.");
  return (data as ChatChannel | null) ?? null;
}

async function findPatientChannel(
  institutionId: string,
  patientId: string
): Promise<ChatChannel | null> {
  const { data, error } = await supabase
    .from("chat_channels")
    .select("*")
    .eq("institution_id", institutionId)
    .eq("kind", "patient")
    .eq("patient_id", patientId)
    .maybeSingle();

  if (error) throw new Error("Unable to load the patient thread.");
  return (data as ChatChannel | null) ?? null;
}

async function createChannel(input: {
  institution_id: string;
  kind: ChatChannelKind;
  name: string | null;
  patient_id: string | null;
  created_by: string;
}): Promise<ChatChannel> {
  const { data, error } = await supabase
    .from("chat_channels")
    .insert(input)
    .select("*")
    .single();

  if (error) {
    throw Object.assign(new Error("Unable to create the chat channel."), { code: error.code });
  }
  if (!data) throw new Error("Unable to create the chat channel.");

  await logAudit({
    userId: input.created_by,
    institutionId: input.institution_id,
    action: "create",
    tableName: "chat_channels",
    recordId: data.id,
  });
  return data as ChatChannel;
}

export async function addChatMember(
  channel: ChatChannel,
  memberId: string,
  actor: ChatProfile
): Promise<boolean> {
  const { error } = await supabase.from("chat_members").insert({
    channel_id: channel.id,
    user_id: memberId,
    institution_id: channel.institution_id,
  });

  if (isUniqueViolation(error)) return false;
  if (error) throw new Error("Unable to add this colleague to the channel.");

  await logAudit({
    userId: actor.id,
    institutionId: channel.institution_id,
    action: "create",
    tableName: "chat_members",
    recordId: channel.id,
  });
  return true;
}

export async function getOrCreateGeneralChannel(profile: ChatProfile): Promise<ChatChannel> {
  let channel = await findGeneralChannel(profile.institution_id);
  if (!channel) {
    try {
      channel = await createChannel({
        institution_id: profile.institution_id,
        kind: "team",
        name: "General",
        patient_id: null,
        created_by: profile.id,
      });
    } catch (error) {
      if (!isUniqueViolation(error as { code?: string })) throw error;
      channel = await findGeneralChannel(profile.institution_id);
      if (!channel) throw new Error("Unable to load the General channel.");
    }
  }

  await addChatMember(channel, profile.id, profile);
  return channel;
}

export async function getOrCreatePatientChannel(
  profile: ChatProfile,
  patientId: string
): Promise<ChatChannel> {
  let channel = await findPatientChannel(profile.institution_id, patientId);
  if (!channel) {
    try {
      channel = await createChannel({
        institution_id: profile.institution_id,
        kind: "patient",
        name: null,
        patient_id: patientId,
        created_by: profile.id,
      });
    } catch (error) {
      if (!isUniqueViolation(error as { code?: string })) throw error;
      channel = await findPatientChannel(profile.institution_id, patientId);
      if (!channel) throw new Error("Unable to load the patient thread.");
    }
  }

  await addChatMember(channel, profile.id, profile);
  return channel;
}

export async function findDirectChannelWithMember(
  profile: ChatProfile,
  colleagueId: string
): Promise<ChatChannel | null> {
  const { data: memberships, error: membershipError } = await supabase
    .from("chat_members")
    .select("channel_id")
    .eq("user_id", profile.id)
    .eq("institution_id", profile.institution_id);

  if (membershipError) throw new Error("Unable to load your chat memberships.");
  const channelIds = (memberships ?? []).map((membership) => membership.channel_id as string);
  if (channelIds.length === 0) return null;

  const { data: channels, error: channelError } = await supabase
    .from("chat_channels")
    .select("*")
    .in("id", channelIds)
    .eq("institution_id", profile.institution_id)
    .eq("kind", "direct");

  if (channelError) throw new Error("Unable to load direct messages.");
  const directChannels = (channels ?? []) as ChatChannel[];
  if (directChannels.length === 0) return null;

  const { data: colleagueMembership, error: colleagueMembershipError } = await supabase
    .from("chat_members")
    .select("channel_id")
    .in("channel_id", directChannels.map((channel) => channel.id))
    .eq("user_id", colleagueId)
    .limit(1)
    .maybeSingle();

  if (colleagueMembershipError) throw new Error("Unable to inspect direct-message members.");
  return directChannels.find((channel) => channel.id === colleagueMembership?.channel_id) ?? null;
}

export async function createDirectChannel(
  profile: ChatProfile,
  colleagueId: string
): Promise<ChatChannel> {
  const channel = await createChannel({
    institution_id: profile.institution_id,
    kind: "direct",
    name: null,
    patient_id: null,
    created_by: profile.id,
  });
  await addChatMember(channel, profile.id, profile);
  await addChatMember(channel, colleagueId, profile);
  return channel;
}